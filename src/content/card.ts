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
import type { CorrectionsResult } from '../core/source/corrections';
import type { SourceLine } from './view-model';

/** Closed in the shipped build so page scripts can't reach into our UI. Open for automated tests. */
const SHADOW_MODE: ShadowRootMode = __E2E__ ? 'open' : 'closed';
const GAP = 6;
const EDGE = 8;

export const HOST_ATTR = 'data-linkpeek';

/**
 * Host elements use tag names no page markup has: valid custom-element names
 * that are never defined, with a random part chosen per page. DOM-patching
 * frameworks (morphdom, idiomorph, Turbo, LiveView) match nodes by tag, so
 * they can't mistake our icon for one of their own <span>s. The random part
 * stops a page from defining the name in advance (a page-defined element
 * could get hold of our closed shadow root through ElementInternals); if a
 * page defines it anyway, we pick another name.
 */
const HOST_PREFIX = 'linkpeek-';
let hostSuffix = randomSuffix();

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).replace(/^[0-9]+/, '') || 'x';
}

// Read through the prototype: a page <form> with an input named "localName"
// or "hasAttribute" would otherwise answer with that input.
const localNameOf = Object.getOwnPropertyDescriptor(Element.prototype, 'localName')!.get!;
const hasAttr = Element.prototype.hasAttribute;
const matches = Element.prototype.matches;

/** True only for an element LinkPeek created and still owns. */
export function isOurHost(el: Element): boolean {
  if (!hasAttr.call(el, HOST_ATTR)) return false;
  const name = localNameOf.call(el) as string;
  return name.startsWith(HOST_PREFIX) || name === 'span' || name === 'div';
}

function createHostElement(kind: 'icon' | 'card'): HTMLElement {
  for (let attempt = 0; attempt < 5; attempt++) {
    const el = document.createElement(`${HOST_PREFIX}${kind}-${hostSuffix}`);
    // ":defined" is true only if the page registered this name itself.
    if (!matches.call(el, ':defined')) return el;
    hostSuffix = randomSuffix();
  }
  // A page that keeps guessing gets plain elements. Still marked as ours.
  return document.createElement(kind === 'icon' ? 'span' : 'div');
}

/**
 * Inline styles marked !important beat any page stylesheet, even the page's
 * own !important rules, so a page can't hide or move our UI.
 */
function setImportant(el: HTMLElement, styles: Record<string, string>): void {
  for (const [prop, value] of Object.entries(styles)) el.style.setProperty(prop, value, 'important');
}

/** Only web links get an "Open" link in the card (never javascript:, data: and the like). */
export function isWebUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function makeShadowHost(kind: 'icon' | 'card'): { host: HTMLElement; root: ShadowRoot } {
  const host = createHostElement(kind);
  host.setAttribute(HOST_ATTR, kind);
  const root = host.attachShadow({ mode: SHADOW_MODE });
  const style = document.createElement('style');
  style.textContent = brandCss(':host', true) + css;
  root.append(style);
  // Keep page click handlers (e.g. "whole teaser is a link") from firing
  // when someone uses our controls.
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  return { host, root };
}

/** Puts the small LinkPeek button right after a link. */
export function attachIcon(
  link: HTMLAnchorElement,
  onActivate: (button: HTMLButtonElement) => void,
): { host: HTMLElement; button: HTMLButtonElement } {
  const { host, root } = makeShadowHost('icon');
  // `all: unset` drops page styles but keeps inherited font size, so the
  // icon scales with the headline and with page zoom.
  setImportant(host, {
    all: 'unset',
    display: 'inline-block',
    'vertical-align': 'middle',
    'margin-left': '0.3em',
    'line-height': '0',
    opacity: '1',
    // No forced visibility: an icon must stay hidden when its link is
    // (e.g. a faded-out carousel slide), so it inherits visibility.
  });
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
  return { host, button };
}

export interface CardHandlers {
  onClose: () => void;
  onFeedback: (value: FeedbackValue) => void;
  onAction?: () => void;
  /** Looks for the site's corrections page. Only ever asked for by the user's button. */
  onCorrections?: () => Promise<CorrectionsResult>;
}

/** What the card's owner wants to hear about. */
export interface CardCallbacks {
  onFeedback: (value: FeedbackValue) => Promise<void>;
  /** The card closed (for any reason). */
  onClosed?: () => void;
  /** The card's button (e.g. "Allow access…") was pressed. */
  onAction?: () => void;
  /** The user asked for the site's corrections page. */
  onCorrections?: () => Promise<CorrectionsResult>;
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
  const definitions = view.showDefinitions ? definitionsBlock() : undefined;
  const source = view.sourceLines ? sourceBlock(view.sourceLines, handlers) : undefined;
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
    if (view.summary) {
      if (view.summaryLabel) body.append(el('p', 'summary-label', view.summaryLabel));
      body.append(el('p', 'summary', view.summary));
    }
    if (view.extract) {
      body.append(el('p', 'extract-label', view.extractLabel ?? ''), el('p', 'extract', view.extract));
    }
    if (view.message) body.append(el('p', 'message', view.message));
    if (view.preview) body.append(el('p', 'preview', view.preview));
    if (view.reason) body.append(el('p', 'reason', view.reason));
    if (view.rewrite) {
      body.append(el('p', 'rewrite-label', view.rewriteLabel ?? ''), el('p', 'rewrite', view.rewrite));
      if (view.revealNote) body.append(el('p', 'reveal-note', view.revealNote));
    }
    if (view.note) body.append(el('p', 'note', view.note));
    if (view.action && handlers.onAction) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'action';
      action.textContent = view.action;
      action.addEventListener('click', handlers.onAction);
      body.append(action);
    }
  }
  // Both explainers share one line, after the close button in reading order, so Tab reaches Close first.
  if (definitions || source) {
    const row = el('div', 'explainers');
    if (definitions) row.append(definitions.toggle);
    if (source) row.append(source.toggle);
    body.append(row);
  }
  card.append(body);
  if (definitions) card.append(definitions.panel);
  if (source) card.append(source.panel);

  // Footer: open link and feedback.
  if (!view.loading && (isWebUrl(href) || view.showFeedback)) {
    const footer = el('div', 'footer');
    if (isWebUrl(href)) {
      const open = document.createElement('a');
      open.className = 'open';
      open.href = href;
      open.rel = 'noopener noreferrer';
      open.textContent = view.openLabel;
      footer.append(open);
    }
    footer.append(el('span', 'spacer'));
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

/** A toggle that opens a panel under the card. The panel is built the first time it's opened, so a shut panel costs nothing. */
function explainerToggle(
  label: string,
  toggleClass: string,
  panelClass: string,
  fill: (panel: HTMLElement) => void,
): { toggle: HTMLElement; panel: HTMLElement } {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = toggleClass;
  toggle.textContent = label;
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', panelClass);
  panel.hidden = true;
  let filled = false;
  toggle.addEventListener('click', () => {
    if (!filled) {
      filled = true;
      fill(panel);
    }
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return { toggle, panel };
}

/** "What does this mean?": the three outcomes. */
function definitionsBlock(): { toggle: HTMLElement; panel: HTMLElement } {
  return explainerToggle(MSG.whatDoesThisMean, 'definitions-toggle', 'definitions', (panel) => {
    panel.append(el('p', 'definitions-intro', MSG.definitionsIntro));
    for (const [term, meaning] of MSG.verdictDefinitions) {
      const line = el('p', 'definition');
      line.append(el('strong', '', term), text(` ${meaning}`));
      panel.append(line);
    }
  });
}

/** "About this source": what the page discloses, each fact with where it came from, and the corrections check. */
function sourceBlock(lines: SourceLine[], handlers: CardHandlers): { toggle: HTMLElement; panel: HTMLElement } {
  return explainerToggle(MSG.aboutSource, 'source-toggle', 'source', (panel) => {
    panel.append(el('p', 'source-note', MSG.sourceNote));
    for (const l of lines) {
      const row = el('p', 'source-line');
      row.append(el('strong', 'source-label', l.label), text(' '), el('span', 'source-value', l.value));
      if (l.from) row.append(el('span', 'source-from', ` (${l.from})`));
      panel.append(row);
    }
    panel.append(correctionsRow(handlers));
  });
}

/** The corrections check: asked for by a button, never run on its own. */
function correctionsRow(handlers: CardHandlers): HTMLElement {
  const row = el('div', 'corrections');
  const label = el('strong', 'source-label', MSG.correctionsLabel);
  const status = el('p', 'corrections-status', MSG.correctionsNotChecked);
  const look = document.createElement('button');
  look.type = 'button';
  look.className = 'corrections-look';
  look.textContent = MSG.lookForCorrections;
  look.addEventListener('click', async () => {
    look.disabled = true;
    status.textContent = MSG.lookingForCorrections;
    const result: CorrectionsResult = (await handlers.onCorrections?.().catch(() => undefined)) ?? { kind: 'error' };
    look.disabled = false;
    status.replaceChildren(...correctionsNodes(result, handlers));
  });
  row.append(label, status, look);
  return row;
}

function correctionsNodes(result: CorrectionsResult, handlers: CardHandlers): Node[] {
  switch (result.kind) {
    case 'found': {
      const link = document.createElement('a');
      link.href = result.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = new URL(result.url).pathname;
      return [text(`${MSG.correctionsFound} `), link];
    }
    case 'not-found':
      return [text(MSG.correctionsNotFound)];
    case 'needs-access': {
      const nodes: Node[] = [text(MSG.correctionsNeedAccess)];
      if (handlers.onAction) {
        const allow = document.createElement('button');
        allow.type = 'button';
        allow.className = 'action';
        allow.textContent = MSG.allow;
        allow.addEventListener('click', handlers.onAction);
        nodes.push(allow);
      }
      return nodes;
    }
    case 'error':
      return [text(MSG.correctionsError)];
  }
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
  private callbacks?: CardCallbacks;

  get openFor(): HTMLAnchorElement | undefined {
    return this.anchor;
  }

  /** Focus the open card (used when the user asks to peek at the same link again). */
  focus(): void {
    this.root?.querySelector<HTMLElement>('.card')?.focus({ preventScroll: true });
  }

  open(
    anchor: HTMLAnchorElement,
    button: HTMLButtonElement,
    input: CardInput,
    callbacks: CardCallbacks,
  ): void {
    this.close({ restoreFocus: false });
    // A link that has left the page, or isn't drawn, has nowhere to anchor a card.
    if (!anchor.isConnected || anchor.getClientRects().length === 0) {
      callbacks.onClosed?.();
      return;
    }
    this.callbacks = callbacks;
    const { host, root } = makeShadowHost('card');
    setImportant(host, {
      all: 'initial',
      position: 'fixed',
      'z-index': '2147483647',
      top: '0px',
      left: '0px',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      direction: 'ltr',
      'unicode-bidi': 'isolate',
    });
    this.host = host;
    this.root = root;
    this.anchor = anchor;
    this.button = button;
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.append(host);
    this.show(input);
    this.focus();

    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('focusin', this.onFocusIn, true);
    window.addEventListener('scroll', this.schedulePosition, { capture: true, passive: true });
    window.addEventListener('resize', this.schedulePosition, { passive: true });
  }

  /** Replace the card's content (e.g. loading -> result). */
  update(input: CardInput): void {
    if (!this.root) return;
    const hadFocus = this.root.activeElement !== null;
    this.show(input);
    if (hadFocus) this.focus();
  }

  close({ restoreFocus }: { restoreFocus: boolean }): void {
    if (!this.host) return;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('focusin', this.onFocusIn, true);
    window.removeEventListener('scroll', this.schedulePosition, { capture: true });
    window.removeEventListener('resize', this.schedulePosition);
    cancelAnimationFrame(this.frame);
    this.host.remove();
    this.button?.setAttribute('aria-expanded', 'false');
    const { button, anchor, callbacks } = this;
    this.host = this.root = this.anchor = this.button = this.callbacks = undefined;
    callbacks?.onClosed?.();
    // Back to the icon, or to the link if the icon was temporary.
    if (restoreFocus) (button?.isConnected ? button : anchor)?.focus();
  }

  private show(input: CardInput): void {
    if (!this.root || !this.anchor) return;
    this.root.querySelector('.card')?.remove();
    const card = renderCard(toCardView(input), this.anchor.href, {
      onClose: () => this.close({ restoreFocus: true }),
      onFeedback: (value) => void this.giveFeedback(value),
      onAction: () => this.callbacks?.onAction?.(),
      onCorrections: () => this.callbacks?.onCorrections?.() ?? Promise.resolve({ kind: 'error' }),
    });
    this.root.append(card);
    this.position();
  }

  private async giveFeedback(value: FeedbackValue): Promise<void> {
    const footerFeedback = this.root?.querySelector('.feedback');
    const onFeedback = this.callbacks?.onFeedback;
    if (!footerFeedback || !onFeedback) return;
    let message: string = MSG.feedbackThanks;
    try {
      await onFeedback(value);
    } catch {
      message = MSG.feedbackFailed;
    }
    const thanks = el('span', 'thanks', message);
    thanks.setAttribute('role', 'status');
    footerFeedback.replaceWith(thanks);
    this.focus();
  }

  private position = (): void => {
    if (!this.host || !this.anchor) return;
    // The link left the page or stopped being drawn (e.g. a carousel slide
    // was hidden): close rather than float, attached to nothing.
    if (!this.anchor.isConnected || this.anchor.getClientRects().length === 0) {
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
    setImportant(this.host, { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  };

  private schedulePosition = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.position);
  };

  /** Is this event happening inside LinkPeek's card or the open card's icon? */
  private fromOurUi(e: Event): boolean {
    const path = e.composedPath();
    const iconHost = this.button?.getRootNode() instanceof ShadowRoot
      ? (this.button.getRootNode() as ShadowRoot).host
      : undefined;
    return Boolean((this.host && path.includes(this.host)) || (iconHost && path.includes(iconHost)));
  }

  // Escape belongs to whatever has focus. Only close when that's our card or
  // icon, and leave the page's own Escape handling alone otherwise.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.fromOurUi(e)) return;
    e.stopPropagation();
    this.close({ restoreFocus: true });
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.fromOurUi(e)) this.close({ restoreFocus: false });
  };

  // Focus moved to something on the page (Tab out of the card, or the page
  // focused its own dialog): the card is no longer what the user is using.
  private onFocusIn = (e: FocusEvent): void => {
    if (!this.fromOurUi(e)) this.close({ restoreFocus: false });
  };
}
