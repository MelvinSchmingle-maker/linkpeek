/**
 * Writes the Story Search evaluation report: docs/eval/story-live-e2e.md for
 * people and docs/eval/story-live-e2e.json for tools.
 *
 * Each run of the end-to-end suite saves its own results
 * (docs/eval/story-e2e-<mode>.json); the report combines the latest of each,
 * plus the other suites' counts (suite-results.json), so an offline run never
 * overwrites what a live run found, and a mocked result is never shown as a
 * live one. No keys and no personal details go in: only what was searched
 * for, what came back, and what LinkPeek made of it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseResult } from './run';

export interface RunFile {
  mode: 'offline' | 'record' | 'live';
  /** For live runs: whether the searches were real too, or replayed. */
  liveSearch?: boolean;
  startedAt: string;
  finishedAt: string;
  model?: string;
  budget?: { limitUsd: number; spentUsd: number; calls: number; refused: number };
  cases: CaseResult[];
  /** Checks outside the cases (free mode can't turn paid, and so on). */
  extra: { name: string; status: 'pass' | 'fail'; detail: string }[];
  /** Cases skipped, and why. */
  skipped: { id: string; reason: string }[];
}

export interface SuiteCount {
  name: string;
  category: 'Unit' | 'Offline integration' | 'Live search' | 'Live AI' | 'Full end-to-end' | 'Browser' | 'Build';
  command: string;
  passed: number;
  failed: number;
  skipped: number;
  note?: string;
  ranAt: string;
}

const EVAL = 'docs/eval';

export function runFilePath(root: string, mode: RunFile['mode']): string {
  return join(root, EVAL, `story-e2e-${mode}.json`);
}

function git(root: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function readJson<T>(path: string): T | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined;
}

const usd = (n: number | undefined, digits = 4) => (n === undefined ? '–' : `$${n.toFixed(digits)}`);
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function statusMark(s: string): string {
  return s === 'pass' ? 'pass' : s === 'fail' ? '**FAIL**' : s === 'review' ? 'review' : 'n/a';
}

function casePassed(r: CaseResult): boolean {
  return r.validation.passed && r.card.checks.every((c) => c.status !== 'fail') && r.problems.length === 0;
}

function caseSection(r: CaseResult, live: boolean): string[] {
  const out: string[] = [];
  const rep = r.report;
  out.push(`### ${r.title}`, '');
  out.push(`- Case \`${r.id}\`, ${r.data === 'real' ? 'real search results' : 'synthetic data (made up for the test)'}. Covers: ${r.covers.join(', ')}.`);
  out.push(`- Search: ${r.how.search}.`);
  out.push(`- AI: ${r.how.ai}.${r.how.aiNote ? ` ${r.how.aiNote}` : ''}`);
  if (r.sent) {
    const sent = [
      r.sent.headline ? `headline “${r.sent.headline.text}” (${r.sent.headline.from})` : undefined,
      ...(r.sent.altHeadlines ?? []).map((a) => `other wording “${a.text}” (${a.from})`),
      r.sent.description ? `teaser “${r.sent.description.text}”` : undefined,
      r.sent.slug ? `address words “${r.sent.slug}”` : undefined,
      r.sent.date ? `date ${r.sent.date} (${r.sent.dateFrom})` : undefined,
      `address ${r.sent.url}`,
    ].filter(Boolean);
    out.push(`- What the extension sent: ${sent.join('; ')}.`);
  } else {
    out.push('- What the extension sent: nothing.');
  }
  out.push(`- Expected: ${r.expected}`);
  out.push(
    `- Actual: **${r.outcome}**${rep ? `, match **${rep.match}**, confidence **${rep.confidence}**${rep.subject ? `, subject “${rep.subject}”` : ', no subject'}${rep.notes.length ? `, notes: ${rep.notes.join(', ')}` : ''}` : ''}.`,
  );
  out.push(`- Result: ${casePassed(r) ? 'pass' : '**FAIL**'}${r.how.aiSource === 'stand-in' ? ' (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s)' : r.how.aiSource === 'simulated-failure' ? ' (a simulated Claude failure, not a live call)' : ''}.`);
  if (r.problems.length) out.push('- Problems:', ...r.problems.map((p) => `  - ${p}`));
  out.push('');

  if (rep && (rep.whatHappened.length || rep.confirmed.length || rep.reported.length || rep.unclear.length)) {
    out.push('Report as shown:', '');
    const claims = (h: string, list: { text: string; sources: number[] }[]) => {
      if (!list.length) return;
      out.push(`- ${h}:`);
      for (const c of list) out.push(`  - ${c.text}${c.sources.length ? ` [${c.sources.join(', ')}]` : ''}`);
    };
    claims('What happened', rep.whatHappened);
    claims('Key details', rep.details.map((d) => ({ text: `${d.label}: ${d.text}`, sources: d.sources })));
    claims('Confirmed', rep.confirmed);
    claims('Reported by one source', rep.reported);
    claims('Unclear', rep.unclear);
    out.push('');
  }
  if (rep?.sources.length) {
    out.push('Sources:', '');
    for (const s of rep.sources) {
      out.push(`${s.n}. [${esc(s.title)}](${s.url}) · ${s.publisher} · ${s.published ?? 'no date'} · ${s.kind} · ${s.match} match${s.copyOf ? ` · repeats ${s.copyOf}` : ''}${s.via ? ` · credits ${s.via}` : ''}${s.original ? ' · the linked article' : ''}`);
    }
    out.push('');
  }

  out.push('| Check | Result | Detail |', '|---|---|---|');
  for (const c of r.validation.checks) out.push(`| ${c.label} | ${statusMark(c.status)} | ${esc(c.detail)} |`);
  for (const c of r.card.checks) out.push(`| Card: ${c.label} | ${statusMark(c.status)} | ${esc(c.detail)} |`);
  out.push('');

  const m = r.metrics;
  out.push(
    `Metrics: ${m.searches} search(es) (${m.searchPath.join(' → ') || 'none'}), ${m.searchRequests} HTTP request(s)${Object.keys(m).length ? '' : ''}, answered by ${m.providersUsed.join(', ') || 'nobody'}${m.fallbackUsed ? ' (fallback used)' : ''}${m.searchErrors.length ? `, provider errors ${m.searchErrors.join(', ')}` : ''}; ${m.resultsRetrieved} result(s) retrieved, ${m.resultsKept} kept, ${m.articlesAnalysed} analysed; ${m.aiCalls} AI call(s)${m.model ? ` (${m.model})` : ''}${m.inputTokens !== undefined ? `, ${m.inputTokens} tokens in, ${m.outputTokens} out` : ''}${m.aiFailure ? `, AI failed: ${m.aiFailure}` : ''}; Exa ${usd(m.exaReportedUsd)} as reported by Exa, Tavily ${m.tavilyCredits} credit(s), Claude ${m.aiUsd === undefined ? '–' : `${usd(m.aiUsd, 5)} from reported tokens`}; ${m.handlerMs ?? '–'} ms in the backend, ${m.totalMs} ms in all.`,
    '',
  );

  if ((live || r.how.aiSource === 'claude-recorded') && r.validation.review.length) {
    out.push('For a person to check (Claude’s claims against their sources):', '');
    for (const c of r.validation.review) {
      out.push(`- ${c.section}: “${c.text}” — cites ${c.sources.map((s) => `[${s.n}] ${s.publisher}`).join(', ')}; ${Math.round(c.support * 100)}% of its words in those sources${c.flags.length ? `; ${c.flags.join('; ')}` : ''}.`);
      if (c.evidence) out.push(`  - Closest passage: ${c.evidence}`);
    }
    out.push('');
  }
  return out;
}

function metricsTable(cases: CaseResult[]): string[] {
  const out = ['| Case | Answered by | Searches | HTTP requests | Results | Analysed | Fallback | Model | Tokens in / out | Dropped as unsupported | Exa (reported) | Tavily credits | Claude | Backend ms |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of cases) {
    const m = r.metrics;
    out.push(
      `| ${r.id} | ${m.providersUsed.join(', ') || '–'} | ${m.searches} | ${m.searchRequests} | ${m.resultsRetrieved} | ${m.articlesAnalysed} | ${m.fallbackUsed ? 'yes' : 'no'} | ${m.model ?? '–'} | ${m.inputTokens !== undefined ? `${m.inputTokens} / ${m.outputTokens}${m.cacheReadTokens ? ` (${m.cacheReadTokens} cached)` : ''}` : '–'} | ${m.ungroundedDropped ?? '–'} | ${usd(m.exaReportedUsd)} | ${m.tavilyCredits} | ${m.aiUsd === undefined ? '–' : `${usd(m.aiUsd, 5)}${r.how.aiSource === 'claude-recorded' ? ' (when recorded)' : ''}`} | ${m.handlerMs ?? '–'} |`,
    );
  }
  return out;
}

function runSummary(run: RunFile): { passed: number; failed: number; extraFailed: number } {
  const passed = run.cases.filter(casePassed).length;
  return { passed, failed: run.cases.length - passed, extraFailed: run.extra.filter((x) => x.status === 'fail').length };
}

export function writeReport(root: string): { md: string; json: string } {
  const offline = readJson<RunFile>(runFilePath(root, 'offline'));
  const record = readJson<RunFile>(runFilePath(root, 'record'));
  const live = readJson<RunFile>(runFilePath(root, 'live'));
  const suites = readJson<{ suites: SuiteCount[] }>(join(root, 'src/eval/story/suite-results.json'))?.suites ?? [];
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const commit = git(root, ['rev-parse', '--short', 'HEAD']);
  // The report's own outputs don't count as uncommitted code.
  const dirty = git(root, ['status', '--porcelain']).split('\n').filter((l) => l && !l.includes('docs/eval/') && !l.includes('suite-results.json')).length > 0;
  const now = new Date().toISOString();

  const md: string[] = [
    '# Story Search: end-to-end evaluation',
    '',
    `Written ${now.slice(0, 16).replace('T', ' ')} UTC from branch \`${branch}\`, commit \`${commit}\`${dirty ? ' (with uncommitted changes)' : ''}.`,
    '',
    'Every case runs the whole of Story Search with the real code: the extension reads the link from a page, decides what to send and shows it for consent; its client sends it to the backend handler; the backend searches, matches, asks the AI, applies its rules and streams the report back; the client checks the report; the card is built from it. The one shortcut is the network hop between extension and backend (a function call).',
    '',
    'What “offline”, “live” and “stand-in” mean here:',
    '',
    '- **Offline**: no network, no keys, no cost. Real cases replay search results recorded once from the real Exa and Tavily; synthetic cases use made-up results about made-up places. Claude’s part is played by a stand-in reply written for the test (clearly marked), or by a real Claude reply saved by an earlier live run for exactly the same prompt.',
    '- **Live search**: real requests to Exa and Tavily.',
    '- **Live AI**: real requests to Claude, never a stand-in.',
    '- Stand-in replies test LinkPeek’s pipeline and rules, not Claude. Some are deliberately bad (over-confident, or rating headline-only evidence as strong) to show LinkPeek’s own rules overruling them. Nothing in an offline run is counted as live.',
    '',
    '## Results by category',
    '',
    '| Category | What ran | Real or simulated | Result |',
    '|---|---|---|---|',
  ];
  for (const s of suites) md.push(`| ${s.category} | ${s.name} (\`${s.command}\`) | ${s.note ?? ''} | ${s.failed ? `**${s.failed} failed**, ` : ''}${s.passed} passed${s.skipped ? `, ${s.skipped} skipped` : ''} |`);
  if (offline) {
    const o = runSummary(offline);
    md.push(`| Offline integration | Story Search end to end, ${offline.cases.length} cases plus ${offline.extra.length} other checks (\`npm run test:story-e2e\`) | Recorded real search results and synthetic data; stand-in AI replies | ${o.failed || o.extraFailed ? `**${o.failed + o.extraFailed} failed**, ` : ''}${o.passed + offline.extra.length - o.extraFailed} passed |`);
  }
  if (record) {
    const real = record.cases.filter((c) => /real/.test(c.how.search));
    md.push(`| Live search | Real Exa and Tavily searches for ${real.length} case(s), recorded ${record.startedAt.slice(0, 10)} (\`npm run test:story-e2e:record\`) | Real Exa and Tavily; no AI | ${real.filter((c) => c.problems.length === 0 && c.outcome !== 'error:not-configured').length} of ${real.length} answered |`);
  } else {
    md.push('| Live search | Not run in this report | – | – |');
  }
  if (live) {
    const l = runSummary(live);
    md.push(`| ${live.liveSearch ? 'Full end-to-end' : 'Live AI'} | ${live.cases.length} cases with real Claude${live.liveSearch ? ' and real searches' : ' on recorded search results'} (\`npm run test:story-e2e:live\`) | Real Claude (${live.model ?? 'model unknown'}), ${live.liveSearch ? 'real' : 'recorded real'} search results | ${l.failed ? `**${l.failed} failed**, ` : ''}${l.passed} passed; spent ${usd(live.budget?.spentUsd)} of a ${usd(live.budget?.limitUsd, 2)} limit |`);
  } else {
    md.push('| Live AI | **Not run**: no Anthropic key in the environment that produced this report | – | – |');
    md.push('| Full end-to-end | **Not run**: needs the Anthropic key as well as the search keys | – | – |');
  }
  md.push('');

  const sections: [string, RunFile | undefined, boolean][] = [
    ['Live AI run (real Claude)', live, true],
    ['Offline run', offline, false],
  ];
  for (const [title, run, isLive] of sections) {
    if (!run) continue;
    md.push(`## ${title}`, '', `Ran ${run.startedAt.slice(0, 16).replace('T', ' ')} UTC.${run.budget ? ` Claude budget: ${usd(run.budget.spentUsd)} spent of ${usd(run.budget.limitUsd, 2)} (${run.budget.calls} call(s), ${run.budget.refused} refused by the budget guard).` : ''}`, '');
    if (run.skipped.length) md.push('Skipped:', ...run.skipped.map((s) => `- \`${s.id}\`: ${s.reason}`), '');
    md.push('### Metrics per investigation', '', ...metricsTable(run.cases), '');
    if (!isLive) md.push('Offline times have no network in them. Costs offline are what the recorded requests cost when they were recorded (Exa’s own figure, Tavily’s own credit count); synthetic searches cost nothing.', '');
    for (const r of run.cases) md.push(...caseSection(r, isLive));
    if (run.extra.length) {
      md.push('### Other checks', '', '| Check | Result | Detail |', '|---|---|---|');
      for (const x of run.extra) md.push(`| ${x.name} | ${statusMark(x.status)} | ${esc(x.detail)} |`);
      md.push('');
    }
  }

  if (record) {
    md.push('## Recording the real searches', '', `Recorded ${record.startedAt.slice(0, 16).replace('T', ' ')} UTC with \`npm run test:story-e2e:record\`. Each real case was searched once; later runs replay the recording instead of searching again. Cases that already had a recording were not searched again.`, '');
    md.push(...metricsTable(record.cases), '');
    const exa = record.cases.reduce((s, c) => s + c.metrics.exaReportedUsd, 0);
    const tav = record.cases.reduce((s, c) => s + c.metrics.tavilyCredits, 0);
    md.push(`Spent on recording: ${usd(exa)} of Exa’s free monthly credit (Exa’s own figures) and ${tav} of Tavily’s 1,000 free monthly credits. Neither account has a card, so neither can be charged.`, '');
    if (record.skipped.length) md.push('Not searched again:', ...record.skipped.map((s) => `- \`${s.id}\`: ${s.reason}`), '');
  }

  md.push(
    '## How to read the checks',
    '',
    'Each report gets ten checks: the right story; names; event dates; places; relevant facts; no unsupported statements; no contradictions; source references; confidence; readable writing. Structure is checked strictly (every claim cites a listed source; every source was really retrieved; publisher and kind match the address; “confirmed” rests on two independent reports or an official one; syndicated copies count once). Facts are checked as far as a program can: expected names, dates and places must appear; forbidden ones (another story, another year) must not; every number must appear in a retrieved source; a date that appears in no cited source is a failure; a date that matches only a publication date is flagged for a person. “Review” means a person should look. Well-formed output alone never passes the factual checks, and Claude’s claims are always listed for a person to check against their sources.',
    '',
  );

  const mdText = md.join('\n');
  const json = JSON.stringify({ writtenAt: now, branch, commit, dirty, suites, runs: { offline, record, live } }, null, 2);
  mkdirSync(join(root, EVAL), { recursive: true });
  writeFileSync(join(root, EVAL, 'story-live-e2e.md'), `${mdText}\n`);
  writeFileSync(join(root, EVAL, 'story-live-e2e.json'), `${json}\n`);
  return { md: mdText, json };
}
