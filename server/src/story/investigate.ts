/**
 * One Story Search, from request to report:
 *
 *  1. Queries from the link's clues (queries.ts). Two or three to start.
 *  2. Search, all starting queries at once. Results are merged and the same
 *     page under different addresses counted once.
 *  3. If fewer than two results look like the story, one or two broader
 *     queries run. Never more.
 *  4. Results with almost nothing in common with the link are set aside
 *     (match.ts). The best five go on.
 *  5. Syndicated copies and agency reports are grouped (sources.ts).
 *  6. Claude decides which are the same story and writes the report
 *     (analyse.ts), and the rules then check it (report.ts).
 *
 * Stages reported to the extension as they really happen: "searching"
 * before the first query, "analysing" while Claude reads the results, and
 * "writing" while the rules check its reply.
 *
 * Search spend is bounded: at most 4 queries of 6 results each, and the AI
 * sees at most 5 results, each cut to about 1,600 characters.
 */
import { aiCostUsd, type StoryModel } from './analyse.js';
import type { SourceKind, StoryErrorCode, StoryReport, StoryRequest } from './contract.js';
import { GOOD_SCORE, linkProfile, MIN_CANDIDATE_SCORE, scoreHits, type Scored } from './match.js';
import { storyUserMessage } from './prompt.js';
import type { SearchFailure, SearchHit, SearchProvider } from './providers/types.js';
import { buildQueries, type SearchQuery } from './queries.js';
import { finalise, noMatch, noResults, reportFailed } from './report.js';
import { canonicalKey, groupReports, publisherName, sourceKind } from './sources.js';

export const RESULTS_PER_QUERY = 6;
export const MAX_RESULTS = 12;
export const MAX_CANDIDATES = 5;
/** How many results must look like the story before no broader search is needed. */
const ENOUGH_GOOD = 2;
/** The search looks this far back from the link's date. */
const LOOKBACK_DAYS = 14;

export type Stage = { stage: 'searching' } | { stage: 'analysing'; found: number } | { stage: 'writing' };

export interface InvestigateDeps {
  provider: SearchProvider;
  model: StoryModel;
  now?: () => Date;
}

/** What the log line records. Counts and money only, never what was searched for. */
export interface Metrics {
  provider: string;
  queries: number;
  results: number;
  candidates: number;
  searchUsd: number;
  aiUsd: number;
  model?: string;
  aiFailure?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type Investigation = { ok: true; report: StoryReport; metrics: Metrics } | { ok: false; code: StoryErrorCode; metrics: Metrics };

export async function investigate(req: StoryRequest, deps: InvestigateDeps, onStage: (s: Stage) => void = () => undefined): Promise<Investigation> {
  const now = deps.now?.() ?? new Date();
  const plan = buildQueries(req);
  const metrics: Metrics = { provider: deps.provider.name, queries: 0, results: 0, candidates: 0, searchUsd: 0, aiUsd: 0 };
  const searchedFor = plan.main;
  const profile = linkProfile(req);
  const since = req.date ? lookback(req.date) : undefined;

  onStage({ stage: 'searching' });
  const merged = new Map<string, SearchHit>();
  const failures: SearchFailure[] = [];
  const run = async (queries: SearchQuery[], withSince: boolean) => {
    const outcomes = await Promise.all(
      queries.map((q) =>
        deps.provider.search(q, { limit: RESULTS_PER_QUERY, ...(withSince && since ? { since } : {}), ...(req.language ? { language: req.language } : {}) }),
      ),
    );
    metrics.queries += queries.length;
    for (const o of outcomes) {
      if (!o.ok) {
        failures.push(o.code);
        continue;
      }
      metrics.searchUsd += o.costUsd;
      for (const h of o.hits) {
        const key = canonicalKey(h.url);
        const prev = merged.get(key);
        // The same page twice: keep the copy with more text.
        if (!prev || h.passages.length + (h.description ? 1 : 0) > prev.passages.length + (prev.description ? 1 : 0)) merged.set(key, h);
      }
    }
  };

  if (!plan.initial.length) return { ok: true, report: noResults(searchedFor, now), metrics };
  await run(plan.initial, true);
  if (failures.length === plan.initial.length) return { ok: false, code: failureCode(failures), metrics };

  let scored = scoreHits(profile, [...merged.values()]);
  if (scored.filter((s) => s.score >= GOOD_SCORE).length < ENOUGH_GOOD && plan.expansion.length) {
    await run(plan.expansion, false);
    scored = scoreHits(profile, [...merged.values()]);
  }
  scored = scored.slice(0, MAX_RESULTS);
  metrics.results = scored.length;
  if (!scored.length) return { ok: true, report: noResults(searchedFor, now), metrics };

  const candidates = pickCandidates(scored);
  metrics.candidates = candidates.length;
  const setAside = scored.length - candidates.length;
  const olderSetAside = scored.some((s) => !candidates.includes(s) && s.dateMismatch && s.score >= MIN_CANDIDATE_SCORE);
  if (!candidates.length) return { ok: true, report: noMatch(setAside, olderSetAside, searchedFor, now), metrics };

  onStage({ stage: 'analysing', found: candidates.length });
  const hits = candidates.map((c) => c.hit);
  const grouping = groupReports(hits);
  const kinds: SourceKind[] = hits.map((h) => sourceKind(h.url, h.title));
  const publishers = hits.map((h) => publisherName(h.url, h.publisher));
  const snippetsOnly = hits.every((h) => h.passages.length === 0);

  // The AI call is the long part: it decides which results are the story, then writes. The checks after it are quick.
  const ai = await deps.model.analyse(storyUserMessage(req, candidates, grouping, now.toISOString().slice(0, 10), kinds, publishers));
  metrics.model = deps.model.name;
  if (!ai.ok) {
    metrics.aiFailure = ai.code;
    return { ok: true, report: reportFailed(req, candidates, grouping, kinds, publishers, setAside, searchedFor, now, GOOD_SCORE), metrics };
  }
  onStage({ stage: 'writing' });
  metrics.aiUsd = aiCostUsd(ai.model, ai.usage);
  metrics.inputTokens = ai.usage.inputTokens;
  metrics.outputTokens = ai.usage.outputTokens;
  const report = finalise({ req, profile, candidates, grouping, kinds, publishers, ai: ai.report, setAsideEarly: setAside, olderSetAside, snippetsOnly, searchedFor, now });
  return { ok: true, report, metrics };
}

/**
 * The best results for the AI to read: anything above the floor, best first,
 * with official sources and news agencies ahead of social media at equal
 * scores. Search ranking alone is never taken as a sign of reliability.
 */
function pickCandidates(scored: Scored[]): Scored[] {
  const rank: Record<SourceKind, number> = { primary: 0, agency: 0, news: 1, other: 2, opinion: 3, social: 3 };
  return scored
    .filter((s) => s.score >= MIN_CANDIDATE_SCORE)
    .map((s) => ({ s, r: rank[sourceKind(s.hit.url, s.hit.title)] }))
    .sort((a, b) => (Math.abs(a.s.score - b.s.score) < 0.05 ? a.r - b.r : b.s.score - a.s.score))
    .slice(0, MAX_CANDIDATES)
    .map(({ s }) => s);
}

function failureCode(failures: SearchFailure[]): StoryErrorCode {
  if (failures.includes('misconfigured')) return 'not-configured';
  if (failures.every((f) => f === 'timeout')) return 'search-timeout';
  return 'search-failed';
}

function lookback(date: string): string {
  const day = /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date;
  const t = Date.parse(day);
  return Number.isNaN(t) ? day : new Date(t - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
}
