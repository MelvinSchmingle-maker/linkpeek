/**
 * Exa (https://exa.ai), the default provider. Free: $10 of credit a month,
 * no card needed, so it can't be charged; when the credit runs out, Tavily
 * takes over (index.ts). One request returns the
 * results, short highlights from each page and, since 28 Nov 2026, the
 * page's text (up to PAGE_TEXT_CHARS), so LinkPeek's server never fetches or
 * scrapes article pages itself: no server-side fetching of arbitrary
 * addresses, and no attempt to get past paywalls (Exa gives what it has).
 *
 * Request and response shapes from Exa's API reference (POST /search, read
 * 26 and 28 Nov 2026). Exa reports what each request cost (costDollars.total),
 * and that figure is logged. Measured live: a search as LinkPeek sends it cost
 * $0.007 with highlights (27 Nov) and still $0.007 with highlights and page
 * text (28 Nov, costDollars {"total":0.007,"search":{"neural":0.007}}): on
 * /search, contents up to 10 results are in the search's price. Exa may cut a
 * page's text itself (a Reuters report came back at exactly 1,000
 * characters), so how much was received decides the evidence depth (D75).
 */
import type { SearchQuery } from '../queries.js';
import { isoDay } from '../text.js';
import { callJson, MAX_PASSAGE_CHARS, MAX_PASSAGES, PAGE_TEXT_CHARS, pageText, plain, webUrl, type SearchHit, type SearchOptions, type SearchOutcome, type SearchProvider } from './types.js';

export const EXA_URL = 'https://api.exa.ai/search';
const TIMEOUT_MS = 8000;
/** Used only if Exa doesn't report a cost: what one search cost when measured. */
const SEARCH_USD = 0.007;
const HIGHLIGHT_USD_PER_PAGE = 0;

export class ExaProvider implements SearchProvider {
  readonly name = 'exa';
  readonly exactPhrases = false;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome> {
    if (!this.apiKey) return { ok: false, code: 'misconfigured' };
    const body = {
      query: query.text,
      // Up to 10 results are included in a search's price; more would cost extra.
      numResults: Math.min(opts.limit, 10),
      type: 'auto',
      ...(query.news ? { category: 'news' } : {}),
      ...(opts.since ? { startPublishedDate: `${opts.since}T00:00:00.000Z` } : {}),
      ...(opts.until ? { endPublishedDate: `${opts.until}T23:59:59.999Z` } : {}),
      ...(opts.excludeDomains?.length ? { excludeDomains: opts.excludeDomains.slice(0, 20) } : {}),
      // Highlights for matching; the page's text (no extra cost on /search) for evidence.
      contents: { highlights: { query: query.text, maxCharacters: 1200 }, text: { maxCharacters: PAGE_TEXT_CHARS } },
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
      const raw = typeof r.text === 'string' ? r.text : '';
      const text = plain(raw);
      const passages = (highlights.length ? highlights : text ? [text] : []).slice(0, MAX_PASSAGES).map((p) => p.slice(0, MAX_PASSAGE_CHARS));
      // As much as Exa returned was asked for: it may have cut the page there.
      const page = raw ? pageText(raw, title, { cut: raw.length >= PAGE_TEXT_CHARS }) : undefined;
      hits.push({
        url,
        title,
        ...(isoDay(typeof r.publishedDate === 'string' ? r.publishedDate : undefined) ? { published: isoDay(r.publishedDate as string) } : {}),
        ...(plain(r.author) ? { author: plain(r.author).slice(0, 100) } : {}),
        passages,
        ...(page ? { text: page.text, depth: page.depth } : { depth: passages.length ? 'excerpt' : 'headline' }),
      });
    }
    const reported = Number(data.costDollars?.total);
    const costUsd = Number.isFinite(reported) && reported >= 0 ? reported : SEARCH_USD + HIGHLIGHT_USD_PER_PAGE * hits.length;
    return { ok: true, hits, costUsd, provider: this.name };
  }
}
