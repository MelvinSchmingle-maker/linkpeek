/**
 * Reads the facts the classifier needs from a link element. Kept separate
 * from the classifier so the scoring rules stay pure and testable.
 */
import type { LinkFeatures } from './classify';

const NAV_SELECTOR = [
  'nav',
  'header',
  'footer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tablist"]',
  '[aria-label*="breadcrumb" i]',
].join(',');

// Headers and footers inside an article are part of the article (e.g. a
// headline inside <article><header><h2><a>). Only page-level ones count.
const PAGE_LEVEL_EXCEPTIONS = 'article, [role="article"]';

const CONTROL_ROLES = new Set(['button', 'tab', 'menuitem', 'option', 'switch']);

/**
 * Text that's only there for screen readers, or hidden. Not part of what the
 * link says on screen. (aria-hidden text IS on screen, it's just skipped by
 * screen readers, so it counts.)
 */
const HIDDEN_TEXT = '.screen-reader-text, .sr-only, .visually-hidden, .visuallyhidden, .a11y-hidden, [hidden]';

// Called through the prototype: page elements found by closest() can be a
// <form> whose named inputs ("matches", "contains") hide these methods.
const matchesFn = Element.prototype.matches;
const containsFn = Node.prototype.contains;
const closestFn = Element.prototype.closest;

export function readLinkFeatures(link: HTMLAnchorElement): LinkFeatures {
  const text = linkText(link);
  return {
    href: link.href,
    pageUrl: link.ownerDocument.location?.href ?? '',
    text,
    inHeading: Boolean(link.closest('h1, h2, h3, h4, [role="heading"]') || link.querySelector('h1, h2, h3, h4')),
    inArticle: Boolean(link.closest('article, [role="article"]')),
    inMain: Boolean(link.closest('main, [role="main"]')),
    inParagraph: inRunningText(link, text),
    isParagraphTitle: isParagraphTitle(link, text),
    inAside: inAside(link),
    inNavigation: inNavigation(link),
    isControl: isControl(link),
    imageOnly: isImageOnly(link),
    sponsored: /\bsponsored\b/i.test(link.rel),
  };
}

function linkText(link: HTMLAnchorElement): string {
  // textContent, not innerText: innerText forces a layout per link, which is
  // slow on pages with thousands of links. Skip screen-reader-only text, so
  // "Continue reading <span class=screen-reader-text>Title</span>" reads as
  // "Continue reading".
  const all = link.textContent ?? '';
  const raw = link.children.length && link.querySelector(HIDDEN_TEXT) ? visibleText(link) : all;
  // If everything was screen-reader-only text, that text is all there is.
  const visible = (raw.trim() ? raw : all).replace(/\s+/g, ' ').trim();
  if (visible) return visible;
  return (link.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
}

function inNavigation(link: HTMLAnchorElement): boolean {
  const nav = link.closest(NAV_SELECTOR);
  if (!nav) return false;
  const article = link.closest(PAGE_LEVEL_EXCEPTIONS);
  // Inside an article's own header: not navigation.
  if (article && containsFn.call(article, nav) && matchesFn.call(nav, 'header, footer')) return false;
  return true;
}

function visibleText(root: Element): string {
  let out = '';
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !closestFn.call(parent, HIDDEN_TEXT)) out += node.nodeValue ?? '';
  }
  return out;
}

/**
 * Running text: the link sits in a paragraph that has plenty of other words
 * around it. A paragraph that is mostly the link (old Reddit puts every post
 * title in <p class="title">) is a headline, not running text.
 */
function inRunningText(link: HTMLAnchorElement, text: string): boolean {
  const p = link.closest('p');
  if (!p) return false;
  const paragraph = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length < paragraph.length * 0.6;
}

/** The link is most of its paragraph: a title line rather than a link in running text. */
function isParagraphTitle(link: HTMLAnchorElement, text: string): boolean {
  const p = link.closest('p');
  if (!p) return false;
  const paragraph = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.length >= paragraph.length * 0.6;
}

/** A page sidebar (not a sidebar box inside an article). */
function inAside(link: HTMLAnchorElement): boolean {
  const aside = link.closest('aside, [role="complementary"]');
  if (!aside) return false;
  const article = link.closest(PAGE_LEVEL_EXCEPTIONS);
  return !(article && containsFn.call(article, aside));
}

function isControl(link: HTMLAnchorElement): boolean {
  const role = link.getAttribute('role');
  if (role && CONTROL_ROLES.has(role)) return true;
  return link.hasAttribute('aria-haspopup') || link.hasAttribute('aria-controls');
}

function isImageOnly(link: HTMLAnchorElement): boolean {
  const text = (link.textContent ?? '').trim();
  return text.length === 0 && Boolean(link.querySelector('img, svg, picture'));
}
