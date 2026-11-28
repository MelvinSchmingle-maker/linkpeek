/**
 * The search provider interface. Story Search never depends on one provider:
 * each one is a small adapter that turns a SearchQuery into SearchHits, so a
 * provider can be swapped or added without touching the rest.
 */
import type { EvidenceDepth } from '../contract.js';
import type { SearchQuery } from '../queries.js';

export type { EvidenceDepth };

export interface SearchHit {
  url: string;
  title: string;
  /** The site's name if the provider gives one; otherwise worked out from the address later. */
  publisher?: string;
  /** "YYYY-MM-DD". */
  published?: string;
  author?: string;
  /** The provider's snippet or description. */
  description?: string;
  /** Relevant passages from the page, as the provider extracted them. Short, never the whole article. Matching uses these. */
  passages: string[];
  /** The article's own text, one paragraph each, when the provider gave enough of it (pageText): evidence and the prompt use it. */
  text?: string[];
  /** How much of the article this is (D75). Without it: an excerpt if there are passages, else the headline only. */
  depth?: EvidenceDepth;
  /** "YYYY-MM-DD": when the article says it was last updated, if its text says so (hygiene.ts). */
  updated?: string;
  /** The article carries a correction notice (hygiene.ts). */
  corrected?: boolean;
}

/** "quota": the account's credit or plan limit is used up (on a free plan, until it renews). */
export type SearchFailure = 'misconfigured' | 'quota' | 'busy' | 'timeout' | 'upstream';

export type SearchOutcome =
  | { ok: true; hits: SearchHit[]; costUsd: number; provider: string }
  /** `tag`: the provider's own error tag, when it sends one (e.g. Exa's "NO_MORE_CREDITS"). For logs and the live-test report. */
  | { ok: false; code: SearchFailure; tag?: string };

export interface SearchOptions {
  limit: number;
  /** Only results published on or after this day ("YYYY-MM-DD"), when the link's date is known. */
  since?: string;
  /**
   * And on or before this day. Without an end, searches for an older story
   * drift to the latest coverage of the same people (seen live with Tavily,
   * 27 Nov 2026: "Pope Francis dies aged 88" returned this week's diary
   * stories, not his death in April 2025).
   */
  until?: string;
  language?: string;
  /** Leave out results from these sites (to find independent reports of a story already found). */
  excludeDomains?: string[];
  signal?: AbortSignal;
}

export interface SearchProvider {
  readonly name: string;
  /**
   * Whether the provider honours "exact wording" searches. Exa and Tavily
   * search by meaning, so a headline and its key words find the same
   * results: one query is sent instead of two, which halves the cost.
   */
  readonly exactPhrases?: boolean;
  search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome>;
}

/** Longest a passage may be, whatever the provider sends. */
export const MAX_PASSAGE_CHARS = 700;
export const MAX_PASSAGES = 4;

/** Depths from least to most of the article (EvidenceDepth: contract.ts, D75). */
export const DEPTH_RANK: Record<EvidenceDepth, number> = { headline: 0, excerpt: 1, extended: 2, full: 3 };
/** Read beyond the search service's own excerpt: a long part of the article, or all of it. */
export const readBeyondExcerpt = (d: EvidenceDepth) => DEPTH_RANK[d] >= DEPTH_RANK.extended;

/** Most article text kept per result, and asked of the search service: about 800 words, enough for most news stories. */
export const PAGE_TEXT_CHARS = 5000;
/**
 * Page text shorter than this is treated as an excerpt, not the article: a paywall teaser, or a service's
 * own cut (measured 28 Nov 2026: Exa returned exactly 1,000 characters of a Reuters report, ending mid-sentence).
 */
export const FULL_TEXT_MIN_CHARS = 1500;

/** The depth of a result: what its adapter worked out, else an excerpt if it has passages or a snippet, else the headline only. */
export function depthOf(hit: SearchHit): EvidenceDepth {
  return hit.depth ?? (hit.passages.length || hit.description ? 'excerpt' : 'headline');
}

/** Sentences of a long paragraph, regrouped into pieces no longer than `max`. */
function pieces(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const out: string[] = [];
  let cur = '';
  for (const sentence of paragraph.split(/(?<=[.!?…])\s+/)) {
    if (cur && cur.length + sentence.length + 1 > max) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${sentence}` : sentence;
    while (cur.length > max) {
      out.push(cur.slice(0, max));
      cur = cur.slice(max);
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * A page's text as paragraphs, for evidence (D75). Markup and markdown
 * heading marks are removed, a repeat of the title is dropped, long
 * paragraphs are split at sentence ends (so the prompt never cuts one), and
 * at most PAGE_TEXT_CHARS are kept. `cut`: the service may have cut the text
 * itself (it returned as much as was asked for). Too little text to be an
 * article gives undefined: the caller keeps the provider's excerpts.
 */
export function pageText(raw: string, title: string, { cut = false }: { cut?: boolean } = {}): { text: string[]; depth: EvidenceDepth } | undefined {
  const lines = raw
    .split(/\n+/)
    .map((l) => plain(l.replace(/^\s*#{1,6}\s+/, '')))
    .filter((l) => l && l.toLowerCase() !== title.toLowerCase());
  const total = lines.reduce((n, l) => n + l.length, 0);
  if (total < FULL_TEXT_MIN_CHARS) return undefined;
  const text: string[] = [];
  let used = 0;
  let dropped = false;
  for (const p of lines.flatMap((l) => pieces(l, MAX_PASSAGE_CHARS))) {
    if (used + p.length > PAGE_TEXT_CHARS) {
      dropped = true;
      break;
    }
    text.push(p);
    used += p.length;
  }
  return { text, depth: cut || dropped ? 'extended' : 'full' };
}

/**
 * Where an article starts in a whole page's text (Tavily's raw content opens
 * with the site's menus): the first line with its headline, else the first
 * with the start of one of the service's own excerpts. Undefined if neither
 * is there: the page can't be trusted to hold this article's text.
 */
export function articleStart(raw: string, title: string, excerpts: string[]): string | undefined {
  const lines = raw.split(/\n+/);
  const key = (s: string) => plain(s).toLowerCase();
  const wants = [key(title).slice(0, 60), ...excerpts.map((e) => key(e).slice(0, 50))].filter((w) => w.length >= 20);
  for (const w of wants) {
    const i = lines.findIndex((l) => key(l).includes(w));
    if (i >= 0) return lines.slice(i).join('\n');
  }
  return undefined;
}

/** Provider text can carry markup (<strong> around matches) and entities. Plain text only. */
export function plain(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function webUrl(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** The provider's error tag, if its error body has one: Exa's `tag`, or a short code. Never the message text. */
async function errorTag(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { tag?: unknown };
    return typeof body?.tag === 'string' && /^[A-Z0-9_]{1,40}$/.test(body.tag) ? body.tag : undefined;
  } catch {
    return undefined;
  }
}

/** One HTTP call with a timeout, mapped to the short failure codes. Never throws. */
export async function callJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<{ ok: true; data: unknown } | { ok: false; code: SearchFailure; tag?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const tag = await errorTag(res);
      const fail = (code: SearchFailure) => ({ ok: false as const, code, ...(tag ? { tag } : {}) });
      if (res.status === 401 || res.status === 403) return fail('misconfigured');
      // Exa sends 402 with "X402_PAYMENT_REQUIRED" when no key arrived at all: a setup problem, not used-up credit.
      if (res.status === 402 && tag === 'X402_PAYMENT_REQUIRED') return fail('misconfigured');
      // 402: Exa's credit or a key/team budget is used up (NO_MORE_CREDITS, API_KEY_BUDGET_EXCEEDED,
      // TEAM_BUDGET_EXCEEDED). 432 and 433: Tavily's plan or key limit, and its pay-as-you-go limit.
      if (res.status === 402 || res.status === 432 || res.status === 433) return fail('quota');
      if (res.status === 429) return fail('busy');
      return fail('upstream');
    }
    try {
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false, code: 'upstream' };
    }
  } catch {
    return { ok: false, code: controller.signal.aborted ? 'timeout' : 'upstream' };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}
