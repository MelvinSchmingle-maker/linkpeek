/**
 * Story Search, stage 1: everything the page itself says about a link,
 * without opening the link.
 *
 * Six kinds of clue, each tagged with where it came from and how sure we are:
 *  A. the link: text, title, image alt, address (url.ts);
 *  B. the article card around it: heading, teaser, labels, caption, nearby text;
 *  C. structured data on this page that describes this exact link;
 *  D. this page's own metadata, only when it is about the same story;
 *  E. text the user selected;
 *  (F, the web search itself, happens on LinkPeek's server.)
 *
 * It reads the smallest container around the link, never the whole page, and
 * never form fields, editable areas or hidden text. Emails and phone numbers
 * are removed from every text clue.
 *
 * Runs in the content script. Reads the DOM only; changes nothing.
 */
import { linkText as visibleLinkText } from '../detect/features';
import { analyseUrl } from './url';
import type { Clue, ClueSource, Confidence, PageRelation, StoryClues } from './types';
import { clip, contentWords, isDescriptive, isGenericText, overlap, redact } from './words';

const MAX_HEADLINE = 300;
const MAX_DESCRIPTION = 500;
const MAX_CONTEXT = 600;
const MAX_SELECTION = 1000;
/** A container with more text than this is a page section, not one story's card. */
const MAX_CARD_CHARS = 2500;
/** How far up from the link to look for its card. */
const MAX_CARD_DEPTH = 7;
const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
const CARD_HINT = /(^|[\s_-])(card|teaser|promo|story|item|tile|post|entry|result|article|media|feed-item|headline-item)([\s_-]|$)/i;
const TEASER_CLASS = '[class*="summary" i], [class*="standfirst" i], [class*="dek" i], [class*="teaser" i], [class*="description" i], [class*="excerpt" i], [class*="intro" i], [class*="lede" i], [class*="strap" i]';
const LABEL_CLASS = '[class*="kicker" i], [class*="eyebrow" i], [class*="label" i], [class*="category" i], [class*="section" i], [class*="tag" i], [class*="topic" i]';
/** Never read from these. */
const PRIVATE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [type="password"], script, style, noscript, template';
const HIDDEN = '[hidden], [aria-hidden="true"], .sr-only, .visually-hidden, .screen-reader-text';
const NAV = 'nav, [role="navigation"], [role="menu"], [role="menubar"]';
const MAX_JSONLD_CHARS = 300_000;

// Through the prototype: a page <form> with an input named "closest" must not answer.
const closestFn = Element.prototype.closest;
const containsFn = Node.prototype.contains;
const matchesFn = Element.prototype.matches;
const is = (el: Element, selector: string): boolean => matchesFn.call(el, selector);

export interface ExtractOptions {
  /** Text the user had selected when they asked, if any. */
  selection?: string;
}

export function extractStoryClues(link: HTMLAnchorElement, opts: ExtractOptions = {}): StoryClues | undefined {
  const doc = link.ownerDocument;
  const facts = analyseUrl(link.href);
  if (!facts) return undefined;

  const clues: StoryClues = {
    href: link.href,
    url: facts.sendable,
    site: facts.site,
    shortened: facts.shortened,
    unwrapped: facts.unwrapped,
    altHeadlines: [],
    keywords: [],
    pageRelation: 'unknown',
  };
  const lang = doc.documentElement.getAttribute('lang')?.trim();
  if (lang && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/.test(lang)) clues.language = lang;

  // A. The link itself.
  const text = clean(visibleLinkText(link), MAX_HEADLINE);
  // Link text that is just an address ("https://paper.example.org/2025/10/19/louvre-…", common on social media)
  // isn't a headline: its words are read from the address itself, as the slug.
  if (text) clues.linkText = clue(text, 'link-text', isDescriptive(text) && !looksLikeAddress(text) ? 'high' : 'low');
  const title = clean(link.getAttribute('title') ?? '', MAX_HEADLINE);
  const alt = clean([...link.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt') ?? '').join(' '), MAX_HEADLINE);
  if (facts.slugWords) clues.slug = clue(facts.slugWords, 'url-slug', 'medium');
  if (facts.date) clues.date = clue(facts.date, 'url-date', 'medium');

  // B. The card around it.
  const card = findCard(link);
  const cardHeading = card ? headingIn(card, link) : undefined;
  const above = cardHeading ? undefined : headingAbove(link);
  const teaser = card ? teaserIn(card, link, cardHeading) : undefined;
  const label = card ? labelIn(card) : undefined;
  const time = card?.querySelector('time[datetime]')?.getAttribute('datetime')?.trim();
  const caption = card ? clean(card.querySelector('figcaption')?.textContent ?? '', MAX_DESCRIPTION) : '';
  const context = surroundingText(link, card, [text, cardHeading?.text, teaser?.text]);

  // C and D. Metadata.
  const linked = linkedMetadata(doc, facts.cleaned);
  const page = pageMetadata(doc);
  const samePage = isSamePage(doc, facts.cleaned, page.canonical);

  // Headline: the fallback hierarchy. Descriptive link text first, then
  // structured data for this exact link, then the card's heading, then a
  // heading just above, then the address's words.
  const candidates: Clue[] = [];
  if (clues.linkText && clues.linkText.confidence === 'high') candidates.push(clues.linkText);
  if (title && isDescriptive(title)) candidates.push(clue(title, 'link-title', 'high'));
  if (linked.headline) candidates.push(clue(linked.headline, 'linked-metadata', 'high'));
  if (samePage && page.headline) candidates.push(clue(page.headline, 'page-metadata', 'high'));
  if (cardHeading && isDescriptive(cardHeading.text)) candidates.push(clue(cardHeading.text, 'card-heading', cardHeading.confidence));
  if (above && isDescriptive(above)) candidates.push(clue(above, 'heading-above', 'medium'));
  if (alt && isDescriptive(alt)) candidates.push(clue(alt, 'image-alt', 'medium'));

  // D. This page's own headline belongs to this page, not the link. Use it only
  // when the link points here, or when it clearly shares the link's words.
  const linkWords = [text, title, linked.headline, cardHeading?.text, above, teaser?.text, facts.slugWords, opts.selection]
    .filter(Boolean)
    .join(' ');
  clues.pageRelation = samePage ? 'same-page' : page.headline ? relation(page.headline, linkWords) : 'unknown';
  if (!samePage && clues.pageRelation === 'related' && page.headline) {
    candidates.push(clue(page.headline, 'page-metadata', 'low'));
  }
  if (!samePage && clues.pageRelation === 'related' && !page.headline && page.title) {
    candidates.push(clue(page.title, 'page-title', 'low'));
  }

  const unique = dedupe(candidates);
  if (unique[0]) clues.headline = unique[0];
  clues.altHeadlines = unique.slice(1, 4);

  // Description: the link's own structured data, then the card's teaser, then
  // this page's description when this page is the link.
  if (linked.description) clues.description = clue(clean(linked.description, MAX_DESCRIPTION), 'linked-metadata', 'high');
  else if (teaser) clues.description = clue(teaser.text, 'card-teaser', 'medium');
  else if (samePage && page.description) clues.description = clue(clean(page.description, MAX_DESCRIPTION), 'page-metadata', 'high');
  else if (caption && isDescriptive(caption)) clues.description = clue(caption, 'caption', 'low');

  if (context && !alreadySaid(context, [clues.headline?.text, clues.description?.text])) {
    clues.context = clue(context, 'surrounding-text', 'low');
  }

  // Dates: structured data for the link beats a <time> in its card, which beats the address.
  const linkedDate = isoDay(linked.published);
  const cardDate = isoDay(time);
  const pageDate = samePage ? isoDay(page.published) : undefined;
  if (linkedDate) clues.date = clue(linkedDate, 'linked-metadata', 'high');
  else if (pageDate) clues.date = clue(pageDate, 'page-metadata', 'high');
  else if (cardDate) clues.date = clue(cardDate, 'card-label', 'high');

  const meta = samePage ? page : undefined;
  const publisher = linked.publisher ?? meta?.siteName ?? (sameSite(doc, facts.site) ? page.siteName : undefined);
  if (publisher) clues.publisher = clue(clean(publisher, 100), linked.publisher ? 'linked-metadata' : 'page-metadata', 'medium');
  const author = linked.author ?? meta?.author;
  if (author) clues.author = clue(clean(author, 100), linked.author ? 'linked-metadata' : 'page-metadata', 'medium');
  const section = linked.section ?? meta?.section ?? label;
  if (section) clues.section = clue(clean(section, 60), linked.section ? 'linked-metadata' : meta?.section ? 'page-metadata' : 'card-label', 'low');
  clues.keywords = (linked.keywords.length ? linked.keywords : (meta?.keywords ?? [])).slice(0, 10);

  // E. The user's selection.
  const selection = clean(opts.selection ?? '', MAX_SELECTION);
  if (selection && contentWords(selection).length >= 2) clues.selection = clue(selection, 'selection', 'medium');

  return clues;
}

// ---------- Clues ----------

/** "https://site/path", "www.site.org/path" or "site.org/path/more": an address, not words. */
function looksLikeAddress(text: string): boolean {
  const t = text.trim();
  return /^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(t);
}

function clue(text: string, from: ClueSource, confidence: Confidence): Clue {
  return { text, from, confidence };
}

function clean(text: string, max: number): string {
  return clip(redact(text.replace(/\s+/g, ' ').trim()), max);
}

/** Same words in a different order or case count once. */
function dedupe(list: Clue[]): Clue[] {
  const out: Clue[] = [];
  for (const c of list) {
    const key = contentWords(c.text).sort().join(' ');
    if (!key) continue;
    if (out.some((o) => contentWords(o.text).sort().join(' ') === key)) continue;
    out.push(c);
  }
  return out;
}

function alreadySaid(text: string, others: (string | undefined)[]): boolean {
  return others.some((o) => o && overlap(text, o) > 0.8);
}

function relation(pageHeadline: string, linkWords: string): PageRelation {
  if (!contentWords(linkWords).length) return 'unknown';
  // Most of the page headline's words are in what the link says: same story.
  return overlap(pageHeadline, linkWords) >= 0.5 && overlap(linkWords, pageHeadline) >= 0.25 ? 'related' : 'unrelated';
}

function isoDay(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m = v.match(/^((?:19|20)\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
}

// ---------- The card ----------

function isHidden(el: Element): boolean {
  return Boolean(closestFn.call(el, HIDDEN));
}

/** Text of an element, skipping hidden text, form fields and editable areas. */
function textOf(el: Element, skip?: Element): string {
  let out = '';
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || closestFn.call(parent, PRIVATE) || closestFn.call(parent, HIDDEN)) continue;
    if (skip && containsFn.call(skip, node)) continue;
    out += ` ${node.nodeValue ?? ''}`;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * The smallest container around the link that holds one story: an <article>
 * or list item, or a box with "card", "teaser" or "story" in its class, or the
 * first box with a heading. A container with several headings or lots of text
 * is a section of the page, so the search stops below it.
 */
function findCard(link: HTMLAnchorElement): Element | undefined {
  let el: Element | null = link.parentElement;
  for (let depth = 0; el && depth < MAX_CARD_DEPTH; depth++, el = el.parentElement) {
    if (el === el.ownerDocument.body || is(el, 'main, [role="main"], body, html')) return undefined;
    if (closestFn.call(el, NAV)) return undefined;
    const length = (el.textContent ?? '').length;
    if (length > MAX_CARD_CHARS) return undefined;
    const headings = el.querySelectorAll(HEADING).length;
    if (headings > 2) return undefined;
    if (is(el, 'article, [role="article"], li') || CARD_HINT.test(el.getAttribute('class') ?? '')) return el;
    if (headings >= 1) return el;
  }
  return undefined;
}

function headingIn(card: Element, link: HTMLAnchorElement): { text: string; confidence: Confidence } | undefined {
  // The link is inside the heading: that heading is its headline.
  const own = closestFn.call(link, HEADING);
  if (own && !isHidden(own)) {
    const t = clean(textOf(own), MAX_HEADLINE);
    if (t) return { text: t, confidence: 'high' };
  }
  const headings = [...card.querySelectorAll(HEADING)].filter((h) => !isHidden(h));
  const titled = headings.length ? headings : [...card.querySelectorAll('[class*="headline" i], [class*="title" i]')].filter((h) => !isHidden(h));
  const first = titled[0];
  if (!first) return undefined;
  const t = clean(textOf(first), MAX_HEADLINE);
  return t ? { text: t, confidence: headings.length === 1 ? 'high' : 'medium' } : undefined;
}

/**
 * A heading just before the link: in the previous few siblings of the link or
 * its parents. Never inside another story's card: a bare "Read more" after a
 * list of articles must not borrow the last article's headline.
 */
function headingAbove(link: HTMLAnchorElement): string | undefined {
  let el: Element | null = link;
  for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
    if (is(el, 'main, body')) break;
    let sib = el.previousElementSibling;
    for (let i = 0; sib && i < 3; i++, sib = sib.previousElementSibling) {
      if (closestFn.call(sib, NAV) || isHidden(sib)) continue;
      if (is(sib, 'article, [role="article"], li, section') || CARD_HINT.test(sib.getAttribute('class') ?? '')) return undefined;
      const h = is(sib, HEADING) ? sib : [...sib.querySelectorAll(HEADING)].pop();
      if (h) {
        const t = clean(textOf(h), MAX_HEADLINE);
        if (t) return t;
      }
    }
  }
  return undefined;
}

function teaserIn(card: Element, link: HTMLAnchorElement, heading?: { text: string }): { text: string } | undefined {
  const candidates = [...card.querySelectorAll(`${TEASER_CLASS}, p`)].filter((p) => !isHidden(p) && !is(p, HEADING));
  for (const p of candidates) {
    const t = clean(textOf(p), MAX_DESCRIPTION);
    if (contentWords(t).length < 5) continue;
    if (heading && overlap(t, heading.text) > 0.8) continue;
    // A paragraph holding the link is running text (sent as nearby text), not a teaser.
    if (containsFn.call(p, link)) continue;
    return { text: t };
  }
  return undefined;
}

function labelIn(card: Element): string | undefined {
  for (const el of card.querySelectorAll(LABEL_CLASS)) {
    if (isHidden(el) || el.querySelector(HEADING)) continue;
    const t = textOf(el);
    const n = t.split(/\s+/).filter(Boolean).length;
    if (n >= 1 && n <= 4 && !isGenericText(t)) return t;
  }
  return undefined;
}

/**
 * The words around the link. For a link in running text: the sentence it
 * sits in and the ones either side. For a link in a card: the card's text
 * that isn't already the heading or teaser. Capped.
 */
function surroundingText(link: HTMLAnchorElement, card: Element | undefined, known: (string | undefined)[]): string | undefined {
  const block = closestFn.call(link, 'p, li, blockquote, dd, td, figcaption');
  if (block && !closestFn.call(block, NAV)) {
    const full = textOf(block);
    const own = textOf(link);
    if (full.length > own.length * 1.5) return clean(window3(full, own), MAX_CONTEXT);
  }
  if (!card) return undefined;
  let rest = textOf(card);
  for (const k of known) if (k) rest = rest.replace(k.replace(/…$/, ''), ' ');
  rest = rest.replace(/\s+/g, ' ').trim();
  return contentWords(rest).length >= 4 ? clean(rest, MAX_CONTEXT) : undefined;
}

/** The sentence containing `needle`, with one sentence either side. */
function window3(text: string, needle: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const i = Math.max(0, sentences.findIndex((s) => needle && s.includes(needle.slice(0, 40))));
  return sentences.slice(Math.max(0, i - 1), i + 2).join('').trim();
}

// ---------- Metadata ----------

interface Meta {
  headline?: string;
  title?: string;
  description?: string;
  siteName?: string;
  published?: string;
  author?: string;
  section?: string;
  keywords: string[];
  canonical?: string;
  publisher?: string;
}

function metaTag(doc: Document, ...names: string[]): string | undefined {
  for (const name of names) {
    for (const el of doc.querySelectorAll('meta[property], meta[name], meta[itemprop]')) {
      const key = (el.getAttribute('property') ?? el.getAttribute('name') ?? el.getAttribute('itemprop') ?? '').toLowerCase();
      if (key !== name) continue;
      const v = el.getAttribute('content')?.replace(/\s+/g, ' ').trim();
      if (v) return v;
    }
  }
  return undefined;
}

function pageMetadata(doc: Document): Meta {
  const md: Meta = {
    headline: metaTag(doc, 'og:title', 'twitter:title'),
    title: doc.title?.replace(/\s+/g, ' ').trim() || undefined,
    description: metaTag(doc, 'og:description', 'twitter:description', 'description'),
    siteName: metaTag(doc, 'og:site_name', 'application-name'),
    published: metaTag(doc, 'article:published_time', 'datepublished', 'date'),
    author: nameOnly(metaTag(doc, 'author')),
    section: metaTag(doc, 'article:section'),
    keywords: splitKeywords(metaTag(doc, 'keywords', 'news_keywords')),
  };
  const canonical = doc.querySelector('link[rel="canonical" i]')?.getAttribute('href');
  if (canonical) {
    try {
      md.canonical = new URL(canonical, doc.baseURI).href;
    } catch {
      // A broken canonical link is ignored.
    }
  }
  // The page's own article in its structured data.
  for (const node of jsonLd(doc)) {
    if (!isArticle(node)) continue;
    if (urlOf(node) && md.canonical && !sameUrl(urlOf(node)!, md.canonical)) continue;
    md.headline ??= str(node.headline) ?? str(node.name);
    md.description ??= str(node.description);
    md.published ??= str(node.datePublished);
    md.author ??= nameOnly(nameOf(node.author));
    md.section ??= str(node.articleSection) ?? strList(node.articleSection)[0];
    if (!md.keywords.length) md.keywords = keywordsOf(node.keywords);
    md.siteName ??= nameOf(node.publisher);
  }
  return md;
}

/** Structured data on this page that describes the link's own address (a front page's list of stories, say). */
function linkedMetadata(doc: Document, linkUrl: string): Meta {
  const md: Meta = { keywords: [] };
  for (const node of jsonLd(doc)) {
    const url = urlOf(node);
    if (!url || !sameUrl(url, linkUrl)) continue;
    md.headline ??= str(node.headline) ?? str(node.name);
    md.description ??= str(node.description);
    md.published ??= str(node.datePublished) ?? str(node.uploadDate);
    md.author ??= nameOnly(nameOf(node.author));
    md.section ??= str(node.articleSection) ?? strList(node.articleSection)[0];
    md.publisher ??= nameOf(node.publisher);
    if (!md.keywords.length) md.keywords = keywordsOf(node.keywords);
  }
  if (md.headline) md.headline = clip(md.headline, MAX_HEADLINE);
  return md;
}

const ARTICLE_TYPE = /(Article|BlogPosting|Report|NewsArticle|VideoObject|LiveBlogPosting|WebPage)$/;

function isArticle(node: Record<string, unknown>): boolean {
  return ([] as unknown[]).concat(node['@type'] ?? []).some((t) => typeof t === 'string' && ARTICLE_TYPE.test(t));
}

/** Every JSON-LD object on the page, including @graph members and list items. */
function jsonLd(doc: Document): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 6 || v === null || typeof v !== 'object' || out.length > 500) return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const obj = v as Record<string, unknown>;
    out.push(obj);
    for (const key of ['@graph', 'itemListElement', 'item', 'mainEntity', 'hasPart']) if (obj[key]) visit(obj[key], depth + 1);
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json" i]')) {
    const raw = s.textContent ?? '';
    if (raw.length > MAX_JSONLD_CHARS) continue;
    try {
      visit(JSON.parse(raw), 0);
    } catch {
      // Not valid JSON: skip it.
    }
  }
  return out;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() || undefined : undefined;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter((x): x is string => Boolean(x)) : [];
}

function nameOf(v: unknown): string | undefined {
  if (typeof v === 'string') return str(v);
  if (Array.isArray(v)) return v.map(nameOf).filter(Boolean).join(', ') || undefined;
  if (v && typeof v === 'object') return str((v as Record<string, unknown>).name);
  return undefined;
}

/** A person's name, not a profile link. */
function nameOnly(v: string | undefined): string | undefined {
  return v && !/^https?:\/\//i.test(v) && v.length <= 100 ? v : undefined;
}

function urlOf(node: Record<string, unknown>): string | undefined {
  const main = node.mainEntityOfPage;
  return str(node.url) ?? str(main) ?? (main && typeof main === 'object' ? str((main as Record<string, unknown>)['@id']) : undefined) ?? str(node['@id']);
}

function keywordsOf(v: unknown): string[] {
  if (typeof v === 'string') return splitKeywords(v);
  return strList(v).slice(0, 10).map((k) => clip(k, 40));
}

function splitKeywords(v: string | undefined): string[] {
  return (v ?? '')
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2)
    .slice(0, 10)
    .map((k) => clip(k, 40));
}

/** Same page, ignoring #fragments, tracking parameters, "www." and a trailing slash. */
function sameUrl(a: string, b: string): boolean {
  const norm = (s: string) => {
    const f = analyseUrl(s);
    return f ? f.cleaned.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : s;
  };
  return norm(a) === norm(b);
}

function isSamePage(doc: Document, linkUrl: string, canonical: string | undefined): boolean {
  return sameUrl(linkUrl, doc.location?.href ?? '') || Boolean(canonical && sameUrl(linkUrl, canonical));
}

function sameSite(doc: Document, site: string): boolean {
  const host = (doc.location?.hostname ?? '').replace(/^(www|m)\./, '');
  return Boolean(host) && host === site;
}
