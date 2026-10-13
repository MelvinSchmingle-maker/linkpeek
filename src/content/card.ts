/**
 * The inline icon and the summary card.
 *
 * Both live in Shadow DOM hosts so page CSS can't break them. The card floats
 * (position: fixed) just under the link, so opening it never pushes page
 * content around. Only one card is open at a time.
 */
import { MSG } from '../core/messages';
import type { FeedbackValue } from '../core/feedback/store';
import { brandCss } from '../ui/theme';
import { icon } from './svg';
import { toCardView, type CardInput, type CardView } from './view-model';
import css from './styles.css?inline';

/** Closed in the shipped build so page scripts can't reach into our UI. Open for automated tests. */
const SHADOW_MODE: ShadowRootMode = __E2E__ ? 'open' : 'closed';
const GAP = 6;
const EDGE = 8;

export const HOST_ATTR = 'data-linkpeek';

function makeShadowHost(kind: 'icon' | 'card'): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement(kind === 'icon' ? 'span' : 'div');
  host.setAttribute(HOST_ATTR, kind);
  const root = host.attachShadow({ mode: SHADOW_MODE });
  const style = document.createElement('style');
  style.textContent = brandCss(':host') + css;
  root.append(style);
  // Keep page click handlers (e.g. "whole teaser is a link") from firing
  // when someone uses our controls.
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  return { host, root };
}

/** Puts the small LinkPeek button right after a link. */
export function attachIcon(link: HTMLAnchorElement, onActivate: (button: HTMLButtonElement) => void): HTMLElement {
  const { host, root } = makeShadowHost('icon');
  // `all: unset` drops page styles but keeps inherited font size, so the
  // icon scales with the headline and with page zoom.
  host.style.cssText =
    'all: unset; display: inline-block; vertical-align: middle; margin-left: 0.3em; line-height: 0;';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon';
  button.setAttribute('aria-label', MSG.iconLabel);
  button.setAttribute('aria-expanded', 'false');
  button.title = MSG.iconLabel;
  button.append(icon('peek'));
  button.addEventListener('click', (e) => {
    e.preventDefault();
    onActivate(button);
  });
  root.append(button);
  link.after(host);
  return host;
}

export interface CardHandlers {
  onClose: () => void;
  onFeedback: (value: FeedbackValue) => void;
}

/** Builds the card's DOM from a view. Pure DOM building, no positioning. */
export function renderCard(view: CardView, href: string, handlers: CardHandlers): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', MSG.cardLabel);
  card.tabIndex = -1;

  // Top row: status, tags, close.
  const top = el('div', 'top');
  if (view.status) {
    const status = el('span', `status ${view.status.verdict}`);
    status.setAttribute('data-status', view.status.verdict);
    status.append(icon(view.status.verdict), text(view.status.label));
    top.append(status);
  }
  if (view.evidenceTag) top.append(el('span', 'tag', view.evidenceTag));
  if (view.isDemo) {
    const demo = el('span', 'tag demo', MSG.demoTag);
    demo.title = MSG.demoTagTitle;
    top.append(demo);
  }
  top.append(el('span', 'spacer'));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', MSG.close);
  close.title = MSG.close;
  close.append(icon('close'));
  close.addEventListener('click', handlers.onClose);
  top.append(close);
  card.append(top);

  if (view.warning) {
    const warning = el('div', 'warning');
    warning.setAttribute('role', 'alert');
    const words = el('div', 'warning-text');
    words.append(el('strong', '', view.warning));
    if (view.warningDetail) words.append(el('span', 'warning-detail', view.warningDetail));
    warning.append(icon('warning'), words);
    card.append(warning);
  }

  // Body. Announced politely when it changes (e.g. loading -> result).
  const body = el('div', 'body');
  body.setAttribute('aria-live', 'polite');
  if (view.loading) {
    const loading = el('div', 'loading');
    loading.append(el('span', 'spinner'), el('p', 'message', view.message ?? MSG.loading));
    body.append(loading);
  } else {
    if (view.summary) body.append(el('p', 'summary', view.summary));
    if (view.message) body.append(el('p', 'message', view.message));
    if (view.preview) body.append(el('p', 'preview', view.preview));
    if (view.reason) body.append(el('p', 'reason', view.reason));
  }
  card.append(body);

  // Footer: open link and feedback.
  if (!view.loading) {
    const footer = el('div', 'footer');
    const open = document.createElement('a');
    open.className = 'open';
    open.href = href;
    open.rel = 'noopener noreferrer';
    open.textContent = view.openLabel;
    footer.append(open, el('span', 'spacer'));
    if (view.showFeedback) footer.append(feedbackControls(handlers.onFeedback));
    card.append(footer);
  }

  return card;
}

function feedbackControls(onFeedback: (v: FeedbackValue) => void): HTMLElement {
  const wrap = el('span', 'feedback');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', MSG.feedbackQuestion);
  wrap.append(el('span', 'question', MSG.feedbackQuestion));
  for (const [value, label, iconName] of [
    ['up', MSG.feedbackUp, 'thumbUp'],
    ['down', MSG.feedbackDown, 'thumbDown'],
  ] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.dataset.value = value;
    b.append(icon(iconName));
    b.addEventListener('click', () => onFeedback(value));
    wrap.append(b);
  }
  return wrap;
}

function el(tag: string, className: string, content?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function text(s: string): HTMLElement {
  return el('span', '', s);
}

/** Owns the single open card: placement, closing, focus. */
export class CardController {
  private host?: HTMLElement;
  private root?: ShadowRoot;
  private anchor?: HTMLAnchorElement;
  private button?: HTMLButtonElement;
  private frame = 0;
  private feedbackHandler?: (value: FeedbackValue) => Promise<void>;

  get openFor(): HTMLAnchorElement | undefined {
    return this.anchor;
  }

  open(
    anchor: HTMLAnchorElement,
    button: HTMLButtonElement,
    input: CardInput,
    onFeedback: (value: FeedbackValue) => Promise<void>,
  ): void {
    this.close({ restoreFocus: false });
    const { host, root } = makeShadowHost('card');
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0;';
    this.host = host;
    this.root = root;
    this.anchor = anchor;
    this.button = button;
    this.feedbackHandler = onFeedback;
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.append(host);
    this.show(input);
    this.root.querySelector<HTMLElement>('.card')?.focus({ preventScroll: true });

    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('scroll', this.schedulePosition, { capture: true, passive: true });
    window.addEventListener('resize', this.schedulePosition, { passive: true });
  }

  /** Replace the card's content (e.g. loading -> result). */
  update(input: CardInput): void {
    if (!this.root) return;
    const hadFocus = this.root.activeElement !== null;
    this.show(input);
    if (hadFocus) this.root.querySelector<HTMLElement>('.card')?.focus({ preventScroll: true });
  }

  close({ restoreFocus }: { restoreFocus: boolean }): void {
    if (!this.host) return;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('scroll', this.schedulePosition, { capture: true });
    window.removeEventListener('resize', this.schedulePosition);
    cancelAnimationFrame(this.frame);
    this.host.remove();
    this.button?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.button?.focus();
    this.host = this.root = this.anchor = this.button = undefined;
  }

  private show(input: CardInput): void {
    if (!this.root || !this.anchor) return;
    this.root.querySelector('.card')?.remove();
    const card = renderCard(toCardView(input), this.anchor.href, {
      onClose: () => this.close({ restoreFocus: true }),
      onFeedback: (value) => void this.giveFeedback(value),
    });
    this.root.append(card);
    this.position();
  }

  private async giveFeedback(value: FeedbackValue): Promise<void> {
    const footerFeedback = this.root?.querySelector('.feedback');
    if (!footerFeedback || !this.feedbackHandler) return;
    let message: string = MSG.feedbackThanks;
    try {
      await this.feedbackHandler(value);
    } catch {
      message = MSG.feedbackFailed;
    }
    const thanks = el('span', 'thanks', message);
    thanks.setAttribute('role', 'status');
    footerFeedback.replaceWith(thanks);
    this.root?.querySelector<HTMLElement>('.card')?.focus({ preventScroll: true });
  }

  private position = (): void => {
    if (!this.host || !this.anchor) return;
    if (!this.anchor.isConnected) {
      this.close({ restoreFocus: false });
      return;
    }
    const rect = this.anchor.getBoundingClientRect();
    const card = this.root?.querySelector<HTMLElement>('.card');
    const width = card?.offsetWidth ?? 360;
    const height = card?.offsetHeight ?? 0;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    let top = rect.bottom + GAP;
    // Not enough room below: put it above the link if that fits better.
    if (top + height > vh - EDGE && rect.top - GAP - height >= EDGE) top = rect.top - GAP - height;
    const left = Math.max(EDGE, Math.min(rect.left, vw - width - EDGE));
    this.host.style.top = `${Math.round(top)}px`;
    this.host.style.left = `${Math.round(left)}px`;
  };

  private schedulePosition = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.position);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close({ restoreFocus: true });
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    const path = e.composedPath();
    const iconHost = this.button?.getRootNode() instanceof ShadowRoot
      ? (this.button.getRootNode() as ShadowRoot).host
      : undefined;
    if (this.host && !path.includes(this.host) && !(iconHost && path.includes(iconHost))) {
      this.close({ restoreFocus: false });
    }
  };
}
