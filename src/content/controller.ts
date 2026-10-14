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
import type { LinkResult } from '../core/types';
import { attachIcon, CardController, HOST_ATTR, isOurHost, isWebUrl } from './card';
import { demoResult, isDemoKey } from './fixtures';
import type { ContentMessage, ContentResponse, SiteStatus, WorkerMessage } from './messages';
import { htmlLinksIn, LinkScanner } from './scanner';

const DEMO_ATTR = 'data-linkpeek-demo';
/** Demo results only ever appear on LinkPeek's own local test server. */
const DEMO_HOSTS = new Set(['127.0.0.1', 'localhost']);

/** Wait before the first automatic scan, so we don't touch a page while its framework is still building it. */
const QUIET_MS = 300;
const QUIET_MAX_MS = 3000;

type Result = LinkResult | 'loading' | 'not-ready';

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
      onBatch: __E2E__ ? (s) => this.recordTiming(s.ms) : undefined,
    });
    // Remember which link was right-clicked, so "Peek at this link" opens
    // the card on that exact link even when the page repeats the URL.
    doc.addEventListener('contextmenu', this.onContextMenu, true);
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
    return classifyLink(readLinkFeatures(link)).isCandidate;
  }

  private attach(link: HTMLAnchorElement): HTMLElement {
    const { host, button } = attachIcon(link, (b) => this.toggleCard(link, b));
    this.buttons.set(link, button);
    return host;
  }

  private toggleCard(link: HTMLAnchorElement, button: HTMLButtonElement, onClosed?: () => void): void {
    if (this.cards.openFor === link) {
      this.cards.close({ restoreFocus: true });
      return;
    }
    const result = this.resultFor(link);
    const onFeedback = (value: FeedbackValue) => this.feedback(result, value);
    if (result === 'loading') {
      this.cards.open(link, button, { kind: 'loading', isDemo: true }, onFeedback, onClosed);
    } else if (result === 'not-ready') {
      this.cards.open(link, button, { kind: 'not-ready' }, onFeedback, onClosed);
    } else {
      this.cards.open(link, button, { kind: 'result', result }, onFeedback, onClosed);
    }
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

  /** Demo links answer from fixtures. Real reading arrives in Part 04. */
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
        headlineCheck: { verdict: 'unknown' },
        linkRisk: { level: 'not-checked' },
        isDemo: false,
      };
    }
    return 'not-ready';
  }

  private async feedback(result: Result, value: FeedbackValue): Promise<void> {
    if (typeof result === 'string') return;
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

  /** Test build only: record the slowest batch so tests can check page speed. */
  private recordTiming(ms: number): void {
    const root = this.doc.documentElement;
    const prev = Number(root.dataset.linkpeekMaxBatchMs ?? 0);
    root.dataset.linkpeekMaxBatchMs = String(Math.max(prev, Math.round(ms * 10) / 10));
    root.dataset.linkpeekIcons = String(this.scanner.iconCount);
  }
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
  const loaded =
    doc.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((r) => doc.defaultView?.addEventListener('load', () => r(), { once: true }));
  return loaded.then(
    () =>
      new Promise<void>((resolve) => {
        let timer = setTimeout(done, quietMs);
        const cap = setTimeout(done, maxMs);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, quietMs);
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
        function done() {
          clearTimeout(timer);
          clearTimeout(cap);
          observer.disconnect();
          resolve();
        }
      }),
  );
}
