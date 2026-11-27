/**
 * Tavily (https://tavily.com), the free backup provider. Free: 1,000 credits
 * a month, no card needed. A "basic" search costs 1 credit and returns, for
 * each result, up to three passages of about 500 characters from the page,
 * joined with " [...] ". Like Exa, LinkPeek's server never fetches the pages.
 *
 * Request and response shapes from Tavily's API reference (POST /search,
 * read 27 Nov 2026): Bearer key, `topic` "news" or "general",
 * `include_published_date` (a date like "Tue, 11 Mar 2025 17:00:00 GMT"),
 * `start_date` and `end_date` as YYYY-MM-DD, `max_results` up to 20,
 * `include_usage` for the credits used. 432 and 433 mean the plan's credit
 * is used up. Pay-as-you-go is $0.008 a credit, used here only to estimate cost.
 *
 * Run against the live API on 27 Nov 2026 (see docs/eval/story-live-*.md).
 */
import type { SearchQuery } from '../queries.js';
import { isoDay } from '../text.js';
import { callJson, MAX_PASSAGE_CHARS, MAX_PASSAGES, plain, webUrl, type SearchHit, type SearchOptions, type SearchOutcome, type SearchProvider } from './types.js';

export const TAVILY_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 8000;
const CREDIT_USD = 0.008;

export class TavilyProvider implements SearchProvider {
  readonly name = 'tavily';
  readonly exactPhrases = false;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome> {
    if (!this.apiKey) return { ok: false, code: 'misconfigured' };
    // Measured live on 27 Nov 2026: with a date window, "general" found the April 2025 story at CNN, BBC,
    // NPR, AP and Vatican News, while "news" gave mostly Google News redirects. Without a date, "news" keeps
    // to recent stories, which is what an undated link in a feed usually is.
    const dated = Boolean(opts.since || opts.until);
    const body = {
      query: query.text,
      topic: query.news && !dated ? 'news' : 'general',
      search_depth: 'basic',
      max_results: Math.min(opts.limit, 20),
      include_answer: false,
      include_raw_content: false,
      include_usage: true,
      include_published_date: true,
      ...(opts.since ? { start_date: opts.since } : {}),
      ...(opts.until ? { end_date: opts.until } : {}),
      ...(opts.excludeDomains?.length ? { exclude_domains: opts.excludeDomains.slice(0, 20) } : {}),
    };
    const res = await callJson(
      this.fetchImpl,
      TAVILY_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      opts.signal,
    );
    if (!res.ok) return res;
    const data = res.data as { results?: unknown; usage?: { credits?: unknown } };
    if (!Array.isArray(data.results)) return { ok: false, code: 'upstream' };
    const hits: SearchHit[] = [];
    for (const r of data.results as Record<string, unknown>[]) {
      const url = webUrl(r?.url);
      const title = plain(r?.title);
      if (!url || !title) continue;
      const passages = plain(r.content)
        .split(/\s*\[\.\.\.\]\s*/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, MAX_PASSAGES)
        .map((p) => p.slice(0, MAX_PASSAGE_CHARS));
      const published = isoDay(typeof r.published_date === 'string' ? r.published_date : undefined);
      hits.push({ url, title, ...(published ? { published } : {}), passages });
    }
    const credits = Number(data.usage?.credits);
    return { ok: true, hits, costUsd: (Number.isFinite(credits) && credits >= 0 ? credits : 1) * CREDIT_USD, provider: this.name };
  }
}
