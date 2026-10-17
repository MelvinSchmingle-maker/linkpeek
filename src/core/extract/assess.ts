/**
 * Turns what was fetched and read into an honest verdict: how much of the
 * article LinkPeek really has (the evidence level), or why it has nothing.
 * Pure: no DOM, no network.
 *
 * Order matters. A bot-check page is caught before anything else (it often
 * comes with a 403 or 503), then plain HTTP errors, then login and
 * subscription walls, then pages that need JavaScript. Only what's left can
 * count as an article.
 */
import {
  failureFromStatus,
  looksJsRendered,
  looksLikeChallenge,
  looksLikeLoginWall,
  looksLikePaywall,
  redirectedToLogin,
} from '../retrieve/diagnose';
import type { FetchError } from '../retrieve/fetcher';
import { siteOf } from '../retrieve/url';
import { sourceInfo } from '../source/facts';
import type { ArticleExtract, ContentFacts, EvidenceLevel, FailureReason, SourceInfo, Summary } from '../types';
import type { HtmlExtraction } from './html';
import { firstSentence, limitWords } from './sentences';

/** Enough real article text to call it the full article. Explained in docs/decisions.md. */
export const FULL_ARTICLE_WORDS = 150;
const PREVIEW_WORDS = 50;
const MIN_TEASER_WORDS = 15;

export interface Assessment {
  evidence: EvidenceLevel;
  failure?: FailureReason;
  preview?: string;
  extract?: ArticleExtract;
  source?: SourceInfo;
  unsupported?: boolean;
  /** Set when the link ended up on a different page than it pointed to. */
  finalUrl?: string;
  /** Added after reading, by the summary engine (Part 05). 20 words or fewer. */
  summary?: Summary;
  /** Added for full articles, for the headline check (Part 07). Derived facts, never article text. */
  facts?: ContentFacts;
  /**
   * The article's paragraphs, for reading mode (Part 12). Only when the reader
   * was asked for them, only for full articles, and never stored: the cache
   * keeps the assessment without them.
   */
  readable?: string[];
}

export interface FetchedMeta {
  requestedUrl: string;
  finalUrl: string;
  status: number;
}

export function assessFetchError(error: FetchError): Assessment {
  return { evidence: 'unavailable', failure: error };
}

export function assessUnsupported(meta: FetchedMeta): Assessment {
  return { evidence: 'unavailable', unsupported: true, ...finalUrlOf(meta) };
}

export function assessHtml(meta: FetchedMeta, html: string, ex: HtmlExtraction): Assessment {
  const md = ex.metadata;
  const base: Assessment = {
    evidence: 'unavailable',
    source: sourceInfo({ url: meta.finalUrl, metadata: md, links: ex.links, labels: ex.labels }),
    ...finalUrlOf(meta),
  };
  const fail = (failure: FailureReason, preview?: string): Assessment => ({
    ...base,
    failure,
    ...(preview ? { evidence: 'partial' as const, preview } : {}),
  });

  // 1. "Are you a robot?" pages, whatever their status code.
  if (looksLikeChallenge(html, ex.title, ex.articleWords)) return { ...fail('bot-challenge'), source: undefined };

  // 2. Sent on to a login page. That's the reason to show, even when the login
  //    page answers with a refusal (Reddit answers 403). Nothing on a login
  //    page describes the article, so no preview and no source details.
  if (redirectedToLogin(meta.requestedUrl, meta.finalUrl) && meta.status < 500 && meta.status !== 429) {
    return { ...fail('login-wall'), source: undefined };
  }

  // 3. Plain HTTP errors. Error pages' descriptions are about the site, not the article.
  const statusFailure = failureFromStatus(meta.status);
  if (statusFailure) return { ...fail(statusFailure), source: undefined };

  const description = md.description ? limitWords(md.description, PREVIEW_WORDS) : undefined;
  const sentToOtherPage = !samePath(meta.requestedUrl, meta.finalUrl);

  // 4. Login walls: a sign-in form where the article should be.
  if (
    looksLikeLoginWall({
      requestedUrl: meta.requestedUrl,
      finalUrl: meta.finalUrl,
      hasPasswordField: ex.signals.hasPasswordField,
      title: ex.title,
      articleWords: ex.articleWords,
    })
  ) {
    return fail('login-wall', sentToOtherPage ? undefined : description);
  }

  // 5. Subscription walls. Only the publisher's public description is used,
  //    never text from the page body: it may be the paid article itself.
  if (
    looksLikePaywall({
      isAccessibleForFree: md.isAccessibleForFree,
      bodyText: ex.bodySample,
      articleWords: ex.articleWords,
      hasPaywallElement: ex.signals.hasPaywallElement,
    })
  ) {
    return fail('paywall', description);
  }

  // 6. Pages that only build themselves with JavaScript.
  if (looksJsRendered({ articleWords: ex.articleWords, bodyWords: ex.bodyWords, ...ex.signals })) {
    return fail('js-rendered-empty', description);
  }

  // 7. A real article.
  if (ex.articleWords >= FULL_ARTICLE_WORDS) {
    return {
      ...base,
      evidence: 'full',
      extract: {
        firstSentence: firstSentence(ex.lead || ex.articleText),
        wordCount: ex.articleWords,
        method: 'readability',
        title: md.title ?? (ex.title || undefined),
      },
    };
  }

  // 8. Not enough for the full article: a preview from what the page says about itself.
  const teaser = ex.articleWords >= MIN_TEASER_WORDS ? limitWords(ex.articleText, PREVIEW_WORDS) : undefined;
  const preview = description ?? teaser;
  if (preview) return { ...base, evidence: 'partial', preview };

  return { ...base, failure: 'extraction-failed' };
}

export interface PdfExtraction {
  text: string;
  words: number;
  pagesRead: number;
  totalPages: number;
  title?: string;
}

export function assessPdf(meta: FetchedMeta, pdf: PdfExtraction): Assessment {
  // A PDF has no page metadata: only what the address says (its host, and a path such as /opinion/).
  const base: Assessment = { evidence: 'unavailable', source: sourceInfo({ url: meta.finalUrl, metadata: {}, labels: [] }), ...finalUrlOf(meta) };
  const statusFailure = failureFromStatus(meta.status);
  if (statusFailure) return { ...base, failure: statusFailure };
  const truncated = pdf.pagesRead < pdf.totalPages;
  if (pdf.words >= FULL_ARTICLE_WORDS) {
    return {
      ...base,
      evidence: truncated ? 'partial' : 'full',
      extract: { firstSentence: firstSentence(pdf.text), wordCount: pdf.words, method: 'pdf', title: pdf.title, truncated },
      ...(truncated ? { preview: limitWords(pdf.text, PREVIEW_WORDS) } : {}),
    };
  }
  if (pdf.words >= MIN_TEASER_WORDS) return { ...base, evidence: 'partial', preview: limitWords(pdf.text, PREVIEW_WORDS) };
  // No text layer: usually a scanned image.
  return { ...base, failure: 'extraction-failed' };
}

/** The link ended up somewhere else: worth knowing, and shown when it's another site. */
function finalUrlOf(meta: FetchedMeta): Pick<Assessment, 'finalUrl'> {
  return samePath(meta.requestedUrl, meta.finalUrl) ? {} : { finalUrl: meta.finalUrl };
}

function samePath(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return siteOf(a) === siteOf(b) && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '') && x.search === y.search;
  } catch {
    return a === b;
  }
}
