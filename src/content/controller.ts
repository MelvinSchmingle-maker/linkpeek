/**
 * Content-side brain: applies the chosen mode, owns the scanner and the
 * card, and answers messages from the popup and the service worker.
 *
 * Modes:
 * - smart:  on sites you turned on, icons appear by themselves on
 *           article-like links, including ones loaded later.
 * - scan:   no icons until the user presses "Scan this page".
 * - manual: no icons at all. Right-click a link > "Peek at this link", or
 *           focus a link and press the keyboard shortcut.
 *
 * When this script was added to a page on demand (a right-click peek or a
 * one-off scan on a site that isn't turned on), Smart mode does NOT start
 * scanning by itself: the user only asked about one link or one scan.
 */
import { classifyLink } from '../core/detect/classify';
import { readLinkFeatures } from '../core/detect/features';
import { hostnameOf, recordFeedback, type FeedbackValue } from '../core/feedback/store';
import type { Settings } from '../core/storage/settings';
import type { RetrieveRequest, RetrieveResponse } from '../background/retrieve';
import { fetchLimited, type FetchOutcome } from '../core/retrieve/fetcher';
import { samePage } from '../core/retrieve/url';
import type { LinkResult } from '../core/types';
import { attachIcon, CardController, HOST_ATTR, isOurHost, isWebUrl } from './card';
import { demoResult, isDemoKey } from './fixtures';
import type { ContentMessage, ContentResponse, SiteStatus, WorkerMessage } from './messages';
import type { CorrectionsResult } from '../core/source/corrections';
import { htmlLinksIn, LinkScanner } from './scanner';

const DEMO_ATTR = 'data-linkpeek-demo';
/** Demo results only ever appear on LinkPeek's own local test server. */
const DEMO_HOSTS = new Set(['127.0.0.1', 'localhost']);

/** Wait before the first automatic scan, so we don't touch a page while its framework is still building it. */
const QUIET_MS = 300;
const QUIET_MAX_MS = 3000;
/** How often a copy of LinkPeek checks it's still the live one (a property read, no messages). */
const ALIVE_CHECK_MS = 5000;
/** Links within this element count as one story when they share an address. */
const STORY_BLOCK = 'article, [role="article"], li';

/** A demo or ready-made result, 'loading' for the stays-loading demo, or 'fetch' for a real link. */
type Result = LinkResult | 'loading' | 'fetch';

export class PageController {
  private cards = new CardController();
  private scanner: LinkScanner;
  private settings: Settings;
  private buttons = new WeakMap<HTMLAnchorElement, HTMLButtonElement>();
  private tempIcons = new Set<HTMLElement>();
  private lastContextLink?: HTMLAnchorElement;
  private applySeq = 0;
  private firstAutoScan = true;
  private dead = false;
  private aliveTimer?: ReturnType<typeof setInterval>;
  /** Links that have an icon, by address, so a story gets one icon, not one per duplicate link. */
  private iconLinksByHref = new Map<string, Set<HTMLAnchorElement>>();
  /** The result the open card shows (for feedback). */
  private shown?: LinkResult;
  /** Bumped per load, so a slow answer for an older request can't overwrite a newer one. */
  private loadSeq = 0;

  constructor(
    private readonly doc: Document,
    settings: Settings,
  ) {
    this.settings = settings;
    this.scanner = new LinkScanner(doc, {
      accept: (link) => this.accept(link),
      attach: (link) => this.attach(link),
      alive: () => this.alive(),
      onDead: () => this.teardown(),
      // Test build only: timing for the speed test. Removed from the real build.
      onBatch: __E2E__ ? (s) => recordTiming(doc, s.ms, this.scanner.iconCount) : undefined,
    });
    // Remember which link was right-clicked, so "Peek at this link" opens
    // the card on that exact link even when the page repeats the URL.
    doc.addEventListener('contextmenu', this.onContextMenu, true);
    // After an extension update, this copy is dead but its icons are still on
    // the page. Notice within a few seconds, in every mode, and clean up.
    this.aliveTimer = setInterval(() => {
      if (!this.alive()) this.teardown();
    }, ALIVE_CHECK_MS);
  }

  /** Remove icons and cards left by an older copy of LinkPeek (e.g. before an update). */
  removeLeftovers(): void {
    for (const el of this.doc.querySelectorAll(`[${HOST_ATTR}]`)) el.remove();
  }

  /**
   * Apply the current mode. Safe to call again after settings change.
   * Resolves once the mode is decided; Smart mode's first automatic scan may
   * start a little later (see waitForQuietPage), without holding anything up.
   */
  async apply(settings: Settings): Promise<void> {
    const seq = ++this.applySeq;
    this.settings = settings;
    this.cards.close({ restoreFocus: false });
    this.removeTempIcons();
    this.scanner.stop();
    this.iconLinksByHref.clear();
    if (this.siteDisabled || settings.mode !== 'smart') return;
    const { allowed } = await this.siteStatus();
    if (seq !== this.applySeq || !allowed) return;
    if (!this.firstAutoScan) {
      this.scanner.start();
      return;
    }
    this.firstAutoScan = false;
    void waitForQuietPage(this.doc).then(() => {
      if (seq === this.applySeq && !this.dead) this.scanner.start();
    });
  }

  async handle(msg: ContentMessage): Promise<ContentResponse> {
    switch (msg.type) {
      case 'ping':
        return { ok: true };
      case 'refresh':
        await this.apply(this.settings);
        return { ok: true };
      case 'close-card':
        this.cards.close({ restoreFocus: false });
        return { ok: true };
      case 'retry': {
        // Access to a site was just granted in LinkPeek's permission window.
        const link = this.cards.openFor;
        if (link) void this.load(link);
        return { ok: true };
      }
      case 'scan':
        await this.scanner.scanOnce();
        return { ok: true, found: this.scanner.iconCount };
      case 'peek': {
        const link = this.findLink(msg.url);
        if (!link) return { ok: false };
        this.peekTemporary(link);
        return { ok: true };
      }
      case 'peek-focused': {
        const focused = deepActiveElement(this.doc);
        const link = focused?.closest('a[href]');
        if (!(link instanceof HTMLAnchorElement)) return { ok: false };
        this.peekTemporary(link);
        return { ok: true };
      }
    }
  }

  private get siteDisabled(): boolean {
    return this.settings.disabledSites.includes(this.doc.location.hostname);
  }

  private async siteStatus(): Promise<SiteStatus> {
    try {
      const msg: WorkerMessage = { type: 'site-status' };
      const res = (await chrome.runtime.sendMessage(msg)) as SiteStatus | undefined;
      return { allowed: Boolean(res?.allowed) };
    } catch {
      return { allowed: false };
    }
  }

  private alive(): boolean {
    try {
      return !this.dead && Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  /** This copy of LinkPeek is dead (extension updated or removed): leave the page as we found it. */
  private teardown(): void {
    if (this.dead) return;
    this.dead = true;
    this.cards.close({ restoreFocus: false });
    this.removeTempIcons();
    this.scanner.stop();
    this.doc.removeEventListener('contextmenu', this.onContextMenu, true);
    clearInterval(this.aliveTimer);
  }

  /** Demo markup is only honoured on LinkPeek's local test pages, never on real websites. */
  private demoKeyFor(link: HTMLAnchorElement): string | null {
    if (!this.settings.showDemoResults || !DEMO_HOSTS.has(this.doc.location.hostname)) return null;
    if (!isWebUrl(link.href)) return null;
    const key = link.getAttribute(DEMO_ATTR);
    return key !== null && isDemoKey(key) ? key : null;
  }

  private accept(link: HTMLAnchorElement): boolean {
    if (link.closest(`[${HOST_ATTR}]`)) return false;
    if (this.demoKeyFor(link) !== null) return true;
    if (!classifyLink(readLinkFeatures(link)).isCandidate) return false;
    return !this.storyAlreadyHasIcon(link);
  }

  /**
   * A teaser often links the same story twice (headline, then a description
   * or "Read the full story"). One icon per story block is enough.
   */
  private storyAlreadyHasIcon(link: HTMLAnchorElement): boolean {
    const others = this.iconLinksByHref.get(link.href);
    if (!others) return false;
    const block = link.closest(STORY_BLOCK) ?? link.parentElement?.parentElement;
    for (const other of others) {
      if (!other.isConnected || other === link) {
        others.delete(other);
        continue;
      }
      if (block && Node.prototype.contains.call(block, other)) return true;
    }
    return false;
  }

  private attach(link: HTMLAnchorElement): HTMLElement {
    const { host, button } = attachIcon(link, (b) => {
      // A dead copy (extension updated) cleans up instead of opening a card.
      if (!this.alive()) {
        this.teardown();
        return;
      }
      this.toggleCard(link, b);
    });
    this.buttons.set(link, button);
    const set = this.iconLinksByHref.get(link.href) ?? new Set();
    set.add(link);
    this.iconLinksByHref.set(link.href, set);
    return host;
  }

  private toggleCard(link: HTMLAnchorElement, button: HTMLButtonElement, onClosed?: () => void): void {
    if (this.cards.openFor === link) {
      this.cards.close({ restoreFocus: true });
      return;
    }
    const result = this.resultFor(link);
    const callbacks = {
      onFeedback: (value: FeedbackValue) => this.feedback(this.shown, value),
      onClosed,
      onAction: () => this.askForAccess(link),
      onCorrections: () => this.checkCorrections(link),
    };
    if (result === 'loading') {
      this.cards.open(link, button, { kind: 'loading', isDemo: true }, callbacks);
    } else if (result === 'fetch') {
      this.shown = undefined;
      this.cards.open(link, button, { kind: 'loading', isDemo: false }, callbacks);
      void this.load(link);
    } else {
      this.shown = result;
      this.cards.open(link, button, { kind: 'result', result }, callbacks);
    }
  }

  /**
   * Read a real link and show the result in its card, if that card is still
   * open. The service worker does the work; same-site links are fetched by
   * this page, which needs no extra permission.
   */
  private async load(link: HTMLAnchorElement): Promise<void> {
    const seq = ++this.loadSeq;
    const headline = (link.textContent ?? '').replace(/\s+/g, ' ').trim();
    const show = (result: LinkResult) => {
      if (seq !== this.loadSeq || this.cards.openFor !== link) return;
      this.shown = result;
      this.cards.update({ kind: 'result', result });
    };
    if (this.cards.openFor === link) this.cards.update({ kind: 'loading', isDemo: false });

    const req: RetrieveRequest = { type: 'retrieve', url: link.href, headline };
    // The link points at this very page: read it as it is.
    if (samePage(link.href, this.doc.location.href)) req.fromPage = this.currentPage(link.href);

    let res = await this.askWorker(req);
    if (res?.kind === 'fetch-from-page') {
      res = await this.askWorker({ ...req, fromPage: await fetchLimited(link.href, { via: 'page' }) });
    }
    show(res?.kind === 'result' ? res.result : unreachable(link.href, headline));
  }

  /** Asks the service worker for the site's corrections page. Only when the user presses the card's button. */
  private async checkCorrections(link: HTMLAnchorElement): Promise<CorrectionsResult> {
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'corrections', url: link.href } satisfies WorkerMessage)) as
        | CorrectionsResult
        | undefined;
      return res ?? { kind: 'error' };
    } catch {
      return { kind: 'error' };
    }
  }

  /** Message the service worker, trying once more if it was restarted mid-request. */
  private async askWorker(req: RetrieveRequest): Promise<RetrieveResponse | undefined> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = (await chrome.runtime.sendMessage(req satisfies WorkerMessage)) as RetrieveResponse | undefined;
        if (res) return res;
      } catch {
        // The service worker went away (Chrome restarts it at will). Try again once.
      }
    }
    return undefined;
  }

  /** This page as LinkPeek sees it now, for links that point at the page itself. */
  private currentPage(url: string): FetchOutcome {
    return {
      ok: true,
      raw: {
        requestedUrl: url,
        finalUrl: url,
        redirected: false,
        status: 200,
        contentType: 'text/html',
        // Read-only copy of the page's markup, parsed later without running anything.
        // eslint-disable-next-line no-restricted-properties
        text: this.doc.documentElement.outerHTML,
        via: 'current-page',
      },
    };
  }

  /** The card's "Allow access…" button: LinkPeek opens its own small window to ask. */
  private askForAccess(link: HTMLAnchorElement): void {
    void chrome.runtime.sendMessage({ type: 'open-permission', url: link.href } satisfies WorkerMessage).catch(() => undefined);
  }

  /** Manual peek: open the card, adding a temporary icon if the link has none. */
  private peekTemporary(link: HTMLAnchorElement): void {
    if (this.cards.openFor === link) {
      this.cards.focus();
      return;
    }
    const existing = this.buttons.get(link);
    if (existing?.isConnected && existing.getRootNode() instanceof ShadowRoot) {
      this.toggleCard(link, existing);
      return;
    }
    const { host, button } = attachIcon(link, (b) => this.toggleCard(link, b, remove));
    const remove = () => {
      if (isOurHost(host)) host.remove();
      this.tempIcons.delete(host);
    };
    this.tempIcons.add(host);
    this.toggleCard(link, button, remove);
  }

  private removeTempIcons(): void {
    for (const host of this.tempIcons) if (isOurHost(host)) host.remove();
    this.tempIcons.clear();
  }

  /** Demo links answer from fixtures; real links are read (see load). */
  private resultFor(link: HTMLAnchorElement): Result {
    const demoKey = this.demoKeyFor(link);
    if (demoKey !== null && isDemoKey(demoKey)) return demoResult(demoKey, link);
    if (!isWebUrl(link.href)) {
      // javascript:, mailto:, tel: and the like aren't pages LinkPeek can read.
      return {
        id: `unsupported-${link.href.slice(0, 40)}`,
        url: link.href,
        headline: (link.textContent ?? '').trim(),
        evidence: 'unavailable',
        unsupported: true,
        headlineCheck: { verdict: 'unknown', notChecked: true },
        linkRisk: { level: 'not-checked' },
        isDemo: false,
      };
    }
    return 'fetch';
  }

  private async feedback(result: LinkResult | undefined, value: FeedbackValue): Promise<void> {
    if (!result) return;
    await recordFeedback({
      resultId: result.id,
      signal: 'summary-usefulness',
      value,
      hostname: hostnameOf(result.url),
      evidence: result.evidence,
      provider: result.summary?.provider,
      wordCount: result.summary?.wordCount,
      isDemo: result.isDemo,
    });
  }

  /**
   * The link the user meant: the one they right-clicked if we saw it,
   * otherwise one that's on screen, otherwise any that's drawn. A link that
   * isn't drawn at all can't hold a card, so it counts as not found.
   */
  private findLink(url: string): HTMLAnchorElement | undefined {
    const clicked = this.lastContextLink;
    if (clicked?.isConnected && clicked.href === url) return clicked;
    const drawn = htmlLinksIn(this.doc).filter((a) => a.href === url && a.getClientRects().length > 0);
    const vh = this.doc.documentElement.clientHeight;
    const vw = this.doc.documentElement.clientWidth;
    const onScreen = drawn.find((a) => {
      const r = a.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    });
    return onScreen ?? drawn[0];
  }

  private onContextMenu = (e: MouseEvent): void => {
    const target = e.composedPath()[0];
    const link = target instanceof Element ? target.closest('a[href]') : null;
    this.lastContextLink = link instanceof HTMLAnchorElement ? link : undefined;
  };

}

/** Test build only: record the slowest batch so tests can check page speed. */
function recordTiming(doc: Document, ms: number, icons: number): void {
  const root = doc.documentElement;
  const prev = Number(root.dataset.linkpeekMaxBatchMs ?? 0);
  root.dataset.linkpeekMaxBatchMs = String(Math.max(prev, Math.round(ms * 10) / 10));
  root.dataset.linkpeekIcons = String(icons);
}

/** document.activeElement, looking inside open shadow roots. */
function deepActiveElement(doc: Document): Element | null {
  let el = doc.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/**
 * Resolves once the page has loaded and its DOM has been still for a moment
 * (or after a few seconds regardless). Sites built with React and similar
 * tools "hydrate" their server-rendered HTML shortly after load; adding our
 * icons before that can make them throw the page away and rebuild it.
 */
export function waitForQuietPage(doc: Document, quietMs = QUIET_MS, maxMs = QUIET_MAX_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    const win = doc.defaultView;
    // The cap runs from the start, so a page whose images or ads never finish
    // loading still gets scanned after a few seconds.
    const cap = setTimeout(done, maxMs);

    function startQuietTimer() {
      if (finished) return;
      timer = setTimeout(done, quietMs);
      observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(done, quietMs);
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
    function done() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(cap);
      observer?.disconnect();
      win?.removeEventListener('load', startQuietTimer);
      resolve();
    }

    if (doc.readyState === 'complete') startQuietTimer();
    else win?.addEventListener('load', startQuietTimer, { once: true });
  });
}

/** Shown when the service worker couldn't be reached at all. */
function unreachable(url: string, headline: string): LinkResult {
  return {
    id: 'unreachable',
    url,
    headline,
    evidence: 'unavailable',
    failure: 'extraction-failed',
    headlineCheck: { verdict: 'unknown', notChecked: true },
    linkRisk: { level: 'not-checked' },
    isDemo: false,
  };
}
