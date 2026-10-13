/**
 * Finds links worth an icon, on load and as pages change (infinite feeds,
 * single-page apps), without slowing the page down.
 *
 * - Each link is judged once. If its href changes, or a framework re-render
 *   removes our icon, it is judged again.
 * - Work is done in small time-boxed batches so a page with thousands of
 *   links stays responsive.
 * - Reads (classifying) and writes (inserting icons) are done in separate
 *   passes, so the browser doesn't have to re-layout between links.
 */
import { HOST_ATTR } from './card';

export interface ScannerOptions {
  /** Should this link get an icon? */
  accept: (link: HTMLAnchorElement) => boolean;
  /** Put the icon on the link. Returns the icon host element. */
  attach: (link: HTMLAnchorElement) => HTMLElement;
  /** Called after each batch (used for timing in tests). */
  onBatch?: (stats: { processed: number; added: number; ms: number }) => void;
}

/** Max time per batch before yielding back to the page. */
const BATCH_BUDGET_MS = 8;
const MAX_ICONS_PER_BATCH = 40;

interface Seen {
  href: string;
  icon?: HTMLElement;
}

export class LinkScanner {
  private seen = new WeakMap<HTMLAnchorElement, Seen>();
  private pending = new Set<HTMLAnchorElement>();
  private observer?: MutationObserver;
  private scheduled = false;
  private icons = new Set<HTMLElement>();
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
    for (const icon of this.icons) icon.remove();
    this.icons.clear();
    this.seen = new WeakMap();
  }

  /** Icons currently on the page. */
  get iconCount(): number {
    for (const icon of this.icons) if (!icon.isConnected) this.icons.delete(icon);
    return this.icons.size;
  }

  /** Resolves when all queued links have been processed. */
  whenIdle(): Promise<void> {
    if (this.pending.size === 0 && !this.scheduled) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private queueAll(): void {
    for (const a of this.doc.querySelectorAll<HTMLAnchorElement>('a[href]')) this.pending.add(a);
    this.schedule();
  }

  private onMutations(records: MutationRecord[]): void {
    for (const r of records) {
      if (r.type === 'attributes' && r.target instanceof HTMLAnchorElement) {
        this.pending.add(r.target);
        continue;
      }
      for (const node of r.addedNodes) {
        if (!(node instanceof Element) || node.hasAttribute(HOST_ATTR)) continue;
        if (node instanceof HTMLAnchorElement) this.pending.add(node);
        for (const a of node.querySelectorAll<HTMLAnchorElement>('a[href]')) this.pending.add(a);
      }
      for (const node of r.removedNodes) {
        // A framework re-render removed one of our icons: re-check its link.
        if (node instanceof HTMLElement && node.getAttribute(HOST_ATTR) === 'icon' && this.icons.has(node)) {
          this.icons.delete(node);
          const link = r.previousSibling;
          if (link instanceof HTMLAnchorElement && link.isConnected) {
            this.seen.delete(link);
            this.pending.add(link);
          }
        }
      }
    }
    this.schedule();
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
      const prev = this.seen.get(link);
      if (prev && prev.href === link.href && (!prev.icon || prev.icon.isConnected)) continue;
      if (prev?.icon) {
        prev.icon.remove();
        this.icons.delete(prev.icon);
      }
      const ok = this.opts.accept(link);
      this.seen.set(link, { href: link.href });
      if (ok) accepted.push(link);
      // Inserting icons costs time too, so cap both reading and writing.
      if (performance.now() - t0 > BATCH_BUDGET_MS || accepted.length >= MAX_ICONS_PER_BATCH) break;
    }

    // Write pass.
    for (const link of accepted) {
      const icon = this.opts.attach(link);
      this.icons.add(icon);
      this.seen.set(link, { href: link.href, icon });
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
