/**
 * Story Search end-to-end evaluation (src/eval/story-e2e.test.ts).
 *
 *   npm run test:story-e2e           offline: no network, no keys, no cost
 *   npm run test:story-e2e:record    real Exa/Tavily searches, only for real cases not yet recorded
 *   npm run test:story-e2e:live      real Claude on the recorded searches; needs LINKPEEK_ANTHROPIC_API_KEY;
 *                                    stops before spending could pass $0.25 (STORY_E2E_BUDGET_USD)
 *   npm run test:story-e2e:report    runs every suite (types, unit, backend, offline end to end,
 *                                    browser, build) and writes docs/eval/story-live-e2e.md and .json
 *
 * Record and live runs go through the environment's HTTPS proxy (NODE_USE_ENV_PROXY=1), which in a
 * Claude Code cloud session is where the Exa and Tavily keys are added. Live runs and recordings
 * write their results; offline runs write them only with STORY_E2E_WRITE=1 (or via :report).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'offline';
const win = process.platform === 'win32';
const run = (cmd, args, env = {}, opts = {}) => spawnSync(cmd, args, { stdio: opts.capture ? 'pipe' : 'inherit', shell: win, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const vitest = (env, extra = []) => run('npx', ['vitest', 'run', 'src/eval/story-e2e.test.ts', '--reporter=verbose', ...extra], env);

if (mode === 'offline' || mode === 'record' || mode === 'live') {
  if (mode === 'live' && !process.env.LINKPEEK_ANTHROPIC_API_KEY) {
    console.error('Live mode needs LINKPEEK_ANTHROPIC_API_KEY (never ANTHROPIC_API_KEY, which Claude Code would use for itself).');
    process.exit(1);
  }
  const env = { STORY_E2E_MODE: mode };
  if (mode !== 'offline') Object.assign(env, { NODE_USE_ENV_PROXY: '1', STORY_E2E_WRITE: process.env.STORY_E2E_WRITE ?? '1' });
  process.exit(vitest(env).status ?? 1);
}

if (mode !== 'report') {
  console.error(`Unknown mode "${mode}": use offline, record, live or report.`);
  process.exit(1);
}

// ---------- report: every suite, counted, then the offline run writes the report ----------

const out = mkdtempSync(join(tmpdir(), 'story-e2e-'));
const suites = [];
const now = () => new Date().toISOString();
const vitestCounts = (file) => {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  return { passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests + (j.numTodoTests ?? 0) };
};
const step = (name, category, command, fn, note) => {
  console.log(`\n=== ${name}: ${command}`);
  let counts;
  try {
    counts = fn();
  } catch (e) {
    counts = { passed: 0, failed: 1, skipped: 0, note: `could not run: ${e.message}` };
  }
  suites.push({ name, category, command, ...counts, ...(note && !counts.note ? { note } : {}), ranAt: now() });
};
const pass = (r) => ({ passed: r.status === 0 ? 1 : 0, failed: r.status === 0 ? 0 : 1, skipped: 0 });

step('Extension types', 'Build', 'npm run typecheck', () => pass(run('npm', ['run', 'typecheck'])), 'TypeScript, no emit');
step('Backend types', 'Build', 'npm --prefix server run typecheck', () => pass(run('npm', ['--prefix', 'server', 'run', 'typecheck'])), 'TypeScript, no emit');
step(
  'Extension unit tests',
  'Unit',
  'npm test (without the end-to-end suite)',
  () => {
    run('npx', ['vitest', 'run', '--exclude', 'src/eval/story-e2e.test.ts', '--reporter=dot', '--reporter=json', `--outputFile.json=${join(out, 'unit.json')}`]);
    return vitestCounts(join(out, 'unit.json'));
  },
  'Mocked browser APIs (happy-dom); no network',
);
step(
  'Backend unit tests',
  'Unit',
  'npm --prefix server test',
  () => {
    run('npm', ['--prefix', 'server', 'test', '--', '--reporter=json', `--outputFile.json=${join(out, 'server.json')}`]);
    return vitestCounts(join(out, 'server.json'));
  },
  'Stand-in search services and Claude client; no network',
);
step(
  'Browser tests (whole extension)',
  'Browser',
  'npm run test:e2e',
  () => {
    const b = run('npm', ['run', 'build:e2e']);
    if (b.status !== 0) return { passed: 0, failed: 1, skipped: 0, note: 'test build failed' };
    const r = run('npx', ['playwright', 'test', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_NAME: join(out, 'browser.json') }, { capture: true });
    const j = JSON.parse(readFileSync(join(out, 'browser.json'), 'utf8'));
    const failedTitles = [];
    const walk = (s) => {
      for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) if (t.status === 'unexpected') failedTitles.push(`${s.title} › ${spec.title}`);
      for (const c of s.suites ?? []) walk(c);
    };
    for (const s of j.suites ?? []) walk(s);
    const story = [];
    const walkStory = (s, inStory) => {
      const here = inStory || /story\.spec\.ts$/.test(s.file ?? s.title ?? '');
      for (const spec of s.specs ?? []) if (here) for (const t of spec.tests ?? []) story.push(t.status);
      for (const c of s.suites ?? []) walkStory(c, here);
    };
    for (const s of j.suites ?? []) walkStory(s, false);
    writeFileSync(join(out, 'browser-failed.txt'), failedTitles.join('\n'));
    if (r.status !== 0 && !j.stats) throw new Error('Playwright did not report');
    return {
      passed: j.stats.expected + (j.stats.flaky ?? 0),
      failed: j.stats.unexpected,
      skipped: j.stats.skipped,
      note: `Real Chromium with the real extension build; the Story Search backend is a local stand-in (scripts/serve-test-pages.mjs). Story Search tests: ${story.filter((s) => s === 'expected' || s === 'flaky').length} of ${story.length} passed.${failedTitles.length ? ` Failed: ${failedTitles.join('; ')}` : ''}${j.stats.flaky ? ` ${j.stats.flaky} flaky (passed on retry)` : ''}`,
    };
  },
);
step('Production build', 'Build', 'npm run build', () => pass(run('npm', ['run', 'build'])), 'The extension as it would ship');

writeFileSync('src/eval/story/suite-results.json', `${JSON.stringify({ note: 'Written by npm run test:story-e2e:report. Counts from each suite’s own JSON reporter.', suites }, null, 2)}\n`);
console.log('\n=== Story Search end to end (offline), writing the report');
const r = vitest({ STORY_E2E_MODE: 'offline', STORY_E2E_WRITE: '1' });
console.log('\nSuites:');
for (const s of suites) console.log(`  ${s.category.padEnd(20)} ${s.name.padEnd(34)} ${s.failed ? `${s.failed} FAILED, ` : ''}${s.passed} passed${s.skipped ? `, ${s.skipped} skipped` : ''}`);
console.log('Report: docs/eval/story-live-e2e.md');
process.exit(r.status ?? 1);
