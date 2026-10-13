/**
 * Content-side brain: applies the chosen mode, owns the scanner and the
 * card, and answers messages from the popup and the service worker.
 *
 * Modes:
 * - smart:  on sites LinkPeek is allowed on, icons appear by themselves on
 *           article-like links, including ones loaded later.
 * - scan:   no icons until the user presses "Scan this page".
 * - manual: no icons at all. Right-click a link > "Peek at this link", or
 *           focus a link and press the keyboard shortcut.
 */
import { classifyLink } from '../core/detect/classify';
import { readLinkFeatures } from '../core/detect/features';
import { hostnameOf, recordFeedback, type FeedbackValue } from '../core/feedback/store';
import type { Settings } from '../core/storage/settings';
import type { LinkResult } from '../core/types';
import { attachIcon, CardController, HOST_ATTR } from './card';
import { demoResult, isDemoKey } from './fixtures';
import type { ContentMessage, ContentResponse } from './messages';
import { LinkScanner } from './scanner';

const DEMO_ATTR = 'data-linkpeek-demo';

export class PageController {
  private cards = new CardController();
  private scanner: LinkScanner;
  private settings: Settings;
  private buttons = new WeakMap<HTMLAnchorElement, HTMLButtonElement>();

  constructor(
    private readonly doc: Document,
    settings: Settings,
  ) {
    this.settings = settings;
    this.scanner = new LinkScanner(doc, {
      accept: (link) => this.accept(link),
      attach: (link) => this.attach(link),
      onBatch: __E2E__ ? (s) => this.recordTiming(s.ms) : undefined,
    });
  }

  /** Apply the current mode. Safe to call again after settings change. */
  apply(settings: Settings): void {
    this.settings = settings;
    this.cards.close({ restoreFocus: false });
    this.scanner.stop();
    if (this.siteDisabled) return;
    if (settings.mode === 'smart') this.scanner.start();
  }

  async handle(msg: ContentMessage): Promise<ContentResponse> {
    switch (msg.type) {
      case 'ping':
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
        const link = deepActiveElement(this.doc)?.closest<HTMLAnchorElement>('a[href]');
        if (!link) return { ok: false };
        this.peekTemporary(link);
        return { ok: true };
      }
    }
  }

  private get siteDisabled(): boolean {
    return this.settings.disabledSites.includes(this.doc.location.hostname);
  }

  private accept(link: HTMLAnchorElement): boolean {
    if (link.closest(`[${HOST_ATTR}]`)) return false;
    const demoKey = link.getAttribute(DEMO_ATTR);
    if (demoKey !== null) return this.settings.showDemoResults && isDemoKey(demoKey);
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
    const existing = this.buttons.get(link);
    if (existing?.isConnected) {
      if (this.cards.openFor !== link) this.toggleCard(link, existing);
      return;
    }
    const { host, button } = attachIcon(link, (b) => this.toggleCard(link, b, remove));
    const remove = () => host.remove();
    this.toggleCard(link, button, remove);
  }

  /** Demo links answer from fixtures. Real reading arrives in Part 04. */
  private resultFor(link: HTMLAnchorElement): LinkResult | 'loading' | 'not-ready' {
    const demoKey = link.getAttribute(DEMO_ATTR);
    if (demoKey !== null && this.settings.showDemoResults && isDemoKey(demoKey)) return demoResult(demoKey, link);
    return 'not-ready';
  }

  private async feedback(result: LinkResult | 'loading' | 'not-ready', value: FeedbackValue): Promise<void> {
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

  private findLink(url: string): HTMLAnchorElement | undefined {
    const matches = [...this.doc.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => a.href === url);
    return matches.find((a) => a.getClientRects().length > 0) ?? matches[0];
  }

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
