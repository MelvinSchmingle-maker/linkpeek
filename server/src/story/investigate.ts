/**
 * One Story Search, from request to report:
 *
 *  1. One well-built search first (queries.ts): the headline plus the names
 *     that pin the story down. When the link's date is known, only results
 *     from 14 days before it to 30 days after it (never past today).
 *  2. Judge what it found (assess). Enough means at least two independent
 *     reports of the same story (syndicated copies count once), or one from
 *     an official source, that mention the person the link names and date
 *     from the same time.
 *  3. Only when it isn't enough, a targeted follow-up aimed at what was
 *     missing: different wording when nothing was relevant, the named person
 *     when results didn't mention them, the date when results came from
 *     different times, and other sites (the ones already found left out) when
 *     there was only one source. At most STORY_MAX_SEARCHES searches in all
 *     (3 by default). Searching stops early if the free allowance runs out.
 *  4. Results with almost nothing in common with the link are set aside
 *     (match.ts). The best five go on.
 *  5. Syndicated copies and agency reports are grouped (sources.ts).
 *  6. Claude decides which are the same story and writes the report
 *     (analyse.ts), and the rules then check it (report.ts).
 *
 * Stages reported to the extension as they really happen: "searching"
 * before the first search, "analysing" while Claude reads the results, and
 * "writing" while the rules check its reply.
 */
import { aiCostUsd, type StoryModel } from './analyse.js';
import type { SourceKind, StoryErrorCode, StoryReport, StoryRequest } from './contract.js';
import { GOOD_SCORE, linkProfile, MIN_CANDIDATE_SCORE, scoreHits, type LinkProfile, type Scored } from './match.js';
import { storyUserMessage } from './prompt.js';
import type { SearchFailure, SearchHit, SearchOptions, SearchProvider } from './providers/types.js';
import { buildQueries, type QueryPlan, type QueryPurpose, type SearchQuery } from './queries.js';
import { finalise, noMatch, noResults, reportFailed } from './report.js';
import { canonicalKey, groupReports, hostOf, isRedirectWrapper, publisherName, sourceKind } from './sources.js';
import { daysBetween } from './text.js';

/** Results asked for by the first search: enough to see the story from several sites. */
export const FIRST_RESULTS = 8;
/** Results asked for by a follow-up. */
export const FOLLOW_UP_RESULTS = 5;
/** Searches per Story Search, unless STORY_MAX_SEARCHES says otherwise. */
export const DEFAULT_MAX_SEARCHES = 3;
export const MAX_RESULTS = 12;
export const MAX_CANDIDATES = 5;
/** The search looks this far back from the link's date... */
const LOOKBACK_DAYS = 14;
/** ...and this far forward (follow-up reporting), never past today. */
const LOOKAHEAD_DAYS = 30;
/** Good results this far apart are probably about different events. */
const SPREAD_DAYS = 90;

export type Stage = { stage: 'searching' } | { stage: 'analysing'; found: number } | { stage: 'writing' };

export interface InvestigateDeps {
  provider: SearchProvider;
  model: StoryModel;
  /** Most searches one Story Search may make (1 to 5). */
  maxSearches?: number;
  now?: () => Date;
}

/** Why the results so far aren't enough. */
export type Shortfall = 'nothing-relevant' | 'name-missing' | 'dates-disagree' | 'single-source';

export type Assessment = { enough: true } | { enough: false; shortfall: Shortfall };

/** What the log line records. Counts, money and reasons only, never what was searched for. */
export interface Metrics {
  provider: string;
  /** Which providers actually answered (with a chain, the backup may have). */
  providersUsed: string[];
  queries: number;
  /** Each search's purpose, and for follow-ups the shortfall that caused it ("single-source>other-outlets"). */
  searchPath: string[];
  /** Provider error tags seen, e.g. "exa:NO_MORE_CREDITS". */
  searchErrors: string[];
  results: number;
  candidates: number;
  searchUsd: number;
  aiUsd: number;
  model?: string;
  aiFailure?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Sentences (and subjects) dropped for stating a name, number or date no kept source contains. */
  ungroundedDropped?: number;
}

export type Investigation = { ok: true; report: StoryReport; metrics: Metrics } | { ok: false; code: StoryErrorCode; metrics: Metrics };

/**
 * Are the results so far enough to stop searching? Only results that look
 * like the story count ("good"): close enough in words and names, from the
 * link's time, and naming the person the link names.
 */
export function assess(scored: Scored[], profile: LinkProfile): Assessment {
  const specific = profile.keyNames.some((n) => n.includes(' '));
  const relevant = scored.filter((s) => s.score >= GOOD_SCORE);
  const good = relevant.filter((s) => !s.dateMismatch && (!specific || s.specificFound > 0));
  if (!good.length) {
    if (!relevant.length) return { enough: false, shortfall: 'nothing-relevant' };
    if (relevant.every((s) => s.dateMismatch)) return { enough: false, shortfall: 'dates-disagree' };
    return { enough: false, shortfall: 'name-missing' };
  }
  const dates = good.map((s) => s.hit.published).filter((d): d is string => Boolean(d)).sort();
  if (dates.length >= 2 && (daysBetween(dates[0]!, dates[dates.length - 1]!) ?? 0) > SPREAD_DAYS) return { enough: false, shortfall: 'dates-disagree' };
  const hits = good.map((s) => s.hit);
  const groups = new Set(groupReports(hits).group).size;
  const official = hits.some((h) => sourceKind(h.url, h.title) === 'primary');
  return groups >= 2 || official ? { enough: true } : { enough: false, shortfall: 'single-source' };
}

/** Which follow-up suits each shortfall, best first. */
const FOLLOW_UP_ORDER: Record<Shortfall, QueryPurpose[]> = {
  'nothing-relevant': ['alternative-headline', 'description', 'headline-keywords', 'address-words', 'selection', 'names-and-event', 'nearby-text', 'broader'],
  'name-missing': ['names-and-event', 'names-event-date', 'alternative-headline', 'broader'],
  'dates-disagree': ['names-event-date', 'names-and-event', 'alternative-headline'],
  'single-source': ['other-outlets', 'names-and-event', 'alternative-headline', 'broader'],
};

export function nextQuery(plan: QueryPlan, shortfall: Shortfall, used: Set<QueryPurpose>): SearchQuery | undefined {
  for (const purpose of FOLLOW_UP_ORDER[shortfall]) {
    if (used.has(purpose)) continue;
    const q = plan.followUps.find((f) => f.purpose === purpose);
    if (q) return q;
  }
  return undefined;
}

export async function investigate(req: StoryRequest, deps: InvestigateDeps, onStage: (s: Stage) => void = () => undefined): Promise<Investigation> {
  const now = deps.now?.() ?? new Date();
  const plan = buildQueries(req, { exactPhrases: deps.provider.exactPhrases ?? true });
  const metrics: Metrics = {
    provider: deps.provider.name,
    providersUsed: [],
    queries: 0,
    searchPath: [],
    searchErrors: [],
    results: 0,
    candidates: 0,
    searchUsd: 0,
    aiUsd: 0,
  };
  const searchedFor = plan.main;
  const profile = linkProfile(req);
  const since = req.date ? lookback(req.date) : undefined;
  const until = req.date ? lookahead(req.date, now) : undefined;
  const maxSearches = Math.max(1, Math.min(5, Math.floor(deps.maxSearches ?? DEFAULT_MAX_SEARCHES)));

  onStage({ stage: 'searching' });
  const merged = new Map<string, SearchHit>();
  /** One search. Returns its failure, if it failed. */
  const runOne = async (q: SearchQuery, opts: Omit<SearchOptions, 'language'>, label: string): Promise<SearchFailure | undefined> => {
    metrics.queries++;
    metrics.searchPath.push(label);
    const o = await deps.provider.search(q, { ...opts, ...(req.language ? { language: req.language } : {}) });
    if (!o.ok) {
      if (o.tag) metrics.searchErrors.push(o.tag);
      return o.code;
    }
    metrics.searchUsd += o.costUsd;
    if (!metrics.providersUsed.includes(o.provider)) metrics.providersUsed.push(o.provider);
    for (const h of o.hits) {
      if (isRedirectWrapper(h.url)) continue;
      const key = canonicalKey(h.url);
      const prev = merged.get(key);
      // The same page twice: keep the copy with more text.
      if (!prev || h.passages.length + (h.description ? 1 : 0) > prev.passages.length + (prev.description ? 1 : 0)) merged.set(key, h);
    }
    return undefined;
  };

  if (!plan.first) return { ok: true, report: noResults(searchedFor, now), metrics };
  const window = { ...(since ? { since } : {}), ...(until ? { until } : {}) };
  const firstFailure = await runOne(plan.first, { limit: FIRST_RESULTS, ...window }, plan.first.purpose);
  if (firstFailure) return { ok: false, code: failureCode([firstFailure]), metrics };

  let scored = scoreHits(profile, [...merged.values()]);
  const used = new Set<QueryPurpose>([plan.first.purpose]);
  while (metrics.queries < maxSearches) {
    const verdict = assess(scored, profile);
    if (verdict.enough) break;
    const q = nextQuery(plan, verdict.shortfall, used);
    if (!q) break;
    used.add(q.purpose);
    const found = verdict.shortfall === 'single-source' ? [...new Set(scored.filter((s) => s.score >= GOOD_SCORE).map((s) => hostOf(s.hit.url)))] : [];
    // Looking for the same story elsewhere keeps the date window; looking more widely drops it.
    const keepDate = q.news && verdict.shortfall !== 'nothing-relevant';
    const failure = await runOne(q, { limit: FOLLOW_UP_RESULTS, ...(keepDate ? window : {}), ...(found.length ? { excludeDomains: found } : {}) }, `${verdict.shortfall}>${q.purpose}`);
    // A follow-up that fails (allowance used up, service down) ends the searching; what was found still counts.
    if (failure) break;
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
  // The model that actually answered (the API reports it), else the one configured.
  metrics.model = ai.ok ? ai.model : deps.model.name;
  if (!ai.ok) {
    metrics.aiFailure = ai.code;
    return { ok: true, report: reportFailed(req, candidates, grouping, kinds, publishers, setAside, searchedFor, now, GOOD_SCORE), metrics };
  }
  onStage({ stage: 'writing' });
  metrics.aiUsd = aiCostUsd(ai.model, ai.usage);
  metrics.inputTokens = ai.usage.inputTokens;
  metrics.outputTokens = ai.usage.outputTokens;
  metrics.cacheReadTokens = ai.usage.cacheReadTokens;
  metrics.cacheWriteTokens = ai.usage.cacheWriteTokens;
  const stats = { ungrounded: 0 };
  const report = finalise({ req, profile, candidates, grouping, kinds, publishers, ai: ai.report, setAsideEarly: setAside, olderSetAside, snippetsOnly, searchedFor, now, stats });
  metrics.ungroundedDropped = stats.ungrounded;
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
  if (failures.every((f) => f === 'misconfigured')) return 'not-configured';
  const real = failures.filter((f) => f !== 'misconfigured');
  if (real.every((f) => f === 'quota')) return 'out-of-credit';
  if (real.every((f) => f === 'timeout')) return 'search-timeout';
  return 'search-failed';
}

/** The link's date plus LOOKAHEAD_DAYS (from the end of the month for a month-only date), capped at today. */
function lookahead(date: string, now: Date): string {
  const base = /^\d{4}-\d{2}$/.test(date) ? new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)) : new Date(Date.parse(date));
  if (Number.isNaN(base.getTime())) return now.toISOString().slice(0, 10);
  const end = new Date(Math.min(base.getTime() + LOOKAHEAD_DAYS * 86_400_000, now.getTime()));
  return end.toISOString().slice(0, 10);
}

function lookback(date: string): string {
  const day = /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date;
  const t = Date.parse(day);
  return Number.isNaN(t) ? day : new Date(t - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
}
