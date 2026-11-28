// @vitest-environment node
/** The evaluation report: the Markdown and the JSON say the same, for every run there is. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runFilePath, writeReport, type RunFile } from './write';

const run = (mode: RunFile['mode']): RunFile => ({
  mode,
  ...(mode === 'live' || mode === 'live-search' ? { liveSearch: mode === 'live-search', model: 'claude-haiku-5-5', budget: { limitUsd: mode === 'live' ? 0.13 : 0.12, spentUsd: 0.01, calls: 1, refused: 0 } } : {}),
  startedAt: '2026-11-28T12:00:00.000Z',
  finishedAt: '2026-11-28T12:05:00.000Z',
  cases: [],
  extra: [],
  skipped: [],
});

describe('the evaluation report', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('includes both live stages, the recorded-search run and the real-search run, in the JSON as in the Markdown', () => {
    root = mkdtempSync(join(tmpdir(), 'story-report-'));
    mkdirSync(join(root, 'docs/eval'), { recursive: true });
    for (const mode of ['offline', 'live', 'live-search'] as const) writeFileSync(runFilePath(root, mode), JSON.stringify(run(mode)));
    const { md } = writeReport(root);
    const json = JSON.parse(readFileSync(join(root, 'docs/eval/story-live-e2e.json'), 'utf8')) as { runs: Record<string, RunFile | undefined> };
    expect(json.runs.live?.mode).toBe('live');
    expect(json.runs.liveSearch?.mode).toBe('live-search');
    expect(json.runs.offline?.mode).toBe('offline');
    expect(md).toContain('## Full end-to-end run (real Claude, real searches with page text)');
    expect(md).toContain('## Live AI run (real Claude, recorded searches)');
    // Neither stage writes over the other's results.
    expect(runFilePath(root, 'live')).not.toBe(runFilePath(root, 'live-search'));
  });

  it('without a stage 2 run, the JSON says so as the Markdown does', () => {
    root = mkdtempSync(join(tmpdir(), 'story-report-'));
    mkdirSync(join(root, 'docs/eval'), { recursive: true });
    writeFileSync(runFilePath(root, 'live'), JSON.stringify(run('live')));
    const { md } = writeReport(root);
    const json = JSON.parse(readFileSync(join(root, 'docs/eval/story-live-e2e.json'), 'utf8')) as { runs: Record<string, RunFile | undefined> };
    expect(json.runs.live?.mode).toBe('live');
    expect(json.runs).not.toHaveProperty('liveSearch.mode');
    expect(md).toMatch(/\| Full end-to-end \| \*\*Not run\*\*/);
  });
});
