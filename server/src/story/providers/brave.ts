/**
 * Brave Search API (https://brave.com/search/api/), an optional provider.
 * Not in the default setup: since 2026 even its free monthly credit needs a
 * credit card at sign-up.
 * News queries use the News Search endpoint, broader ones Web Search. Each
 * result carries a description and up to five extra snippets, but not page
 * text, so reports from Brave rest on snippets.
 *
 * Endpoint, header and parameters from Brave's News Search documentation
 * (read 26 Nov 2026). Price from brave.com/search/api the same day: $5 per
 * 1,000 requests, with $5 of free credit a month. Brave's FAQ says storing
 * results needs a custom plan; LinkPeek keeps only its own short report, in
 * memory, for at most a few hours (cache.ts). Check that against Brave's
 * terms before using this provider in production.
 *
 * Brave's page did not show the response schema, so fields are read
 * defensively (every one optional). Not yet run against the live API: no key
 * was configured when this was written.
 */
import type { SearchQuery } from '../queries.js';
import { isoDay } from '../text.js';
import { callJson, MAX_PASSAGE_CHARS, MAX_PASSAGES, plain, webUrl, type SearchHit, type SearchOptions, type SearchOutcome, type SearchProvider } from './types.js';

export const BRAVE_NEWS_URL = 'https://api.search.brave.com/res/v1/news/search';
export const BRAVE_WEB_URL = 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 8000;
const REQUEST_USD = 0.005;

export class BraveProvider implements SearchProvider {
  readonly name = 'brave';
  readonly exactPhrases = true;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = TIMEOUT_MS,
    private readonly today = () => new Date().toISOString().slice(0, 10),
  ) {}

  async search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome> {
    if (!this.apiKey) return { ok: false, code: 'misconfigured' };
    const params = new URLSearchParams({
      q: query.exact ? `"${query.text}"` : query.text,
      count: String(Math.min(opts.limit, 20)),
      extra_snippets: 'true',
      safesearch: 'moderate',
    });
    if (opts.since) params.set('freshness', `${opts.since}to${this.today()}`);
    const lang = opts.language?.slice(0, 2).toLowerCase();
    if (lang && /^[a-z]{2}$/.test(lang)) params.set('search_lang', lang);
    const base = query.news ? BRAVE_NEWS_URL : BRAVE_WEB_URL;
    const res = await callJson(
      this.fetchImpl,
      `${base}?${params}`,
      { method: 'GET', headers: { accept: 'application/json', 'x-subscription-token': this.apiKey } },
      this.timeoutMs,
      opts.signal,
    );
    if (!res.ok) return res;
    const data = res.data as { results?: unknown; web?: { results?: unknown } };
    const list = Array.isArray(data.results) ? data.results : Array.isArray(data.web?.results) ? data.web.results : undefined;
    if (!list) return { ok: false, code: 'upstream' };
    const hits: SearchHit[] = [];
    for (const r of list as Record<string, unknown>[]) {
      const url = webUrl(r?.url);
      const title = plain(r?.title);
      if (!url || !title) continue;
      const meta = (r.meta_url ?? {}) as Record<string, unknown>;
      const profile = (r.profile ?? {}) as Record<string, unknown>;
      const extra = Array.isArray(r.extra_snippets) ? r.extra_snippets.map(plain).filter(Boolean) : [];
      const published = isoDay(typeof r.page_age === 'string' ? r.page_age : undefined);
      const publisher = plain(profile.name) || plain(meta.hostname);
      hits.push({
        url,
        title,
        ...(publisher ? { publisher: publisher.slice(0, 100) } : {}),
        ...(published ? { published } : {}),
        ...(plain(r.description) ? { description: plain(r.description).slice(0, MAX_PASSAGE_CHARS) } : {}),
        passages: extra.slice(0, MAX_PASSAGES).map((p) => p.slice(0, MAX_PASSAGE_CHARS)),
      });
    }
    return { ok: true, hits, costUsd: REQUEST_USD, provider: this.name };
  }
}
