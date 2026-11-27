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
  | { ok: false; code: SearchFailure };

export interface SearchOptions {
  limit: number;
  /** Only results published on or after this day ("YYYY-MM-DD"), when the link's date is known. */
  since?: string;
  language?: string;
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

/** One HTTP call with a timeout, mapped to the short failure codes. Never throws. */
export async function callJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<{ ok: true; data: unknown } | { ok: false; code: SearchFailure }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (res.status === 401 || res.status === 403) return { ok: false, code: 'misconfigured' };
    // 402: payment required. 432 and 433: Tavily's plan and pay-as-you-go limits.
    if (res.status === 402 || res.status === 432 || res.status === 433) return { ok: false, code: 'quota' };
    if (res.status === 429) return { ok: false, code: 'busy' };
    if (!res.ok) return { ok: false, code: 'upstream' };
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
