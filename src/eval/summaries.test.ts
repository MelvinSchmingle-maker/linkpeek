/**
 * Part 05 evaluation: 20 fictional articles in eval/articles, each with a
 * hand-written expected summary in eval/expected.json. Every article goes
 * through the real pipeline (read, judge the evidence, summarise).
 *
 * Hard rules (test failures): every output is 20 words or fewer, none starts
 * with filler, and every article gets a summary. Overlap with the expected
 * summary is reported, not enforced: it's a rough guide, not a grade.
 *
 *   npm run eval    also writes docs/eval/part-05.md
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessHtml } from '../core/extract/assess';
import { extractHtml } from '../core/extract/html';
import { providersFor, summarise } from '../core/summary/engine';
import { MAX_SUMMARY_WORDS } from '../core/summary/enforce';
import { summaryInputFor } from '../core/summary/input';
import { qualityProblem } from '../core/summary/quality';
import { countWords } from '../core/summary/wordcount';
import type { Summary } from '../core/types';

interface Expected {
  headline: string;
  kind: string;
  lang: string;
  expected: string;
}

const root = process.cwd();
const expected = JSON.parse(readFileSync(join(root, 'eval/expected.json'), 'utf8')) as Record<string, Expected>;

interface Row {
  slug: string;
  kind: string;
  evidence: string;
  summary?: Summary;
  words: number;
  filler: boolean;
  overlap: number;
  expected: string;
}

/** Shared key words (unigram F1), lightly stemmed. A rough guide only. */
export function overlap(a: string, b: string): number {
  const bag = (s: string) =>
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2)
      .map((w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w));
  const x = bag(a);
  const y = bag(b);
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  for (const w of x) {
    const i = pool.indexOf(w);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  const p = hit / x.length;
  const r = hit / y.length;
  return p + r ? (2 * p * r) / (p + r) : 0;
}

async function run(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const [slug, e] of Object.entries(expected)) {
    const html = readFileSync(join(root, 'eval/articles', `${slug}.html`), 'utf8');
    const url = `https://eval.linkpeek.test/${slug}`;
    const ex = extractHtml(html, url);
    const a = assessHtml({ requestedUrl: url, finalUrl: url, status: 200 }, html, ex);
    const input = summaryInputFor(a, { headline: e.headline, url, paragraphs: ex.paragraphs, language: ex.language });
    const summary = input ? await summarise(input, providersFor('extractive')) : undefined;
    rows.push({
      slug,
      kind: e.kind,
      evidence: a.evidence,
      summary,
      words: summary ? countWords(summary.text) : 0,
      filler: summary ? qualityProblem(summary.text, '') === 'filler-opener' : false,
      overlap: summary ? overlap(summary.text, e.expected) : 0,
      expected: e.expected,
    });
  }
  return rows;
}

describe('Part 05 evaluation set (20 articles)', async () => {
  const rows = await run();

  it('has 20 articles, all read as full articles', () => {
    expect(rows).toHaveLength(20);
    for (const r of rows) expect(r.evidence, r.slug).toBe('full');
  });

  it('every article gets a summary', () => {
    expect(rows.filter((r) => !r.summary).map((r) => r.slug)).toEqual([]);
  });

  it('100% of summaries are 20 words or fewer (hard limit)', () => {
    for (const r of rows) expect(r.words, `${r.slug}: ${r.summary?.text}`).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);
  });

  it('no summary starts with filler, and none ends in "..."', () => {
    for (const r of rows) {
      expect(r.filler, r.slug).toBe(false);
      expect(r.summary?.text ?? '', r.slug).not.toMatch(/\.\.\.|…/);
    }
  });

  it.runIf(process.env.EVAL_WRITE)('writes docs/eval/part-05.md', () => {
    const made = rows.filter((r) => r.summary);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
    const cell = (s: string) => s.replace(/\|/g, '\\|');
    const md = `# Part 05 evaluation: extractive summaries

Made by \`npm run eval\` on ${new Date().toISOString().slice(0, 10)}. The 20 articles in \`eval/articles/\` are fictional and self-written; the expected summaries in \`eval/expected.json\` were written by hand before the engine was run on them.

| Measure | Result |
|---|---|
| Articles with a summary | ${made.length} of ${rows.length} |
| 20 words or fewer | ${made.filter((r) => r.words <= MAX_SUMMARY_WORDS).length} of ${made.length} |
| Starting with filler | ${made.filter((r) => r.filler).length} |
| Trimmed at a clause boundary | ${made.filter((r) => r.summary?.flags?.includes('trimmed')).length} |
| Average length | ${avg(made.map((r) => r.words)).toFixed(1)} words |
| Average key-word overlap with the expected summary | ${avg(made.map((r) => r.overlap)).toFixed(2)} (0 to 1) |

Key-word overlap counts shared words of three letters or more. It rewards the right facts and names, and says nothing about whether a summary reads well. An extractive summary is the article's own sentence, so it will never match a hand-written summary closely.

| Article | Kind | Words | Overlap | LinkPeek's summary | Expected |
|---|---|---|---|---|---|
${rows
  .map((r) => `| ${r.slug} | ${cell(r.kind)} | ${r.words} | ${r.overlap.toFixed(2)} | ${cell(r.summary?.text ?? '(none)')} | ${cell(r.expected)} |`)
  .join('\n')}
`;
    mkdirSync(join(root, 'docs/eval'), { recursive: true });
    writeFileSync(join(root, 'docs/eval/part-05.md'), md);
  });
});
