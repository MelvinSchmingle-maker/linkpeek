/**
 * Finds links worth an icon, on load and as pages change (infinite feeds,
 * single-page apps), without slowing the page down.
 *
 * - Each link is judged once. It is judged again if its href or text
 *   changes, or if its icon is no longer right next to it (a framework
 *   re-render removed it, or the list was re-ordered).
 * - Icons whose link has gone are swept away, so a re-keyed list never
 *   leaves a dead icon behind.
 * - Work is done in small time-boxed batches so a page with thousands of
 *   links stays responsive.
 * - Reads (classifying) and writes (inserting icons) are done in separate
 *   passes, so the browser doesn't have to re-layout between links.
 */
import { isOurHost } from './card';

export interface ScannerOptions {
  /** Should this link get an icon? */
  accept: (link: HTMLAnchorElement) => boolean;
  /** Put the icon on the link. Returns the icon host element. */
  attach: (link: HTMLAnchorElement) => HTMLElement;
  /** False once this copy of LinkPeek is dead (extension updated or removed). */
  alive?: () => boolean;
  /** Called when alive() turns false, so the owner can clean up. */
  onDead?: () => void;
  /** Called after each batch (used for timing in tests). */
  onBatch?: (stats: { processed: number; added: number; ms: number }) => void;
}

/** Max time per batch before yielding back to the page. */
const BATCH_BUDGET_MS = 8;
const MAX_ICONS_PER_BATCH = 40;

interface Seen {
  href: string;
  text: string;
  icon?: HTMLElement;
}

// Called through the prototype so a page can't break them by "clobbering"
// properties (e.g. a <form> with an input named "querySelectorAll").
// (Document named properties even override built-in methods.)
const elementQsa = Element.prototype.querySelectorAll;
const documentQsa = Document.prototype.querySelectorAll;
const closest = Element.prototype.closest;

/** Real HTML links only. SVG <a> elements match 'a[href]' too, but their href is an object. */
export function htmlLinksIn(root: Document | Element): HTMLAnchorElement[] {
  const found = root instanceof Document ? documentQsa.call(root, 'a[href]') : elementQsa.call(root, 'a[href]');
  return [...found].filter((a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement);
}

export class LinkScanner {
  private seen = new WeakMap<HTMLAnchorElement, Seen>();
  private pending = new Set<HTMLAnchorElement>();
  private observer?: MutationObserver;
  private scheduled = false;
  /** Icon host -> the link it belongs to. */
  private icons = new Map<HTMLElement, HTMLAnchorElement>();
  private idleResolvers: (() => void)[] = [];

  constructor(
    private readonly doc: Document,
    private readonly opts: ScannerOptions,
  ) {}

  /** Scan the page now and keep watching for new links. */
  start(): void {
    this.queueAll();
    if (this.observer) return;
    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }

  /** One scan of the current page, without watching for changes. */
  scanOnce(): Promise<void> {
    this.queueAll();
    return this.whenIdle();
  }

  /** Stop watching and remove every icon we added. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.pending.clear();
    // Only remove elements that are still ours. A page framework may have
    // reused the node for its own content (it would have lost our marker).
    for (const icon of this.icons.keys()) if (isOurHost(icon)) icon.remove();
    this.icons.clear();
    this.seen = new WeakMap();
  }

  /** Icons currently on the page. */
  get iconCount(): number {
    this.sweep();
    return this.icons.size;
  }

  /** Resolves when all queued links have been processed. */
  whenIdle(): Promise<void> {
    if (this.pending.size === 0 && !this.scheduled) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private queueAll(): void {
    for (const a of htmlLinksIn(this.doc)) this.pending.add(a);
    this.schedule();
  }

  private onMutations(records: MutationRecord[]): void {
    if (this.opts.alive && !this.opts.alive()) {
      this.opts.onDead?.();
      return;
    }
    let removed = false;
    for (const r of records) {
      const target = r.target;
      if (r.type === 'attributes') {
        if (target instanceof HTMLAnchorElement) this.pending.add(target);
        continue;
      }
      // Text added or changed inside a link: judge that link again.
      const parent = target instanceof Element ? target : target.parentElement;
      const owner = parent ? closest.call(parent, 'a[href]') : null;
      if (owner instanceof HTMLAnchorElement) this.pending.add(owner);
      if (r.type === 'characterData') continue;

      for (const node of r.addedNodes) {
        if (!(node instanceof Element) || isOurHost(node)) continue;
        if (node instanceof HTMLAnchorElement) this.pending.add(node);
        for (const a of htmlLinksIn(node)) this.pending.add(a);
      }
      if (r.removedNodes.length) removed = true;
    }
    if (removed) this.sweep();
    this.schedule();
  }

  /**
   * Remove icons that are orphaned or no longer next to their link, and
   * queue those links to be judged again.
   */
  private sweep(): void {
    for (const [icon, link] of this.icons) {
      if (icon.isConnected && link.isConnected && link.nextSibling === icon) continue;
      if (isOurHost(icon)) icon.remove();
      this.icons.delete(icon);
      if (link.isConnected) {
        this.seen.delete(link);
        this.pending.add(link);
      }
    }
  }

  private schedule(): void {
    if (this.scheduled || this.pending.size === 0) {
      this.resolveIfIdle();
      return;
    }
    this.scheduled = true;
    const run = () => this.runBatch();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 200 });
    else setTimeout(run, 0);
  }

  private runBatch(): void {
    const t0 = performance.now();
    const accepted: HTMLAnchorElement[] = [];
    let processed = 0;

    // Read pass.
    for (const link of this.pending) {
      this.pending.delete(link);
      processed++;
      if (!link.isConnected) continue;
      const text = link.textContent ?? '';
      const prev = this.seen.get(link);
      const iconInPlace = prev?.icon ? prev.icon.isConnected && link.nextSibling === prev.icon : true;
      if (prev && prev.href === link.href && prev.text === text && iconInPlace) continue;
      if (prev?.icon) {
        if (isOurHost(prev.icon)) prev.icon.remove();
        this.icons.delete(prev.icon);
      }
      const ok = this.opts.accept(link);
      this.seen.set(link, { href: link.href, text });
      if (ok) accepted.push(link);
      // Inserting icons costs time too, so cap both reading and writing.
      if (performance.now() - t0 > BATCH_BUDGET_MS || accepted.length >= MAX_ICONS_PER_BATCH) break;
    }

    // Write pass.
    for (const link of accepted) {
      const icon = this.opts.attach(link);
      this.icons.set(icon, link);
      this.seen.set(link, { href: link.href, text: link.textContent ?? '', icon });
    }

    this.opts.onBatch?.({ processed, added: accepted.length, ms: performance.now() - t0 });
    this.scheduled = false;
    this.schedule();
  }

  private resolveIfIdle(): void {
    if (this.pending.size > 0 || this.scheduled) return;
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    for (const r of resolvers) r();
  }
}

