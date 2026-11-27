/**
 * Runs one Story Search case the whole way through, with the real code at
 * every step:
 *
 *   the page's HTML → the extension's link reader (extract.ts) → what it
 *   decides to send (package.ts) → the extension's client (client.ts) →
 *   the backend's handler (handler.ts: rate limit, cache, stream) → the
 *   searches (Exa, then Tavily) → matching → Claude, or a stand-in → the
 *   report rules → the stream back → the client's checks of the report →
 *   the card's view → the card's DOM.
 *
 * The only shortcut is the network hop between the extension and the
 * backend: a function call instead of HTTP.
 *
 * Must be imported after the DOM globals are set (see story-e2e.test.ts):
 * the link reader captures DOM prototypes when it loads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// The server's copy of the SDK (the same module analyse.ts loads), for its error classes.
import Anthropic from '../../../server/node_modules/@anthropic-ai/sdk/index.mjs';
import type { MessagesClient } from '../../../server/src/anthropic';
import { AnthropicStoryModel, DEFAULT_STORY_MODEL, type StoryModel } from '../../../server/src/story/analyse';
import { MemoryReportCache } from '../../../server/src/story/cache';
import type { StoryReport as ServerReport } from '../../../server/src/story/contract';
import { handleStory, type StoryDeps } from '../../../server/src/story/handler';
import { STORY_SYSTEM_PROMPT } from '../../../server/src/story/prompt';
import { ExaProvider } from '../../../server/src/story/providers/exa';
import { ProviderChain } from '../../../server/src/story/providers/index';
import { TavilyProvider } from '../../../server/src/story/providers/tavily';
import type { SearchProvider } from '../../../server/src/story/providers/types';
import { MemoryLimiter } from '../../../server/src/ratelimit';
import { renderStoryCard } from '../../content/story-card';
import { toStoryView, type StoryState } from '../../content/story-view';
import { MSG } from '../../core/messages';
import { runStorySearch, type StoryEvent as ClientEvent } from '../../core/story/client';
import { extractStoryClues } from '../../core/story/extract';
import { buildPackage } from '../../core/story/package';
import type { StoryReport, StoryRequestBody, StoryRequestClues } from '../../core/story/types';
import { CASES, promptSources, realStandIn, toAiReport, type E2ECase, type ExaResult, type Sim, type StandIn } from './cases';
import {
  Budget,
  BudgetedModel,
  fixedFetch,
  forbiddenFetch,
  garbageFetch,
  hangingFetch,
  noAi,
  promptHash,
  recordingFetch,
  replayFetch,
  replyClient,
  savingClient,
  throwingClient,
  userMessageOf,
  WatchingProvider,
  type Exchange,
  type Recording,
  type SavedReply,
} from './harness';
import { validateReport, type Check, type Validation } from './validate';

export type SearchMode = 'replay' | 'record' | 'live';
export type AiMode = 'offline' | 'claude';
/** Where the AI's reply really came from. Only the first two are Claude. */
export type AiSource = 'claude-live' | 'claude-recorded' | 'stand-in' | 'simulated-failure' | 'not-called';

export interface RunOptions {
  search: SearchMode;
  ai: AiMode;
  /** Live Claude: the real client, and the budget shared by every call in the run. */
  claude?: { client: MessagesClient; budget: Budget };
  recordingsDir: string;
  /** Record again even when a recording exists. Off by default: searches already recorded aren't paid for twice. */
  rerecord?: boolean;
  /** Keep Claude's replies for offline replay (live runs). */
  saveClaude?: boolean;
  /** The happy-dom window the pages are loaded into. */
  window: { happyDOM: { setURL(url: string): void }; document: Document; location: { href: string } };
}

export interface SearchRecord {
  label: string;
  provider?: string;
  outcome: string;
  hits: number;
  costUsd?: number;
}

export interface CaseMetrics {
  /** Which providers were set up, in order, and which answered. */
  provider: string;
  providersUsed: string[];
  fallbackUsed: boolean;
  /** Searches LinkPeek made (queries), and HTTP requests sent to search services (a failed provider plus its backup is two). */
  searches: number;
  searchRequests: number;
  searchPath: string[];
  searchErrors: string[];
  /** Results returned by the services, results kept after merging, and results the AI read. */
  resultsRetrieved: number;
  resultsKept: number;
  articlesAnalysed: number;
  model?: string;
  aiCalls: number;
  aiFailure?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Sentences the report rules dropped for stating what their cited sources don't (D65, D69). */
  ungroundedDropped?: number;
  /** Sentences dropped because none of their quoted passages was in the source they cite (D69). */
  unverifiedDropped?: number;
  /** Sentences kept but marked weak. */
  weakClaims?: number;
  /** Sentences a cited source's own passage contradicts: dropped, or kept as weak (D69). */
  contradictedClaims?: number;
  /** Results left out as withdrawn, and sentences removed for addressing an AI (D73). */
  withdrawn?: number;
  injectionRemoved?: number;
  /** Exa's own reported cost (costDollars.total) of the searches, in dollars. */
  exaReportedUsd: number;
  /** Credits Tavily reported using (usage.credits). */
  tavilyCredits: number;
  /** Claude's cost from the tokens it reported, at list price: spent now (live) or when the reply was recorded. Undefined unless Claude wrote it. */
  aiUsd?: number;
  /** The handler's own timing, and the whole case including the link reader and the card. */
  handlerMs?: number;
  totalMs: number;
}

export interface CaseResult {
  id: string;
  title: string;
  data: 'real' | 'synthetic';
  covers: string[];
  expected: string;
  /** How each part was played this run. */
  how: { search: string; ai: string; aiSource: AiSource; aiNote?: string };
  sent?: Omit<StoryRequestClues, never>;
  outcome: string;
  stages: string[];
  report?: StoryReport;
  validation: Validation;
  card: { text: string; checks: Check[] };
  searches: SearchRecord[];
  metrics: CaseMetrics;
  /** Problems with the run itself (a stale recording, an unexpected AI call). Each fails the case. */
  problems: string[];
  recordedAt?: string;
  claudeRecordedAt?: string;
}

const INSTALL_ID = 'e2etestinstall000001';
const API = 'https://linkpeek.test/api/story';

function readJson<T>(path: string): T | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined;
}

function exaResponse(results: ExaResult[]): unknown {
  // Synthetic: nothing was spent, so the cost Exa "reports" is 0.
  return { results, costDollars: { total: 0 } };
}

/** Wraps a fetch to count requests per provider. */
function counted(f: typeof fetch, tally: Record<string, number>, name: string): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    tally[name] = (tally[name] ?? 0) + 1;
    return f(input, init);
  }) as typeof fetch;
}

function liveKey(name: 'EXA_API_KEY' | 'TAVILY_API_KEY'): string {
  // In a Claude Code cloud session the keys are network secrets: the proxy adds them, and this placeholder is replaced.
  return process.env[name]?.trim() || 'proxy-injected';
}

interface SearchSetupResult {
  chain: SearchProvider;
  /** The real (or synthetic) exchanges actually made or replayed this run. Simulated failures aren't exchanges. */
  served: () => Exchange[];
  requests: Record<string, number>;
  problems: () => string[];
  describe: string;
  recording?: Recording;
  today: string;
  save?: () => void;
}

const SYNTHETIC_TODAY = '2026-11-27';

interface SimBuild {
  /** undefined: the service has no key. */
  fetch?: typeof fetch;
  served: () => Exchange[];
  problems: () => string[];
  today?: string;
}

/** One simulated service. Replays and made-up results count as exchanges (for costs); simulated failures don't. */
function buildSim(sim: Sim, provider: 'exa' | 'tavily', caseId: string, dir: string): SimBuild {
  switch (sim.kind) {
    case 'no-key':
      return { served: () => [], problems: () => [] };
    case 'status':
      return { fetch: fixedFetch(sim.status, sim.body ?? {}), served: () => [], problems: () => [] };
    case 'garbage':
      return { fetch: garbageFetch(sim.status, sim.text), served: () => [], problems: () => [] };
    case 'hang':
      return { fetch: hangingFetch(), served: () => [], problems: () => [] };
    case 'forbidden': {
      const calls = { count: 0 };
      return { fetch: forbiddenFetch(calls), served: () => [], problems: () => (calls.count ? [`${provider} was asked ${calls.count} time(s) but shouldn't have been`] : []) };
    }
    case 'results': {
      const exchanges: Exchange[] = [];
      const data = exaResponse(sim.results);
      return {
        fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          exchanges.push({ provider, request: { method: 'POST', path: '/search', body: JSON.parse(String(init?.body ?? 'null')) }, status: 200, response: data });
          return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch,
        served: () => exchanges,
        problems: () => [],
      };
    }
    case 'replay': {
      const recording = readJson<Recording>(join(dir, `${sim.from}.json`));
      if (!recording) return { fetch: fixedFetch(500, {}), served: () => [], problems: () => [`no recording "${sim.from}" to replay: record it once with \`npm run test:story-e2e:record\``] };
      const mine = recording.exchanges.filter((e) => e.provider === provider);
      const replay = replayFetch(mine, caseId);
      return { fetch: replay.fetch, served: () => mine.slice(0, replay.served[provider]), problems: () => replay.errors, today: recording.today };
    }
    case 'sequence': {
      const steps = sim.steps.map((st) => buildSim(st, provider, caseId, dir));
      let i = 0;
      return {
        fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
          const step = steps[Math.min(i++, steps.length - 1)]!;
          return step.fetch ? step.fetch(input, init) : fixedFetch(401, {})(input, init);
        }) as typeof fetch,
        served: () => steps.flatMap((st) => st.served()),
        problems: () => steps.flatMap((st) => st.problems()),
        ...(steps.find((st) => st.today)?.today ? { today: steps.find((st) => st.today)!.today! } : {}),
      };
    }
  }
}

function setUpSearch(c: E2ECase, opts: RunOptions): SearchSetupResult {
  const requests: Record<string, number> = {};
  const file = join(opts.recordingsDir, `${c.id}.json`);
  const real = (...a: Parameters<typeof fetch>) => fetch(...a);
  const s = c.search;
  const timeout = c.searchTimeoutMs;

  if (s.kind === 'none') {
    const calls = { count: 0 };
    return {
      chain: new ProviderChain([new ExaProvider('k', counted(forbiddenFetch(calls), requests, 'exa')), new TavilyProvider('k', counted(forbiddenFetch(calls), requests, 'tavily'))]),
      served: () => [],
      requests,
      problems: () => (calls.count ? [`${calls.count} search request(s) made for a link that should send nothing`] : []),
      describe: 'none (nothing may be sent)',
      today: SYNTHETIC_TODAY,
    };
  }

  if (s.kind === 'synthetic' || s.kind === 'simulated') {
    const exaSim: Sim = s.kind === 'synthetic' ? { kind: 'sequence', steps: s.replies.map((r) => ({ kind: 'results', results: r })) } : s.exa;
    const tavilySim: Sim = s.kind === 'synthetic' ? { kind: 'no-key' } : s.tavily;
    const exa = buildSim(exaSim, 'exa', c.id, opts.recordingsDir);
    const tavily = buildSim(tavilySim, 'tavily', c.id, opts.recordingsDir);
    const label = (sim: Sim): string =>
      sim.kind === 'replay'
        ? `real results replayed from the “${sim.from}” recording`
        : sim.kind === 'results'
          ? 'made-up results'
          : sim.kind === 'sequence'
            ? sim.steps.map(label).join(', then ')
            : sim.kind === 'status'
              ? `HTTP ${sim.status}${(sim.body as { tag?: string } | undefined)?.tag ? ` ${(sim.body as { tag: string }).tag}` : ''} (simulated)`
              : sim.kind === 'garbage'
                ? `a non-JSON answer (simulated)`
                : sim.kind === 'hang'
                  ? 'no answer until its timeout (simulated)'
                  : sim.kind === 'no-key'
                    ? 'no key'
                    : 'must not be asked';
    return {
      chain: new ProviderChain([
        new ExaProvider(exa.fetch ? 'simulated' : undefined, counted(exa.fetch ?? fixedFetch(401, {}), requests, 'exa'), timeout),
        new TavilyProvider(tavily.fetch ? 'simulated' : undefined, counted(tavily.fetch ?? fixedFetch(401, {}), requests, 'tavily'), timeout),
      ]),
      served: () => [...exa.served(), ...tavily.served()],
      requests,
      problems: () => [...exa.problems(), ...tavily.problems()],
      describe: s.kind === 'synthetic' ? 'synthetic results (made up for the test, in Exa’s format)' : `Exa: ${label(exaSim)}; Tavily: ${label(tavilySim)}`,
      today: exa.today ?? tavily.today ?? SYNTHETIC_TODAY,
    };
  }

  const tavilyOnly = s.kind === 'recording-tavily';
  const exaSimulated = tavilyOnly ? fixedFetch(s.exa.status, s.exa.body) : undefined;
  const simulatedNote = tavilyOnly ? `Exa simulated (HTTP ${s.exa.status}${(s.exa.body as { tag?: string }).tag ? ` ${(s.exa.body as { tag: string }).tag}` : ''}); ` : '';

  if (opts.search === 'replay') {
    const recording = readJson<Recording>(file);
    if (!recording) {
      return {
        chain: { name: 'missing-recording', search: async () => ({ ok: false, code: 'misconfigured' }) },
        served: () => [],
        requests,
        problems: () => [`no recording at ${file}: record it once with \`npm run test:story-e2e:record\``],
        describe: 'replay (recording missing)',
        today: SYNTHETIC_TODAY,
      };
    }
    const replay = replayFetch(recording.exchanges, c.id);
    return {
      chain: new ProviderChain([
        new ExaProvider('replay', counted(exaSimulated ?? replay.fetch, requests, 'exa')),
        new TavilyProvider('replay', counted(replay.fetch, requests, 'tavily')),
      ]),
      served: () => recording.exchanges.slice(0, replay.served.exa + replay.served.tavily),
      requests,
      problems: () => [...replay.errors, ...(replay.remaining() ? [`${c.id}: ${replay.remaining()} recorded request(s) were not made: the recording is out of date`] : [])],
      describe: `${simulatedNote}replay of real ${tavilyOnly ? 'Tavily' : 'Exa/Tavily'} results recorded ${recording.recordedAt.slice(0, 10)}`,
      recording,
      today: recording.today,
    };
  }

  // Real searches: record mode saves them, live mode only uses them.
  const sink: Exchange[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const exa = new ExaProvider(liveKey('EXA_API_KEY'), counted(exaSimulated ?? recordingFetch(real, sink), requests, 'exa'));
  const tavily = new TavilyProvider(liveKey('TAVILY_API_KEY'), counted(recordingFetch(real, sink), requests, 'tavily'));
  return {
    chain: new ProviderChain([exa, tavily]),
    served: () => sink,
    requests,
    problems: () => [],
    describe: `${simulatedNote}real ${tavilyOnly ? 'Tavily' : 'Exa (then Tavily if needed)'} searches, run now`,
    today,
    ...(opts.search === 'record'
      ? {
          save: () => {
            mkdirSync(opts.recordingsDir, { recursive: true });
            const recording: Recording = {
              case: c.id,
              recordedAt: new Date().toISOString(),
              today,
              note: `Real ${tavilyOnly ? 'Tavily' : 'Exa/Tavily'} answers to the requests Story Search sent for this case, recorded by \`npm run test:story-e2e:record\`. Extracts are cut to short passages (this repository is public); no headers or keys are saved.`,
              exchanges: sink,
            };
            writeFileSync(file, `${JSON.stringify(recording, null, 2)}\n`);
          },
        }
      : {}),
  };
}

interface ModelSetup {
  model: StoryModel;
  /** How Claude's part was played, known once the case has run. */
  how: () => string;
  source: () => AiSource;
  note: () => string | undefined;
  claudeRecordedAt: () => string | undefined;
  calls: { count: number };
  problems: string[];
  save?: () => void;
}

function setUpModel(c: E2ECase, opts: RunOptions): ModelSetup {
  const calls = { count: 0 };
  const problems: string[] = [];
  const claudeFile = join(opts.recordingsDir, `${c.id}.claude.json`);
  if (opts.search === 'record') {
    return { model: noAi, how: () => 'not called (recording searches only)', source: () => 'not-called', note: () => undefined, claudeRecordedAt: () => undefined, calls, problems };
  }

  if (c.aiFailure) {
    const failure = c.aiFailure;
    const client =
      failure === 'timeout'
        ? throwingClient(new Anthropic.APIConnectionTimeoutError())
        : replyClient(() => {
            calls.count++;
            return failure === 'invalid'
              ? { model: 'stand-in', stopReason: 'end_turn', text: 'Here is the report you asked for: {"matches": [', usage: { input_tokens: 0, output_tokens: 0 } }
              : failure === 'truncated'
                ? { model: 'stand-in', stopReason: 'max_tokens', text: '{"matches": [{"source": 1, "status": "strong", "reason": "Same', usage: { input_tokens: 0, output_tokens: 0 } }
                : { model: 'stand-in', stopReason: 'refusal', text: '', usage: { input_tokens: 0, output_tokens: 0 } };
          });
    const inner = new AnthropicStoryModel(client, DEFAULT_STORY_MODEL, 'medium');
    const model: StoryModel = {
      name: inner.name,
      analyse: async (m) => {
        if (failure === 'timeout') calls.count++;
        return inner.analyse(m);
      },
    };
    return { model, how: () => `simulated Claude failure (${failure}), not a live call`, source: () => 'simulated-failure', note: () => undefined, claudeRecordedAt: () => undefined, calls, problems };
  }

  const liveAi = opts.ai === 'claude' && c.search.kind !== 'simulated' && c.search.kind !== 'none';
  if (liveAi) {
    if (!opts.claude) throw new Error('live Claude needs a client and a budget');
    const sink: SavedReply[] = [];
    const inner = new AnthropicStoryModel(savingClient(opts.claude.client, sink));
    const budgeted = new BudgetedModel(inner, opts.claude.budget, STORY_SYSTEM_PROMPT.length);
    const counting: StoryModel = {
      name: budgeted.name,
      analyse: async (m) => {
        calls.count++;
        return budgeted.analyse(m);
      },
    };
    return {
      model: counting,
      how: () => (calls.count ? `real Claude (${inner.name}), called live` : 'not called'),
      source: () => (calls.count ? 'claude-live' : 'not-called'),
      note: () => undefined,
      claudeRecordedAt: () => undefined,
      calls,
      problems,
      ...(opts.saveClaude
        ? {
            save: () => {
              if (!sink.length) return;
              mkdirSync(opts.recordingsDir, { recursive: true });
              writeFileSync(
                claudeFile,
                `${JSON.stringify({ case: c.id, note: 'Real Claude replies to this case’s prompt, saved by the live run for offline replay. Replayed only while the prompt is unchanged (promptHash). No request, headers or key are saved.', replies: sink }, null, 2)}\n`,
              );
            },
          }
        : {}),
    };
  }

  // Offline (and simulated-service cases in live runs): a saved real reply to exactly this prompt, else the stand-in.
  const source = c.reuse ?? c.id;
  const saved = [
    ...(readJson<{ replies: SavedReply[] }>(join(opts.recordingsDir, `${source}.claude.json`))?.replies ?? []),
    ...(source !== c.id ? (readJson<{ replies: SavedReply[] }>(claudeFile)?.replies ?? []) : []),
  ];
  const standIn: StandIn | undefined = c.standIn ?? (c.reuse ? CASES.find((x) => x.id === c.reuse)?.standIn : undefined) ?? realStandIn(source);
  let used: 'recorded' | 'stand-in' | undefined;
  let recordedAt: string | undefined;
  const client = replyClient((params) => {
    calls.count++;
    // For writing stand-ins: STORY_E2E_DUMP_PROMPTS=<dir> saves each prompt the AI would get.
    const dump = process.env.STORY_E2E_DUMP_PROMPTS;
    if (dump) {
      mkdirSync(dump, { recursive: true });
      writeFileSync(join(dump, `${c.id}.txt`), userMessageOf(params));
    }
    const hash = promptHash(params);
    const hit = saved.find((r) => r.promptHash === hash);
    if (hit) {
      used = 'recorded';
      recordedAt = hit.recordedAt;
      return hit;
    }
    if (!standIn) {
      problems.push('the AI was asked for a report, but this case expects it never to be (nothing close enough to send)');
      return { model: 'stand-in', stopReason: 'refusal', text: '', usage: { input_tokens: 0, output_tokens: 0 } };
    }
    used = 'stand-in';
    const src = promptSources(userMessageOf(params));
    return { model: 'stand-in', stopReason: 'end_turn', text: JSON.stringify(toAiReport(standIn.reply(src), src)), usage: { input_tokens: 0, output_tokens: 0 } };
  });
  return {
    model: new AnthropicStoryModel(client, DEFAULT_STORY_MODEL, 'medium'),
    how: () => (used === 'recorded' ? `recorded real Claude reply (saved ${recordedAt?.slice(0, 10)}), replayed` : used === 'stand-in' ? 'stand-in reply written for the test (not Claude)' : 'not called'),
    source: () => (used === 'recorded' ? 'claude-recorded' : used === 'stand-in' ? 'stand-in' : 'not-called'),
    note: () => (used === 'stand-in' ? standIn?.note : undefined),
    claudeRecordedAt: () => (used === 'recorded' ? recordedAt : undefined),
    calls,
    problems,
  };
}

function stateFor(e: ClientEvent, subject?: string): StoryState {
  if (e.kind === 'stage') return { kind: 'progress', stage: e.stage, ...(subject ? { subject } : {}) };
  if (e.kind === 'report') return { kind: 'report', report: e.report };
  return { kind: 'error', code: e.code, ...(subject ? { subject } : {}) };
}

const noop = { onClose: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, onRetry: () => undefined };

function cardChecks(c: E2ECase, card: HTMLElement, report: StoryReport | undefined, outcome: string, linkHref: string, pageUrl: string, location: string): Check[] {
  const text = card.textContent ?? '';
  const checks: Check[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, status: ok ? 'pass' : 'fail', detail });

  add('no-junk', 'No broken values on the card', !/\bundefined\b|\bNaN\b|Invalid Date|\[object Object\]/.test(text), 'no "undefined", "NaN", "Invalid Date" or "[object Object]"');
  add('not-opened', 'The original link is not opened', location === pageUrl, location === pageUrl ? 'the page stayed where it was; the card only links to the address' : `the page moved to ${location}`);
  const open = [...card.querySelectorAll<HTMLAnchorElement>('a.open')];
  if (open.length) add('open-link', 'Original link offered, not followed', open.length === 1 && open[0]!.href === linkHref && !open[0]!.target, `one "${MSG.story.openLink}" link to the address, opened only if the reader clicks it`);

  if (report && (report.status === 'report' || report.status === 'report-failed')) {
    const links = [...card.querySelectorAll<HTMLAnchorElement>('a.story-source-link')];
    const ok = report.sources.every((s) => links.some((a) => a.href === s.url && a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel)));
    add('source-links', 'Every source is a working link', ok && links.length === report.sources.length, `${links.length} source link(s) for ${report.sources.length} source(s), each opening in a new tab without a referrer`);
  }
  if (report?.status === 'report') {
    const refsOk = [...card.querySelectorAll('.refs')].length > 0 || !(report.whatHappened.length + report.confirmed.length + report.reported.length);
    add('refs', 'Claims show their source numbers', refsOk, 'source numbers appear beside the claims');
    const tags = [...card.querySelectorAll('.story-tag')].map((t) => t.textContent);
    add('confidence-shown', 'Match and confidence shown', tags.includes(MSG.story.match[report.match]) && tags.includes(MSG.story.confidence[report.confidence]), `tags: ${tags.join(', ')}`);
    if (report.notes.includes('vague-link')) add('caution', 'Says why the match is uncertain', text.includes(MSG.story.note['vague-link']), 'the vague-link explanation is shown above the report');
    else if (report.match === 'possible') add('caution', 'Says the match is only possible', text.includes(MSG.story.possibleOnly), 'the possible-match caution is shown above the report');
    if (report.subject) add('subject', 'Subject shown', text.includes(report.subject), report.subject);
  }
  const message =
    outcome === 'insufficient'
      ? MSG.story.insufficient
      : outcome === 'no-match'
        ? MSG.story.noMatch
        : outcome === 'no-results'
          ? MSG.story.noResults
          : outcome === 'report-failed'
            ? report?.sources.length
              ? MSG.story.reportFailed
              : MSG.story.noMatch
            : outcome.startsWith('error:')
              ? MSG.story.error[outcome.slice(6) as keyof typeof MSG.story.error]
              : undefined;
  if (message) add('message', 'Explains the outcome', text.includes(message), message);
  for (const s of c.card?.includes ?? []) add('includes', `Shows "${s}"`, text.includes(s), s);
  for (const s of c.card?.excludes ?? []) add('excludes', `Doesn't show "${s}"`, !text.includes(s), s);
  return checks;
}

export async function runCase(c: E2ECase, opts: RunOptions): Promise<CaseResult> {
  const started = performance.now();
  const win = opts.window;
  const doc = win.document;
  win.happyDOM.setURL(c.page.url);
  /* eslint-disable no-restricted-properties -- test fixtures, not page data */
  doc.head.innerHTML = c.page.head ?? '';
  doc.body.innerHTML = c.page.body;
  /* eslint-enable no-restricted-properties */
  const link = doc.querySelector<HTMLAnchorElement>('a[data-case]');
  if (!link) throw new Error(`${c.id}: the page needs an a[data-case]`);

  const problems: string[] = [];
  const search = setUpSearch(c, opts);
  const ai = setUpModel(c, opts);
  const watch = new WatchingProvider(search.chain);
  const logs: Record<string, unknown>[] = [];

  // 1. The extension reads the link and decides what to send.
  const clues = extractStoryClues(link, c.page.selection ? { selection: c.page.selection } : {});
  const pkg = buildPackage(clues);
  const stages: string[] = ['extracting'];
  let outcome: string;
  let report: StoryReport | undefined;
  let finalState: StoryState;
  let subject: string | undefined;

  if (!pkg.ok) {
    outcome = pkg.reason;
    finalState = { kind: pkg.reason };
  } else {
    subject = pkg.request.headline?.text;
    // What the reader is shown before agreeing: everything that will be sent.
    const confirm = renderStoryCard(toStoryView({ kind: 'confirm', preview: pkg.preview, ...(subject ? { subject } : {}) }), link.href, noop);
    const confirmText = confirm.textContent ?? '';
    for (const line of pkg.preview) if (line.label !== 'date' && !confirmText.includes(line.text)) problems.push(`the consent card doesn't show what will be sent: "${line.text}"`);

    const body: StoryRequestBody = { installId: INSTALL_ID, ...pkg.request };
    const sentText = JSON.stringify(body);
    if (new URL(c.page.url).pathname !== '/' && sentText.includes(c.page.url.replace(/^https?:\/\//, ''))) problems.push('the current page’s own address was sent');

    // 2. The backend, exactly as deployed, behind the extension's real client.
    const deps: StoryDeps = {
      provider: watch,
      model: ai.model,
      limiter: new MemoryLimiter(1000, 100_000),
      cache: new MemoryReportCache(),
      enabled: true,
      spending: 'free',
      ...(c.maxSearches ? { maxSearches: c.maxSearches } : {}),
      log: (l) => logs.push(l),
      clock: () => new Date(`${search.today}T12:00:00.000Z`),
    };
    const progress: string[] = [];
    const last = await runStorySearch(
      API,
      body,
      (e) => {
        if (e.kind === 'stage') {
          stages.push(e.stage);
          // Each stage really renders: the active step and the busy state.
          const card = renderStoryCard(toStoryView(stateFor(e, subject)), link.href, noop);
          const active = card.querySelector('[aria-current="step"]')?.textContent ?? '';
          if (!active.includes(MSG.story.stages[e.stage])) progress.push(`stage "${e.stage}" not shown as the current step`);
          if (card.querySelector('.story-body')?.getAttribute('aria-busy') !== 'true') progress.push(`stage "${e.stage}" not marked busy`);
        }
      },
      { fetchImpl: (input, init) => handleStory(new Request(String(input), init), deps), timeoutMs: 120_000 },
    );
    problems.push(...progress);
    if (last.kind === 'report') {
      report = last.report;
      outcome = report.status;
    } else if (last.kind === 'error') {
      outcome = `error:${last.code}`;
    } else {
      outcome = 'no-answer';
    }
    finalState = stateFor(last, subject);
  }

  // 3. The card the reader ends up with.
  const view = toStoryView(finalState);
  const card = renderStoryCard(view, link.href, noop);
  const cardText = (card.textContent ?? '').replace(/\s+/g, ' ').trim();

  problems.push(...search.problems(), ...ai.problems);
  search.save?.();
  ai.save?.();

  const line = logs.find((l) => l.at === 'story' && l.status === 200) as Record<string, unknown> | undefined;
  const num = (k: string) => (typeof line?.[k] === 'number' ? (line[k] as number) : undefined);
  const list = (k: string) => (Array.isArray(line?.[k]) ? (line[k] as string[]) : []);
  const served = search.served();
  const exaReportedUsd = served.filter((e) => e.provider === 'exa' && e.status === 200).reduce((sum, e) => sum + (Number((e.response as { costDollars?: { total?: unknown } })?.costDollars?.total) || 0), 0);
  const tavilyCredits = served.filter((e) => e.provider === 'tavily' && e.status === 200).reduce((sum, e) => sum + (Number((e.response as { usage?: { credits?: unknown } })?.usage?.credits) || 0), 0);
  const providersUsed = list('providersUsed');
  const aiCalls = ai.calls.count;
  const aiSource = ai.source();
  const claude = aiSource === 'claude-live' || aiSource === 'claude-recorded';
  const metrics: CaseMetrics = {
    provider: typeof line?.provider === 'string' ? line.provider : search.chain.name,
    providersUsed,
    fallbackUsed: providersUsed.some((p) => p !== 'exa'),
    searches: num('queries') ?? 0,
    searchRequests: Object.values(search.requests).reduce((a, b) => a + b, 0),
    searchPath: list('searchPath'),
    searchErrors: list('searchErrors'),
    resultsRetrieved: watch.hits.length,
    resultsKept: num('results') ?? 0,
    articlesAnalysed: num('candidates') ?? 0,
    ...(claude && typeof line?.model === 'string' ? { model: line.model } : aiSource === 'stand-in' ? { model: 'stand-in' } : aiSource === 'simulated-failure' ? { model: 'simulated failure' } : {}),
    aiCalls,
    ...(typeof line?.aiFailure === 'string' ? { aiFailure: line.aiFailure } : {}),
    ...(claude && num('inputTokens') !== undefined ? { inputTokens: num('inputTokens'), outputTokens: num('outputTokens'), cacheReadTokens: num('cacheReadTokens'), cacheWriteTokens: num('cacheWriteTokens') } : {}),
    ...(num('ungroundedDropped') !== undefined ? { ungroundedDropped: num('ungroundedDropped') } : {}),
    ...(num('unverifiedDropped') !== undefined ? { unverifiedDropped: num('unverifiedDropped') } : {}),
    ...(num('weakClaims') !== undefined ? { weakClaims: num('weakClaims') } : {}),
    ...(num('contradictedClaims') !== undefined ? { contradictedClaims: num('contradictedClaims') } : {}),
    ...(num('withdrawn') !== undefined ? { withdrawn: num('withdrawn') } : {}),
    ...(num('injectionRemoved') !== undefined ? { injectionRemoved: num('injectionRemoved') } : {}),
    exaReportedUsd: Math.round(exaReportedUsd * 1e6) / 1e6,
    tavilyCredits,
    ...(claude && num('aiUsd') !== undefined ? { aiUsd: num('aiUsd') } : {}),
    ...(num('ms') !== undefined ? { handlerMs: num('ms') } : {}),
    totalMs: Math.round(performance.now() - started),
  };

  const aiWritten = claude;
  const validation = validateReport({
    outcome,
    ...(report ? { report: report as unknown as ServerReport } : {}),
    retrieved: watch.hits,
    providersUsed,
    expect: c.expect,
    aiWritten,
  });

  return {
    id: c.id,
    title: c.title,
    data: c.data,
    covers: c.covers,
    expected: c.expected,
    how: { search: search.describe, ai: ai.how(), aiSource, ...(ai.note() ? { aiNote: ai.note() } : {}) },
    ...(pkg.ok ? { sent: pkg.request } : {}),
    outcome,
    stages,
    ...(report ? { report } : {}),
    validation,
    card: { text: cardText, checks: cardChecks(c, card, report, outcome, link.href, c.page.url, win.location.href) },
    searches: watch.calls.map((k, i) => ({ label: metrics.searchPath[i] ?? k.query.purpose, ...(k.provider ? { provider: k.provider } : {}), outcome: k.outcome, hits: k.hits, ...(k.costUsd !== undefined ? { costUsd: k.costUsd } : {}) })),
    metrics,
    problems,
    ...(search.recording ? { recordedAt: search.recording.recordedAt } : {}),
    ...(ai.claudeRecordedAt() ? { claudeRecordedAt: ai.claudeRecordedAt() } : {}),
  };
}

/** A recording exists for this case (record mode skips it unless asked to record again). */
export function hasRecording(c: E2ECase, dir: string): boolean {
  return existsSync(join(dir, `${c.id}.json`));
}
