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

export function readLinkFeatures(link: HTMLAnchorElement): LinkFeatures {
  return {
    href: link.href,
    pageUrl: link.ownerDocument.location?.href ?? '',
    text: linkText(link),
    inHeading: Boolean(link.closest('h1, h2, h3, h4, [role="heading"]') || link.querySelector('h1, h2, h3, h4')),
    inArticle: Boolean(link.closest('article, [role="article"]')),
    inMain: Boolean(link.closest('main, [role="main"]')),
    inParagraph: Boolean(link.closest('p')),
    inNavigation: inNavigation(link),
    isControl: isControl(link),
    imageOnly: isImageOnly(link),
    sponsored: /\bsponsored\b/i.test(link.rel),
  };
}

function linkText(link: HTMLAnchorElement): string {
  // textContent, not innerText: innerText forces a layout per link, which is
  // slow on pages with thousands of links.
  const visible = (link.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (visible) return visible;
  return (link.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
}

function inNavigation(link: HTMLAnchorElement): boolean {
  const nav = link.closest(NAV_SELECTOR);
  if (!nav) return false;
  const article = link.closest(PAGE_LEVEL_EXCEPTIONS);
  // Inside an article's own header: not navigation.
  if (article && article.contains(nav) && (nav.matches('header, footer'))) return false;
  return true;
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
