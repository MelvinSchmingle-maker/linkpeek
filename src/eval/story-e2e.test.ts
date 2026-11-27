// @vitest-environment node
/**
 * Story Search, end to end: from a link on a page to the card the reader
 * sees, with the real extension code and the real backend at every step
 * (see story/run.ts). Each report is checked for being right, not just for
 * being well formed (story/validate.ts).
 *
 *   npm run test:story-e2e          offline: no network, no keys, no cost. Also part of `npm test`.
 *   npm run test:story-e2e:record   real Exa and Tavily searches for real cases that have no
 *                                   recording yet, saved for replay (uses free search credit once)
 *   npm run test:story-e2e:live     real Claude on the recorded searches (LINKPEEK_ANTHROPIC_API_KEY),
 *                                   stopped before spending could pass STORY_E2E_BUDGET_USD ($0.25)
 *
 *   STORY_E2E_LIVE_SEARCH=1   with :live, search for real too (spends search credit; off by default)
 *   STORY_E2E_CASES=pope,vague   only these cases
 *   STORY_E2E_RERECORD=1      with :record, search again even where a recording exists
 *   STORY_E2E_WRITE=1         save this run's results and rewrite docs/eval/story-live-e2e.md
 *
 * Runs in plain Node, as the backend does on Vercel: in a browser-like
 * environment the Anthropic SDK refuses to start. The extension's code gets
 * a DOM from happy-dom, set up before that code is loaded (it captures DOM
 * prototypes when it loads), and without a `window`, so the SDK still sees
 * Node.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MessagesClient } from '../../server/src/anthropic';
import { handleStory } from '../../server/src/story/handler';
import { MemoryReportCache } from '../../server/src/story/cache';
import { searchProviderFor, spendingMode } from '../../server/src/story/providers/index';
import { MemoryLimiter } from '../../server/src/ratelimit';
import { DEFAULT_STORY_MODEL } from '../../server/src/story/analyse';
import { CASES, type E2ECase } from './story/cases';
import { Budget, noAi } from './story/harness';
import type { CaseResult, RunOptions } from './story/run';
import { runFilePath, writeReport, type RunFile } from './story/write';

const MODE = (['offline', 'record', 'live'] as const).find((m) => m === process.env.STORY_E2E_MODE) ?? 'offline';
const WRITE = process.env.STORY_E2E_WRITE === '1';
const LIVE_SEARCH = MODE === 'live' && process.env.STORY_E2E_LIVE_SEARCH === '1';
const RERECORD = process.env.STORY_E2E_RERECORD === '1';
const BUDGET_USD = Number(process.env.STORY_E2E_BUDGET_USD ?? '0.25');
const ONLY = process.env.STORY_E2E_CASES?.split(',').map((s) => s.trim()).filter(Boolean);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RECORDINGS = join(ROOT, 'src/eval/story/recordings');
const TIMEOUT = MODE === 'offline' ? 20_000 : 180_000;

const win = new Window({ url: 'https://news.example.com/' });
Object.assign(globalThis, {
  Element: win.Element,
  Node: win.Node,
  NodeFilter: win.NodeFilter,
  HTMLElement: win.HTMLElement,
  HTMLAnchorElement: win.HTMLAnchorElement,
  document: win.document,
});

const selected = CASES.filter((c) => !ONLY || ONLY.includes(c.id));
const recordable = (c: E2ECase) => c.search.kind === 'recording' || c.search.kind === 'recording-tavily';

const results: CaseResult[] = [];
const extra: RunFile['extra'] = [];
const skipped: RunFile['skipped'] = [];
const startedAt = new Date().toISOString();
let budget: Budget | undefined;
let runCase: typeof import('./story/run').runCase;
let hasRecording: typeof import('./story/run').hasRecording;
let opts: RunOptions;

function failures(r: CaseResult): string[] {
  return [...r.validation.checks, ...r.card.checks].filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.detail}`);
}

beforeAll(async () => {
  ({ runCase, hasRecording } = await import('./story/run'));
  let claude: RunOptions['claude'];
  if (MODE === 'live') {
    // Present or not: never its value.
    const key = process.env.LINKPEEK_ANTHROPIC_API_KEY?.trim();
    if (!key) throw new Error('Live mode needs LINKPEEK_ANTHROPIC_API_KEY in the environment (it is never printed or saved).');
    const { default: Anthropic } = await import('../../server/node_modules/@anthropic-ai/sdk/index.mjs');
    // An explicit address and no retries: one request per case, never repeated behind our back.
    const client = new Anthropic({ apiKey: key, baseURL: 'https://api.anthropic.com', timeout: 30_000, maxRetries: 0 }) as unknown as MessagesClient;
    budget = new Budget(BUDGET_USD);
    claude = { client, budget };
  }
  opts = {
    search: MODE === 'record' ? 'record' : LIVE_SEARCH ? 'live' : 'replay',
    ai: MODE === 'live' ? 'claude' : 'offline',
    ...(claude ? { claude } : {}),
    recordingsDir: RECORDINGS,
    rerecord: RERECORD,
    saveClaude: MODE === 'live',
    window: win as unknown as RunOptions['window'],
  };
});

describe(`Story Search end to end (${MODE}${LIVE_SEARCH ? ', live search' : ''})`, () => {
  for (const c of selected) {
    it(`${c.id}: ${c.title}`, { timeout: TIMEOUT }, async () => {
      if (MODE === 'record') {
        if (!recordable(c)) {
          skipped.push({ id: c.id, reason: 'uses synthetic or simulated search answers: nothing to record' });
          return;
        }
        if (hasRecording(c, RECORDINGS) && !RERECORD) {
          skipped.push({ id: c.id, reason: 'already recorded; not searched again (STORY_E2E_RERECORD=1 to search again)' });
          return;
        }
        const r = await runCase(c, opts);
        results.push(r);
        // Recording checks only that the real services answered; the report is judged when replayed.
        expect(r.outcome, 'the real search should answer').not.toMatch(/^error:/);
        expect(r.metrics.resultsRetrieved, 'results from the real search').toBeGreaterThan(0);
        return;
      }
      const r = await runCase(c, opts);
      results.push(r);
      expect(r.problems, 'problems with the run').toEqual([]);
      expect(failures(r), 'failed checks').toEqual([]);
      if (c.search.kind === 'none') expect(r.metrics.searchRequests).toBe(0);
    });
  }

  it.skipIf(MODE === 'record')('free mode never turns into paid mode, whatever is configured', { timeout: TIMEOUT }, async () => {
    const real = globalThis.fetch;
    const calls = { exa: 0, tavily: 0, brave: 0 };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const host = new URL(String(input)).hostname;
      const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (host.endsWith('exa.ai')) return (calls.exa++, reply(402, { tag: 'NO_MORE_CREDITS' }));
      if (host.endsWith('tavily.com')) return (calls.tavily++, reply(432, {}));
      if (host.endsWith('brave.com')) return (calls.brave++, reply(200, { results: [{ title: 'Pope Francis dies aged 88', url: 'https://www.vaticannews.va/x', description: 'Pope Francis died.' }] }));
      return reply(500, {});
    }) as typeof fetch;
    const keys = { EXA_API_KEY: 'x', TAVILY_API_KEY: 'x', BRAVE_SEARCH_API_KEY: 'x' };
    const body = { installId: 'e2etestinstall000002', url: 'https://news.example.com/2025/04/21/pope-francis-dies-aged-88', headline: { text: 'Pope Francis dies aged 88', from: 'link-text', confidence: 'high' }, date: '2025-04-21', dateFrom: 'url-date' };
    const envs: Record<string, string>[] = [
      { ...keys, STORY_SEARCH_PROVIDER: 'brave,exa,tavily' },
      { ...keys, STORY_SEARCH_PROVIDER: 'brave', STORY_SPENDING: 'free' },
      { ...keys, STORY_SEARCH_PROVIDER: 'exa,tavily,brave', STORY_SPENDING: 'yes please' },
    ];
    try {
      for (const env of envs) {
        const before = { ...calls };
        const logs: Record<string, unknown>[] = [];
        const res = await handleStory(new Request('https://linkpeek.test/api/story', { method: 'POST', body: JSON.stringify(body) }), {
          provider: searchProviderFor(env),
          model: noAi,
          limiter: new MemoryLimiter(100, 1000),
          cache: new MemoryReportCache(),
          enabled: true,
          spending: spendingMode(env),
          log: (l) => logs.push(l),
        });
        const last = (await res.text()).trim().split('\n').pop()!;
        const ok = calls.brave === before.brave && spendingMode(env) === 'free' && /out-of-credit|not-configured/.test(last);
        extra.push({
          name: `Free mode with ${env.STORY_SEARCH_PROVIDER}${env.STORY_SPENDING ? ` and STORY_SPENDING=${env.STORY_SPENDING}` : ''}`,
          status: ok ? 'pass' : 'fail',
          detail: `answer ${last}; Brave asked ${calls.brave - before.brave} time(s); Exa ${calls.exa - before.exa}, Tavily ${calls.tavily - before.tavily}; logged spending "${logs.at(-1)?.spending}"`,
        });
        expect(calls.brave, 'Brave (paid) must never be asked in free mode').toBe(before.brave);
        expect(spendingMode(env)).toBe('free');
      }
      // Paid is only ever an explicit setting.
      const paid = searchProviderFor({ ...keys, STORY_SEARCH_PROVIDER: 'exa,tavily,brave', STORY_SPENDING: 'paid' });
      extra.push({ name: 'Paid mode only by explicit setting', status: paid.name.includes('brave') ? 'pass' : 'fail', detail: `STORY_SPENDING=paid gives "${paid.name}"; nothing in the code sets it` });
      expect(paid.name).toContain('brave');
    } finally {
      globalThis.fetch = real;
    }
  });

  it.skipIf(MODE !== 'live')('Claude answered with the configured model, inside the budget', () => {
    const configured = process.env.STORY_MODEL?.trim() || DEFAULT_STORY_MODEL;
    const served = [...new Set(results.map((r) => r.metrics.model).filter((m): m is string => Boolean(m) && m !== 'stand-in'))];
    extra.push({ name: 'Model', status: served.every((m) => m.startsWith(configured)) ? 'pass' : 'fail', detail: `configured ${configured}; answered by ${served.join(', ') || 'none'}` });
    extra.push({ name: 'Budget', status: budget!.spentUsd <= budget!.limitUsd ? 'pass' : 'fail', detail: `$${budget!.spentUsd.toFixed(5)} of $${budget!.limitUsd.toFixed(2)}, ${budget!.calls} call(s), ${budget!.refused} refused` });
    expect(served.every((m) => m.startsWith(configured))).toBe(true);
    expect(budget!.spentUsd).toBeLessThanOrEqual(budget!.limitUsd);
  });
});

afterAll(() => {
  if (!WRITE) return;
  const run: RunFile = {
    mode: MODE,
    ...(MODE === 'live' ? { liveSearch: LIVE_SEARCH, model: process.env.STORY_MODEL?.trim() || DEFAULT_STORY_MODEL } : {}),
    startedAt,
    finishedAt: new Date().toISOString(),
    ...(budget ? { budget: { limitUsd: budget.limitUsd, spentUsd: budget.spentUsd, calls: budget.calls, refused: budget.refused } } : {}),
    cases: results,
    extra,
    skipped,
  };
  writeFileSync(runFilePath(ROOT, MODE), `${JSON.stringify(run, null, 2)}\n`);
  writeReport(ROOT);
});
