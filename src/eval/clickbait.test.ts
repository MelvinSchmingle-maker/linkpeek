/**
 * Part 07 evaluation: the headline check on two labelled sets. Free and fast,
 * so it runs with the other evaluations (npm run eval).
 *
 * - eval/headlines.json: the set the rules were tuned on, after a first run.
 * - eval/headlines-holdout.json: written after the tuning, never used to tune.
 *   Its numbers are the honest ones.
 *
 * Items with an article are checked as full evidence, with the article as a
 * short snippet, so the 150-word minimum doesn't apply here. Items without one
 * are checked as headline-only. Writes docs/eval/part-07.md when EVAL_WRITE=1.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkHeadline } from '../core/clickbait/check';
import { contentFacts } from '../core/clickbait/content';
import type { HeadlineVerdict } from '../core/types';

type Label = 'tick' | 'cross' | 'neutral';

interface Item {
  id: string;
  headline: string;
  label: Label;
  note?: string;
  article?: { published?: string; modified?: string; paragraphs: string[] };
}

const root = process.cwd();
const LABEL_OF: Record<HeadlineVerdict, Label> = { fail: 'cross', pass: 'tick', unknown: 'neutral' };

function run(file: string) {
  const { items } = JSON.parse(readFileSync(join(root, file), 'utf8')) as { items: Item[] };
  return items.map((item) => {
    const check = checkHeadline({
      headline: item.headline,
      evidence: item.article ? 'full' : 'headline-only',
      facts: item.article ? contentFacts(item.article.paragraphs) : undefined,
      published: item.article?.published,
      modified: item.article?.modified,
    });
    return { ...item, predicted: LABEL_OF[check.verdict], reason: check.reason ?? '' };
  });
}

type Row = ReturnType<typeof run>[number];

/** Precision and recall for one label, counting only the items it's meant for. */
function score(list: Row[], label: Label) {
  const tp = list.filter((r) => r.predicted === label && r.label === label).length;
  const fp = list.filter((r) => r.predicted === label && r.label !== label).length;
  const fn = list.filter((r) => r.predicted !== label && r.label === label).length;
  const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`);
  return { tp, fp, fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn) };
}

const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function section(title: string, file: string, rows: Row[]): string {
  const cross = score(rows, 'cross');
  const tick = score(rows, 'tick');
  const neutral = score(rows, 'neutral');
  const withArticle = rows.filter((r) => r.article);
  const headlineOnly = rows.filter((r) => !r.article);
  const labels: Label[] = ['cross', 'tick', 'neutral'];
  const matrix = labels
    .map((actual) => `| ${actual} | ${labels.map((p) => rows.filter((r) => r.label === actual && r.predicted === p).length).join(' | ')} |`)
    .join('\n');
  const misses = rows.filter((r) => r.predicted !== r.label);
  return `## ${title}

File: \`${file}\`, ${rows.length} headlines.

### Crosses

| | Precision | Recall | True | False | Missed |
|---|---|---|---|---|---|
| All items | ${cross.precision} | ${cross.recall} | ${cross.tp} | ${cross.fp} | ${cross.fn} |
| With the article (full evidence) | ${score(withArticle, 'cross').precision} | ${score(withArticle, 'cross').recall} | ${score(withArticle, 'cross').tp} | ${score(withArticle, 'cross').fp} | ${score(withArticle, 'cross').fn} |
| Headline only | ${score(headlineOnly, 'cross').precision} | ${score(headlineOnly, 'cross').recall} | ${score(headlineOnly, 'cross').tp} | ${score(headlineOnly, 'cross').fp} | ${score(headlineOnly, 'cross').fn} |

### Ticks and neutrals

| | Precision | Recall |
|---|---|---|
| Tick | ${tick.precision} | ${tick.recall} |
| Neutral | ${neutral.precision} | ${neutral.recall} |

### Confusion matrix (rows: label, columns: prediction)

| Label | cross | tick | neutral |
|---|---|---|---|
${matrix}

### Every item it got wrong

| Id | Headline | Label | Predicted | Reason given | Note |
|---|---|---|---|---|---|
${misses.map((r) => `| ${r.id} | ${cell(r.headline)} | ${r.label} | ${r.predicted} | ${cell(r.reason)} | ${cell(r.note)} |`).join('\n')}

### Every item

| Id | Headline | Label | Predicted | Reason given | Article |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${cell(r.headline)} | ${r.label} | ${r.predicted} | ${cell(r.reason)} | ${r.article ? 'yes' : 'no'} |`).join('\n')}
`;
}

const SETS = [
  { title: 'Labelled set (the rules were tuned on this)', file: 'eval/headlines.json' },
  { title: 'Held-out set (not used for tuning)', file: 'eval/headlines-holdout.json' },
];

describe('Part 07 evaluation: headline check', () => {
  it('has at least 80 labelled headlines in the main set', () => {
    expect(run('eval/headlines.json').length).toBeGreaterThanOrEqual(80);
  });

  it('writes docs/eval/part-07.md', () => {
    if (process.env.EVAL_WRITE !== '1') return;
    const body = SETS.map(({ title, file }) => section(title, file, run(file))).join('\n');
    const md = `# Part 07 evaluation: the headline check

Made by \`npm run eval\` on ${new Date().toISOString().slice(0, 10)}. Labels follow \`build-plan/07-clickbait-check.md\`. Free: no AI, no network.

A false cross is worse than a missed one, so precision comes first. Recall is what the check misses. The first run, before any tuning, is kept in \`docs/eval/part-07-first-run.md\`.

${body}`;
    mkdirSync(join(root, 'docs/eval'), { recursive: true });
    writeFileSync(join(root, 'docs/eval/part-07.md'), md);
  });
});
