/**
 * Reads an HTML page that LinkPeek fetched: the article text (via Mozilla
 * Readability), the page's own metadata, and the clues the failure checks
 * need. Needs a DOM, so it runs in the offscreen document (and in tests).
 *
 * The HTML is parsed with DOMParser, which never runs the page's scripts or
 * loads its images. Page content is data, never instructions.
 */
import { Readability } from '@mozilla/readability';
import { wordCount } from '../detect/classify';
import type { FactOrigin } from '../types';

export interface PageMetadata {
  title?: string;
  description?: string;
  siteName?: string;
  canonical?: string;
  /** schema.org type, e.g. "NewsArticle", or og:type. */
  type?: string;
  published?: string;
  modified?: string;
  author?: string;
  /** The publisher's own statement (schema.org) that the page isn't free to read. */
  isAccessibleForFree?: boolean;
  /** Where the publisher, dates, author and type came from (for the source card). */
  origin?: Partial<Record<'siteName' | 'published' | 'modified' | 'author' | 'type', FactOrigin>>;
}

/** Labels the article itself carries. Found only in the article's own area, never in menus or footers. */
export type PageLabel = 'sponsored' | 'press-release' | 'opinion';

export interface HtmlExtraction {
  metadata: PageMetadata;
  /** The document's <title>. */
  title: string;
  /** Article text found by Readability, whitespace collapsed. Empty if none. */
  articleText: string;
  articleWords: number;
  /** The article's opening paragraph (tables, captions and labels skipped). Empty if none. */
  lead: string;
  /** The article's paragraphs in reading order from the opening, at most MAX_PARAGRAPHS. For summaries. */
  paragraphs: string[];
  /** The page's declared language (<html lang>), if any. */
  language?: string;
  /** Absolute web links from the article text, for counting primary sources. Undefined when no article text was read. */
  links?: string[];
  /** Labels such as "Sponsored" or "Press release" found in the article's own area. */
  labels: PageLabel[];
  /** All visible-ish body text (scripts and styles removed), for words and phrase checks. */
  bodyWords: number;
  bodySample: string;
  signals: {
    hasPasswordField: boolean;
    hasPaywallElement: boolean;
    scriptCount: number;
    hasEmptyAppRoot: boolean;
    noscriptAsksForJs: boolean;
  };
}

const ARTICLE_TYPES =
  /^(Article|NewsArticle|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BackgroundNewsArticle|ReviewNewsArticle|BlogPosting|SocialMediaPosting|LiveBlogPosting|Report|ScholarlyArticle|TechArticle|WebPage|Blog|DiscussionForumPosting|QAPage|VideoObject)$/;

export function extractHtml(html: string, url: string): HtmlExtraction {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Relative links in the page should resolve against the page's address.
  const base = doc.createElement('base');
  base.href = url;
  doc.head?.prepend(base);

  const metadata = readMetadata(doc);
  const origin = (metadata.origin ??= {});
  const title = (doc.querySelector('title')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  // Author from the byline link, when the page has no author in its tags or structured data.
  if (!metadata.author) {
    const byline = personName(doc.querySelector('[rel~="author" i]')?.textContent?.replace(/\s+/g, ' ').trim());
    if (byline) {
      metadata.author = byline;
      origin.author = 'byline';
    }
  }
  // Published date from a <time> in the article, when nothing else gave one.
  if (!metadata.published) {
    const time = doc.querySelector('article time[datetime], time[itemprop="datePublished" i][datetime]')?.getAttribute('datetime')?.trim();
    if (time) {
      metadata.published = time;
      origin.published = 'page-text';
    }
  }
  const signals = {
    hasPasswordField: Boolean(doc.querySelector('input[type="password" i]')),
    hasPaywallElement: Boolean(
      doc.querySelector(
        '[class*="paywall" i], [id*="paywall" i], [class*="subscriber-only" i], [class*="regwall" i], [class*="premium-content" i], [id*="piano" i], [class*="tp-modal" i]',
      ),
    ),
    scriptCount: doc.querySelectorAll('script:not([type]), script[type="module"], script[type="text/javascript"]').length,
    hasEmptyAppRoot: [...doc.querySelectorAll('#root, #__next, #app, #___gatsby, [data-reactroot]')].some(
      (el) => (el.textContent ?? '').trim().length < 20,
    ),
    noscriptAsksForJs: [...doc.querySelectorAll('noscript')].some((n) =>
      /enable javascript|javascript is (required|disabled|turned off)|requires javascript|turn on javascript/i.test(n.textContent ?? ''),
    ),
  };

  const bodyText = visibleBodyText(doc);
  const bodyWords = wordCount(bodyText);

  let articleText = '';
  let paras: string[] = [];
  let links: string[] | undefined;
  try {
    // Readability changes the document it reads, so give it a copy.
    const parsed = new Readability(doc.cloneNode(true) as Document, { charThreshold: 400 }).parse();
    if (parsed?.content) {
      const readable = new DOMParser().parseFromString(parsed.content, 'text/html');
      paras = articleParagraphs(doc, readable);
      articleText = blockText(readable.body);
      // A fragment isn't an article: counting its links would say "none" about a page we barely read.
      if (wordCount(articleText) >= MIN_WORDS_FOR_LINKS) links = linksIn(readable, url);
    } else {
      articleText = (parsed?.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    if (!metadata.siteName && parsed?.siteName) {
      metadata.siteName = parsed.siteName;
      origin.siteName = 'page-text';
    }
    if (!metadata.published && parsed?.publishedTime) {
      metadata.published = parsed.publishedTime;
      origin.published = 'page-text';
    }
    if (!metadata.author && personName(parsed?.byline)) {
      metadata.author = personName(parsed?.byline);
      origin.author = 'byline';
    }
  } catch {
    // Readability gave up on this page: treat it as having no article text.
  }

  return {
    metadata,
    title,
    articleText,
    articleWords: articleText ? wordCount(articleText) : 0,
    lead: paras[0] ?? '',
    paragraphs: paras,
    language: doc.documentElement?.getAttribute('lang')?.trim() || undefined,
    links,
    labels: pageLabels(doc),
    bodyWords,
    bodySample: bodyText.slice(0, 20_000),
    signals,
  };
}

/** Paragraphs that are part of the running text, not tables, captions, asides or hidden labels. */
const NOT_RUNNING_TEXT = 'table, figure, figcaption, aside, nav, footer, noscript, form, [aria-hidden="true"], .visually-hidden, .sr-only';
const MIN_LEAD_WORDS = 6;
/** Shorter lines than this need a full stop (or a closing mark) to count as a sentence. */
const MIN_SENTENCE_WORDS = 15;
const MAX_PARAGRAPHS = 40;

/** A word that can appear in a date or time line: "20:13,", "17", "Oct", "2026", "Updated". */
const DATE_WORD =
  /^(\d{1,2}[:.]\d{2}|\d{1,4}|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|updated|published|am|pm|bst|gmt|utc))\.?,?$/i;

/** A line made only of dates and times, such as a timestamp under a headline. It's never running text. */
function isDateLine(text: string): boolean {
  // Some pages run the date into the next word ("2026Updated"), so split at digit and letter joins.
  const words = text.replace(/(\d)([a-z])/gi, '$1 $2').split(' ');
  return words.every((w) => DATE_WORD.test(w));
}

/** A paragraph's text, or undefined if it's too short to be running text or isn't running text at all. */
function paragraphText(p: Element): string | undefined {
  if (p.closest(NOT_RUNNING_TEXT)) return undefined;
  const copy = p.cloneNode(true) as Element;
  // Footnote markers like [1] or [note 1].
  for (const sup of copy.querySelectorAll('sup')) if (/^\s*\[[^\]]*\]\s*$/.test(sup.textContent ?? '')) sup.remove();
  const text = (copy.textContent ?? '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  if (wordCount(text) < MIN_LEAD_WORDS || /^(by|updated|published|posted|last updated)\b/i.test(text) || isDateLine(text)) return undefined;
  // A short line with no full stop, question mark or closing quote is a headline or kicker above the story, not a sentence.
  if (wordCount(text) < MIN_SENTENCE_WORDS && !/[.!?…"'”’)\]]$/.test(text)) return undefined;
  return text;
}

function paragraphs(root: ParentNode): string[] {
  return [...root.querySelectorAll('p')].map(paragraphText).filter((t): t is string => Boolean(t));
}

/**
 * The article's paragraphs, from its opening. Readability sometimes starts
 * part-way in on pages that split the story into several identical blocks
 * (BBC News does). So when the page's <article> has earlier paragraphs laid
 * out exactly like the one Readability started from (same classes, same kind
 * of parent), those come first. A standfirst or caption is laid out
 * differently, so it isn't mistaken for the opening.
 */
function articleParagraphs(doc: Document, readable: Document): string[] {
  const ours = paragraphs(readable);
  const first = ours[0];
  if (!first) return [];
  const original = [...doc.querySelectorAll('p')].find((p) => paragraphText(p) === first);
  const parent = original?.parentElement;
  const article = original?.closest('article, [itemprop="articleBody"], main');
  const earlier: string[] = [];
  if (original && parent && article && (original.className || parent.className)) {
    for (const p of article.querySelectorAll('p')) {
      if (p === original) break;
      const sameShape =
        p.className === original.className &&
        p.parentElement?.tagName === parent.tagName &&
        p.parentElement?.className === parent.className;
      const text = sameShape ? paragraphText(p) : undefined;
      if (text) earlier.push(text);
    }
  }
  return [...earlier, ...ours].slice(0, MAX_PARAGRAPHS);
}

function visibleBodyText(doc: Document): string {
  const body = doc.body?.cloneNode(true) as HTMLElement | undefined;
  if (!body) return '';
  for (const el of body.querySelectorAll('script, style, noscript, template, svg')) el.remove();
  return blockText(body);
}

const BLOCKS = 'p, div, li, dt, dd, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, tr, figcaption, section, article, header, footer, aside, nav, br';

/**
 * Text with a space between blocks. `textContent` alone runs paragraphs
 * together ("410,000 pounds.Engineers replaced"), which breaks sentences
 * and word counts. Changes the element it's given.
 */
function blockText(root: Element): string {
  for (const el of root.querySelectorAll(BLOCKS)) el.after(' ');
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function meta(doc: Document, ...names: string[]): string | undefined {
  for (const name of names) {
    const el = doc.querySelector(`meta[property="${name}" i], meta[name="${name}" i], meta[itemprop="${name}" i]`);
    const content = el?.getAttribute('content')?.replace(/\s+/g, ' ').trim();
    if (content) return content;
  }
  return undefined;
}

function readMetadata(doc: Document): PageMetadata {
  const origin: NonNullable<PageMetadata['origin']> = {};
  const fromTags = <K extends keyof NonNullable<PageMetadata['origin']>>(key: K, value: string | undefined) => {
    if (value) origin[key] = 'meta-tags';
    return value;
  };
  const md: PageMetadata = {
    title: meta(doc, 'og:title', 'twitter:title'),
    description: meta(doc, 'og:description', 'description', 'twitter:description', 'citation_abstract', 'dc.description'),
    siteName: fromTags('siteName', meta(doc, 'og:site_name', 'application-name')),
    type: meta(doc, 'og:type'),
    published: fromTags('published', meta(doc, 'article:published_time', 'citation_publication_date', 'dc.date', 'date')),
    modified: fromTags('modified', meta(doc, 'article:modified_time', 'og:updated_time')),
    // article:author is often a profile link, not a name.
    author: fromTags('author', personName(meta(doc, 'author', 'citation_author') ?? meta(doc, 'article:author'))),
    origin,
  };
  const canonical = doc.querySelector('link[rel="canonical" i]')?.getAttribute('href');
  if (canonical) {
    try {
      md.canonical = new URL(canonical, doc.baseURI).href;
    } catch {
      // Ignore a broken canonical link.
    }
  }

  for (const node of jsonLdNodes(doc)) {
    const type = ([] as unknown[]).concat(node['@type'] ?? []).map(String);
    if (!type.some((t) => ARTICLE_TYPES.test(t))) continue;
    const t = type.find((x) => x !== 'WebPage') ?? type[0];
    if (t && (!md.type || md.type === 'article' || md.type === 'website')) {
      md.type = t;
      origin.type = 'structured-data';
    }
    md.title ??= str(node.headline) ?? str(node.name);
    md.description ??= str(node.description) ?? str(node.abstract);
    if (!md.published && str(node.datePublished)) {
      md.published = str(node.datePublished);
      origin.published = 'structured-data';
    }
    if (!md.modified && str(node.dateModified)) {
      md.modified = str(node.dateModified);
      origin.modified = 'structured-data';
    }
    const publisher = node.publisher as Record<string, unknown> | undefined;
    if (!md.siteName && str(publisher?.name)) {
      md.siteName = str(publisher?.name);
      origin.siteName = 'structured-data';
    }
    if (!md.author) {
      const author = personName(jsonLdName(node.author));
      if (author) {
        md.author = author;
        origin.author = 'structured-data';
      }
    }
    const free = node.isAccessibleForFree;
    if (free === false || (typeof free === 'string' && free.toLowerCase() === 'false')) md.isAccessibleForFree = false;
    else if (free === true || (typeof free === 'string' && free.toLowerCase() === 'true')) md.isAccessibleForFree ??= true;
    // Paywalled sections are also marked as parts that aren't free.
    for (const part of ([] as unknown[]).concat(node.hasPart ?? [])) {
      const f = (part as Record<string, unknown>)?.isAccessibleForFree;
      if (f === false || (typeof f === 'string' && f.toLowerCase() === 'false')) md.isAccessibleForFree = false;
    }
  }
  return md;
}

/** A plausible author name: short, and not a profile link. */
function personName(v: string | null | undefined): string | undefined {
  if (!v || /^https?:\/\//i.test(v) || v.length > 100) return undefined;
  return v;
}

/** schema.org author: a name, a person or organisation object, or a list of them. */
function jsonLdName(v: unknown): string | undefined {
  if (typeof v === 'string') return str(v);
  if (Array.isArray(v)) return v.map(jsonLdName).filter(Boolean).join(', ') || undefined;
  if (v && typeof v === 'object') return str((v as Record<string, unknown>).name);
  return undefined;
}

const MAX_LINKS = 400;
/** Fewest words of article text before its links are counted. */
const MIN_WORDS_FOR_LINKS = 50;

/** Web links in the article text, resolved against the page's address. */
function linksIn(root: Document, pageUrl: string): string[] {
  const out = new Set<string>();
  for (const a of root.querySelectorAll('a[href]')) {
    if (out.size >= MAX_LINKS) break;
    try {
      const u = new URL(a.getAttribute('href') ?? '', pageUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        u.hash = '';
        out.add(u.href);
      }
    } catch {
      // A link that isn't a valid address. Skip it.
    }
  }
  return [...out];
}

/** Navigation, headers and footers never carry an article's own labels. */
const LABEL_ZONE = 'nav, header, footer, aside, form, script, style, noscript, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]';

const LABEL_TEXT: [PageLabel, RegExp][] = [
  ['sponsored', /^(sponsored( content)?|paid content|paid for by\b.*|partner content|promoted)\s*:?$/i],
  ['press-release', /^(press release|news release)\s*:?$/i],
  ['opinion', /^(opinion|comment)\s*:?$/i],
];

/**
 * Labels the article carries in its own area: a short line that reads
 * exactly "Sponsored", "Press release" or "Opinion", or a block whose class
 * says it's sponsored. Only the article (or main content) is searched, and
 * never its navigation, header or footer.
 */
function pageLabels(doc: Document): PageLabel[] {
  const zone = doc.querySelector('article') ?? doc.querySelector('main, [role="main"]') ?? doc.body;
  if (!zone) return [];
  const found = new Set<PageLabel>();
  for (const el of zone.querySelectorAll('span, p, div, small, strong, em, h1, h2, h3, h4, h5, h6, a, li, label')) {
    if (el.closest(LABEL_ZONE)) continue;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 40) continue;
    for (const [label, re] of LABEL_TEXT) if (re.test(text)) found.add(label);
  }
  for (const el of zone.querySelectorAll('[class*="sponsored" i], [class*="paid-content" i]')) {
    if (!el.closest(LABEL_ZONE)) {
      found.add('sponsored');
      break;
    }
  }
  return [...found];
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim() || undefined;
  return undefined;
}

/** Every JSON-LD object on the page, including ones inside @graph and arrays. Malformed blocks are skipped. */
function jsonLdNodes(doc: Document): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 4 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const obj = v as Record<string, unknown>;
    out.push(obj);
    if (obj['@graph']) visit(obj['@graph'], depth + 1);
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json" i]')) {
    try {
      visit(JSON.parse(s.textContent ?? ''), 0);
    } catch {
      // Not valid JSON. Skip it.
    }
  }
  return out;
}
