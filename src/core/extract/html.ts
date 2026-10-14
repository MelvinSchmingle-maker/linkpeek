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
}

export interface HtmlExtraction {
  metadata: PageMetadata;
  /** The document's <title>. */
  title: string;
  /** Article text found by Readability, whitespace collapsed. Empty if none. */
  articleText: string;
  articleWords: number;
  /** The article's opening paragraph (tables, captions and labels skipped). Empty if none. */
  lead: string;
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
  const title = (doc.querySelector('title')?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
  let lead = '';
  try {
    // Readability changes the document it reads, so give it a copy.
    const parsed = new Readability(doc.cloneNode(true) as Document, { charThreshold: 400 }).parse();
    articleText = (parsed?.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (parsed?.content) lead = findLead(doc, new DOMParser().parseFromString(parsed.content, 'text/html'));
    if (!metadata.siteName && parsed?.siteName) metadata.siteName = parsed.siteName;
    if (!metadata.published && parsed?.publishedTime) metadata.published = parsed.publishedTime;
    if (!metadata.author && parsed?.byline) metadata.author = parsed.byline;
  } catch {
    // Readability gave up on this page: treat it as having no article text.
  }

  return {
    metadata,
    title,
    articleText,
    articleWords: articleText ? wordCount(articleText) : 0,
    lead,
    bodyWords,
    bodySample: bodyText.slice(0, 20_000),
    signals,
  };
}

/** Paragraphs that are part of the running text, not tables, captions, asides or hidden labels. */
const NOT_RUNNING_TEXT = 'table, figure, figcaption, aside, nav, footer, noscript, form, [aria-hidden="true"], .visually-hidden, .sr-only';
const MIN_LEAD_WORDS = 6;

/** A paragraph's text, or undefined if it's too short to be running text or isn't running text at all. */
function paragraphText(p: Element): string | undefined {
  if (p.closest(NOT_RUNNING_TEXT)) return undefined;
  const copy = p.cloneNode(true) as Element;
  // Footnote markers like [1] or [note 1].
  for (const sup of copy.querySelectorAll('sup')) if (/^\s*\[[^\]]*\]\s*$/.test(sup.textContent ?? '')) sup.remove();
  const text = (copy.textContent ?? '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  if (wordCount(text) < MIN_LEAD_WORDS || /^(by|updated|published|posted|last updated)\b/i.test(text)) return undefined;
  return text;
}

function paragraphs(root: ParentNode): string[] {
  return [...root.querySelectorAll('p')].map(paragraphText).filter((t): t is string => Boolean(t));
}

/**
 * The article's opening paragraph. Readability sometimes starts part-way in
 * on pages that split the story into several identical blocks (BBC News
 * does). So when the page's <article> has earlier paragraphs laid out exactly
 * like the one Readability started from (same classes, same kind of parent),
 * start from the first of those. A standfirst or caption is laid out
 * differently, so it isn't mistaken for the opening.
 */
function findLead(doc: Document, readable: Document): string {
  const first = paragraphs(readable)[0];
  if (!first) return '';
  const original = [...doc.querySelectorAll('p')].find((p) => paragraphText(p) === first);
  const parent = original?.parentElement;
  const article = original?.closest('article, [itemprop="articleBody"], main');
  if (!original || !parent || !article || !(original.className || parent.className)) return first;
  for (const p of article.querySelectorAll('p')) {
    if (p === original) break;
    const sameShape =
      p.className === original.className &&
      p.parentElement?.tagName === parent.tagName &&
      p.parentElement?.className === parent.className;
    const text = sameShape ? paragraphText(p) : undefined;
    if (text) return text;
  }
  return first;
}

function visibleBodyText(doc: Document): string {
  const body = doc.body?.cloneNode(true) as HTMLElement | undefined;
  if (!body) return '';
  for (const el of body.querySelectorAll('script, style, noscript, template, svg')) el.remove();
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
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
  const md: PageMetadata = {
    title: meta(doc, 'og:title', 'twitter:title'),
    description: meta(doc, 'og:description', 'description', 'twitter:description', 'citation_abstract', 'dc.description'),
    siteName: meta(doc, 'og:site_name', 'application-name'),
    type: meta(doc, 'og:type'),
    published: meta(doc, 'article:published_time', 'citation_publication_date', 'dc.date', 'date'),
    modified: meta(doc, 'article:modified_time', 'og:updated_time'),
    author: meta(doc, 'author', 'article:author', 'citation_author'),
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
    if (t && (!md.type || md.type === 'article' || md.type === 'website')) md.type = t;
    md.title ??= str(node.headline) ?? str(node.name);
    md.description ??= str(node.description) ?? str(node.abstract);
    md.published ??= str(node.datePublished);
    md.modified ??= str(node.dateModified);
    const publisher = node.publisher as Record<string, unknown> | undefined;
    md.siteName ??= str(publisher?.name);
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
