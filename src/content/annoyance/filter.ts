/**
 * The annoyance tools (Part 12) for one page. Each one is separate, off by
 * default, and undoable. Hiding sets display: none !important on the element
 * and records what it was before, so undo puts it back exactly. Nothing is
 * deleted from the page.
 *
 * LinkPeek's own elements are never touched. Login forms, consent banners and
 * anything with a password field are never hidden.
 */
import { HOST_ATTR } from '../card';
import type { AnnoyanceSettings } from '../../core/storage/settings';
import { ANNOYANCE_ATTR, CONSENT_WORDS, SIGN_UP_WORDS, URGENCY_TEXT } from './patterns';

export const TOOLS = ['readingMode', 'signUpOverlays', 'floatingVideo', 'stickyBars', 'urgencyLabels', 'autoplayPause'] as const;
export type Tool = Exclude<keyof AnnoyanceSettings, 'readingMode'>;

/** The tools that change the page itself. Reading mode works in LinkPeek's own panel, so it isn't here. */
export const PAGE_TOOLS: Tool[] = ['signUpOverlays', 'floatingVideo', 'stickyBars', 'urgencyLabels', 'autoplayPause'];

/** Scanning stops here, so a very busy page stays quick. */
const MAX_ELEMENTS = 400;
const MAX_LABELS = 20;
const LABEL_ATTR = 'data-linkpeek-annoyance-label';

type Undo = () => void;

export class AnnoyanceFilter {
  private active = new Set<Tool>();
  private undos: { tool: Tool; undo: Undo }[] = [];

  constructor(private readonly doc: Document) {}

  /** Turns each tool on or off to match the settings. Tools that stay on are left as they are. */
  apply(on: AnnoyanceSettings): void {
    for (const tool of PAGE_TOOLS) {
      if (on[tool] && !this.active.has(tool)) {
        this.active.add(tool);
        this.run(tool);
      } else if (!on[tool] && this.active.has(tool)) {
        this.active.delete(tool);
        this.undoTool(tool);
      }
    }
  }

  /** "Undo on this page": puts back everything hidden or labelled. The tools stay on in settings until the page reloads. */
  undoAll(): void {
    while (this.undos.length) this.undos.pop()!.undo();
    this.active.clear();
  }

  /** How many things are hidden or labelled right now (for the popup and tests). */
  get changed(): number {
    return this.undos.length;
  }

  private run(tool: Tool): void {
    if (tool === 'signUpOverlays') this.hideMatching(tool, (el) => this.isSignUpOverlay(el));
    if (tool === 'floatingVideo') this.hideMatching(tool, (el) => this.isFloatingVideo(el));
    if (tool === 'stickyBars') this.hideMatching(tool, (el) => this.isStickyBar(el));
    if (tool === 'urgencyLabels') this.labelUrgency();
    if (tool === 'autoplayPause') this.pauseAutoplay();
  }

  private undoTool(tool: Tool): void {
    const mine = this.undos.filter((u) => u.tool === tool);
    for (const u of mine) u.undo();
    this.undos = this.undos.filter((u) => u.tool !== tool);
  }

  /** Candidate elements on the page, skipping LinkPeek's own and the document's root. */
  private candidates(selector: string): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const el of this.doc.querySelectorAll<HTMLElement>(selector)) {
      if (el === this.doc.documentElement || el === this.doc.body) continue;
      if (el.closest(`[${HOST_ATTR}]`) || el.hasAttribute(ANNOYANCE_ATTR)) continue;
      out.push(el);
      if (out.length >= MAX_ELEMENTS) break;
    }
    return out;
  }

  private hideMatching(tool: Tool, match: (el: HTMLElement) => boolean): void {
    for (const el of this.candidates('body *')) {
      if (!match(el)) continue;
      this.hide(tool, el);
      // A sign-up box often locks the page's scrolling. Unlock it, so the page still works.
      this.unlockScroll(tool);
    }
  }

  private hide(tool: Tool, el: HTMLElement): void {
    const prevValue = el.style.getPropertyValue('display');
    const prevPriority = el.style.getPropertyPriority('display');
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute(ANNOYANCE_ATTR, tool);
    this.undos.push({
      tool,
      undo: () => {
        el.removeAttribute(ANNOYANCE_ATTR);
        if (prevValue) el.style.setProperty('display', prevValue, prevPriority);
        else el.style.removeProperty('display');
      },
    });
  }

  /** If a box locked scrolling on the page, unlock it. Recorded, so undo puts it back. */
  private unlockScroll(tool: Tool): void {
    for (const root of [this.doc.documentElement, this.doc.body]) {
      const style = this.doc.defaultView?.getComputedStyle(root);
      if (!style || (style.overflow !== 'hidden' && style.overflowY !== 'hidden')) continue;
      const prev = root.style.getPropertyValue('overflow');
      const prevPriority = root.style.getPropertyPriority('overflow');
      root.style.setProperty('overflow', 'auto', 'important');
      this.undos.push({
        tool,
        undo: () => {
          if (prev) root.style.setProperty('overflow', prev, prevPriority);
          else root.style.removeProperty('overflow');
        },
      });
    }
  }

  /** A full-screen box with an email field and sign-up wording, and no password field or consent wording. */
  isSignUpOverlay(el: HTMLElement): boolean {
    const style = this.doc.defaultView?.getComputedStyle(el);
    if (!style || (style.position !== 'fixed' && style.position !== 'absolute')) return false;
    if (!coversMostOfScreen(el, this.doc)) return false;
    if (el.querySelector('input[type="password"]')) return false;
    if (!el.querySelector('input[type="email"], input[autocomplete="email"], input[name*="email" i]')) return false;
    const text = (el.textContent ?? '').slice(0, 2000);
    if (CONSENT_WORDS.test(text)) return false;
    return SIGN_UP_WORDS.test(text);
  }

  /** A video or frame that stays on screen while the page scrolls, outside the article. */
  isFloatingVideo(el: HTMLElement): boolean {
    if (el.tagName !== 'VIDEO' && el.tagName !== 'IFRAME') return false;
    const style = this.doc.defaultView?.getComputedStyle(el);
    if (!style || (style.position !== 'fixed' && style.position !== 'sticky')) return false;
    return !el.closest('article, main, [role="main"]');
  }

  /** A fixed or sticky bar across the top or bottom, big enough to get in the way. Never one with a form. */
  isStickyBar(el: HTMLElement): boolean {
    const win = this.doc.defaultView;
    const style = win?.getComputedStyle(el);
    if (!win || !style) return false;
    if (style.position !== 'fixed' && style.position !== 'sticky') return false;
    if (style.top !== '0px' && style.bottom !== '0px') return false;
    const minHeight = Math.max(80, 0.12 * win.innerHeight);
    if (el.getBoundingClientRect().height < minHeight) return false;
    if (el.querySelector('input, textarea, select, form')) return false;
    if (CONSENT_WORDS.test((el.textContent ?? '').slice(0, 2000))) return false;
    return true;
  }

  /** Adds a note after text that makes an urgency claim. Never hides it, and says we can't verify it. */
  private labelUrgency(): void {
    let count = 0;
    for (const el of this.candidates('p, span, div, li, h1, h2, h3, h4, strong, b')) {
      if (count >= MAX_LABELS) break;
      if (el.children.length > 2) continue;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 160) continue;
      if (!URGENCY_TEXT.some((re) => re.test(text))) continue;
      const note = this.doc.createElement('span');
      note.setAttribute(LABEL_ATTR, '');
      note.setAttribute(ANNOYANCE_ATTR, 'urgencyLabels');
      note.style.cssText = 'display:inline-block;margin-left:6px;font:12px/1.4 system-ui,sans-serif;color:#555;';
      note.textContent = "Urgency claim: LinkPeek can't verify this.";
      el.after(note);
      this.undos.push({ tool: 'urgencyLabels', undo: () => note.remove() });
      count += 1;
    }
  }

  /** Pauses autoplaying media that has its sound on. Undo puts the autoplay setting back, but doesn't start the media. */
  private pauseAutoplay(): void {
    for (const el of this.doc.querySelectorAll<HTMLMediaElement>('video[autoplay], audio[autoplay]')) {
      if (el.muted || el.hasAttribute(ANNOYANCE_ATTR)) continue;
      try {
        el.pause();
      } catch {
        // Some players refuse. Leave them as they are.
        continue;
      }
      el.setAttribute(ANNOYANCE_ATTR, 'autoplayPause');
      el.removeAttribute('autoplay');
      this.undos.push({
        tool: 'autoplayPause',
        undo: () => {
          el.removeAttribute(ANNOYANCE_ATTR);
          el.setAttribute('autoplay', '');
        },
      });
    }
  }
}

/** The box covers at least 40% of the visible screen, from its own size and position. */
function coversMostOfScreen(el: HTMLElement, doc: Document): boolean {
  const win = doc.defaultView;
  if (!win) return false;
  const r = el.getBoundingClientRect();
  const area = Math.max(0, Math.min(r.right, win.innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, win.innerHeight) - Math.max(r.top, 0));
  return area >= 0.4 * win.innerWidth * win.innerHeight;
}
