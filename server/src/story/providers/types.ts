/**
 * The search provider interface. Story Search never depends on one provider:
 * each one is a small adapter that turns a SearchQuery into SearchHits, so a
 * provider can be swapped or added without touching the rest.
 */
import type { SearchQuery } from '../queries.js';

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
  /** Relevant passages from the page, as the provider extracted them. Short, never the whole article. */
  passages: string[];
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
