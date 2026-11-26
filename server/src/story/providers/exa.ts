/**
 * Exa (https://exa.ai), the default provider. One request returns the
 * results and short highlights from each page, so LinkPeek's server never
 * fetches or scrapes article pages itself: no server-side fetching of
 * arbitrary addresses, and no attempt to get past paywalls.
 *
 * Request and response shapes from Exa's API reference (POST /search, read
 * 26 Nov 2026). Prices from exa.ai/pricing the same day: an "auto" search is
 * $7 per 1,000 requests with up to 10 results, and highlights are $1 per
 * 1,000 pages. Exa reports what each request cost (costDollars.total), and
 * that figure is logged when present.
 *
 * Not yet run against the live API: no key was configured when this was
 * written. The tests use recorded shapes from the documentation.
 */
import type { SearchQuery } from '../queries.js';
import { isoDay } from '../text.js';
import { callJson, MAX_PASSAGE_CHARS, MAX_PASSAGES, plain, webUrl, type SearchHit, type SearchOptions, type SearchOutcome, type SearchProvider } from './types.js';

export const EXA_URL = 'https://api.exa.ai/search';
const TIMEOUT_MS = 8000;
/** Estimate when Exa doesn't say: one auto search plus highlights for each result. */
const SEARCH_USD = 0.007;
const HIGHLIGHT_USD_PER_PAGE = 0.001;

export class ExaProvider implements SearchProvider {
  readonly name = 'exa';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome> {
    if (!this.apiKey) return { ok: false, code: 'misconfigured' };
    const body = {
      query: query.text,
      numResults: opts.limit,
      type: 'auto',
      ...(query.news ? { category: 'news' } : {}),
      ...(opts.since ? { startPublishedDate: `${opts.since}T00:00:00.000Z` } : {}),
      contents: { highlights: { query: query.text, maxCharacters: 1200 } },
    };
    const res = await callJson(
      this.fetchImpl,
      EXA_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      opts.signal,
    );
    if (!res.ok) return res;
    const data = res.data as { results?: unknown; costDollars?: { total?: unknown } };
    if (!Array.isArray(data.results)) return { ok: false, code: 'upstream' };
    const hits: SearchHit[] = [];
    for (const r of data.results as Record<string, unknown>[]) {
      const url = webUrl(r?.url);
      const title = plain(r?.title);
      if (!url || !title) continue;
      const highlights = Array.isArray(r.highlights) ? r.highlights.map(plain).filter(Boolean) : [];
      const text = plain(r.text);
      hits.push({
        url,
        title,
        ...(isoDay(typeof r.publishedDate === 'string' ? r.publishedDate : undefined) ? { published: isoDay(r.publishedDate as string) } : {}),
        ...(plain(r.author) ? { author: plain(r.author).slice(0, 100) } : {}),
        passages: (highlights.length ? highlights : text ? [text] : []).slice(0, MAX_PASSAGES).map((p) => p.slice(0, MAX_PASSAGE_CHARS)),
      });
    }
    const reported = Number(data.costDollars?.total);
    const costUsd = Number.isFinite(reported) && reported >= 0 ? reported : SEARCH_USD + HIGHLIGHT_USD_PER_PAGE * hits.length;
    return { ok: true, hits, costUsd };
  }
}
