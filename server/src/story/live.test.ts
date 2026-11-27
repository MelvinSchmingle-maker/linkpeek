/**
 * LIVE Story Search tests: real Exa, real Tavily, real Claude, real news.
 * No stand-ins anywhere in the searching or the report.
 *
 * Skipped by `npm test`. Run on purpose:
 *
 *   npm --prefix server run test:live                              step "normal"
 *   STORY_LIVE_STEP=search-only npm --prefix server run test:live     real searching and matching, no Claude
 *
 * The full evaluation is now the end-to-end suite (src/eval/story-e2e.test.ts,
 * `npm run test:story-e2e`, `:record`, `:live`): it replays these searches
 * from recordings instead of paying for them again, and checks the reports'
 * accuracy. Use this file only for a quick look at the live services.
 *
 * Each step writes its results to docs/eval/story-live-<step>.md for a person
 * to read: the automatic checks can say a report is well formed and sourced,
 * but only reading the sources says whether it's right.
 *
 * Keys: EXA_API_KEY and TAVILY_API_KEY from the environment, or, in a Claude
 * Code cloud session where the keys were saved as network secrets, set
 * STORY_LIVE_PROXY_KEYS=1 and the proxy adds them. Claude: LINKPEEK_ANTHROPIC_API_KEY
 * (the same name the summaries evaluation uses).
 *
 * Used-up allowances are NOT tested here: the owner asked that account
 * limits and billing settings are never changed, and free allowances never
 * deliberately used up. The end-to-end suite simulates those answers instead
 * (cases fallback-*: Exa's 402 NO_MORE_CREDITS, Tavily's 432, timeouts, both
 * used up), using the providers' documented error replies.
 *
 * Costs (estimates from list prices): step "normal" uses roughly $0.05–0.10
 * of Exa's free monthly credit ($0.007 a search, as Exa reports it), a few of
 * Tavily's 1,000 free credits, and about $0.01 of Claude.
 */
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnthropicStoryModel, DEFAULT_STORY_MODEL } from './analyse.js';
import type { StoryReport, StoryRequest } from './contract.js';
import { investigate, type Metrics } from './investigate.js';
import { ExaProvider } from './providers/exa.js';
import { ProviderChain } from './providers/index.js';
import { TavilyProvider } from './providers/tavily.js';
import type { SearchOutcome } from './providers/types.js';

const LIVE = process.env.STORY_LIVE === '1';
const STEP = (process.env.STORY_LIVE_STEP ?? 'normal') as 'normal' | 'search-only';
/** The window Story Search uses for a link dated 21 April 2025 (14 days before, 30 after). */
const WINDOW = { since: '2025-04-07', until: '2025-05-21' };
/** About the death itself, not later coverage that mentions Francis. */
const ABOUT_DEATH = /\b(dies|died|death|dead)\b/i;
const proxied = process.env.STORY_LIVE_PROXY_KEYS === '1' ? 'injected-by-proxy' : undefined;
const exaKey = process.env.EXA_API_KEY?.trim() || proxied;
const tavilyKey = process.env.TAVILY_API_KEY?.trim() || proxied;
const anthropicKey = process.env.LINKPEEK_ANTHROPIC_API_KEY?.trim();
const ID = 'livetestinstall0001';
const TIMEOUT = 120_000;

const exa = new ExaProvider(exaKey);
const tavily = new TavilyProvider(tavilyKey);
const chain = new ProviderChain([exa, tavily]);
const model = () => {
  // An explicit address, so this never goes through a proxy address set for something else.
  const client = new Anthropic({ apiKey: anthropicKey, baseURL: 'https://api.anthropic.com', timeout: 30_000, maxRetries: 0 });
  return new AnthropicStoryModel(client, process.env.STORY_MODEL?.trim() || DEFAULT_STORY_MODEL, 'medium');
};

interface Case {
  name: string;
  /** What a person checks when reading the results. */
  expect: string;
  req: StoryRequest;
  /** "story": must find a strong, sourced report. "nothing": must not present a strong report. "review": recorded for a person to judge. */
  kind: 'story' | 'nothing' | 'review';
}

/** Real, widely and independently reported events, plus one made-up story. The link addresses are illustrative: Story Search never opens them. */
const CASES: Case[] = [
  {
    name: 'Full headline, named person',
    expect: 'Pope Francis died on 21 April 2025 (Easter Monday) at the Vatican, aged 88. Sources should include news agencies and/or the Vatican.',
    kind: 'story',
    req: {
      installId: ID,
      url: 'https://news.example.com/2025/04/21/pope-francis-dies-aged-88',
      headline: { text: 'Pope Francis dies aged 88', from: 'link-text', confidence: 'high' },
      slug: 'pope francis dies aged 88',
      date: '2025-04-21',
      dateFrom: 'url-date',
    },
  },
  {
    name: '"Read more" link with an article card',
    expect: 'Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid lasting minutes.',
    kind: 'story',
    req: {
      installId: ID,
      url: 'https://paper.example.org/p/88231',
      headline: { text: 'Louvre jewel heist: thieves steal crown jewels in daylight raid', from: 'card-heading', confidence: 'high' },
      description: { text: 'Thieves used a vehicle-mounted lift to reach the Apollo Gallery and escaped within minutes.', from: 'card-teaser', confidence: 'medium' },
      date: '2025-10-19',
      dateFrom: 'card-label',
    },
  },
  {
    name: 'Address only (no headline)',
    expect: 'The same Louvre story, found from the address words alone.',
    kind: 'story',
    req: { installId: ID, url: 'https://paper.example.org/2025/10/19/louvre-crown-jewels-stolen-apollo-gallery', slug: 'louvre crown jewels stolen apollo gallery', date: '2025-10-19', dateFrom: 'url-date' },
  },
  {
    name: 'Vague headline, no names, no date',
    expect: 'Many different events fit. A good result says the match is only possible, or names clearly which story it found. It must not present one story as certain without saying why.',
    kind: 'review',
    req: { installId: ID, url: 'https://celeb.example.com/p/1', headline: { text: 'Pop star found dead in hotel room', from: 'link-text', confidence: 'high' } },
  },
  {
    name: 'Made-up story',
    expect: 'There is no such story. It must say no reliable match (or no results), never present a report.',
    kind: 'nothing',
    req: {
      installId: ID,
      url: 'https://news.example.com/2026/11/20/zarnwick-mayor-resigns-canal-bridge-collapse',
      headline: { text: 'Mayor of Zarnwick resigns after canal bridge collapse injures 14', from: 'link-text', confidence: 'high' },
      slug: 'zarnwick mayor resigns canal bridge collapse',
      date: '2026-11-20',
      dateFrom: 'url-date',
    },
  },
];

const lines: string[] = [];
const write = (title: string) => {
  mkdirSync('../docs/eval', { recursive: true });
  const what =
    STEP === 'search-only'
      ? 'Real searches (Exa first, Tavily when Exa has no key or no credit) and LinkPeek’s real matching. Claude is not called; the sources listed are the closest ones Story Search would hand to it. Search costs are list-price estimates; on the free plans they come out of the free credit.'
      : `Real Exa, Tavily and Claude (${process.env.STORY_MODEL?.trim() || DEFAULT_STORY_MODEL}); nothing imitated.`;
  writeFileSync(`../docs/eval/story-live-${STEP}.md`, [`# ${title}`, '', `Run on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, step "${STEP}". ${what}`, '', ...lines, ''].join('\n'));
};

function describeOutcome(o: SearchOutcome): string {
  if (!o.ok) return `failed: \`${o.code}\`${o.tag ? ` (provider tag \`${o.tag}\`)` : ''}`;
  const withText = o.hits.filter((h) => h.passages.length).length;
  const dated = o.hits.filter((h) => h.published).length;
  return `${o.hits.length} results, ${withText} with page text, ${dated} dated, cost $${o.costUsd.toFixed(4)}`;
}

function reportMarkdown(r: StoryReport, m: Metrics): string[] {
  const out = [
    `- Outcome: **${r.status}**, match **${r.match}**, confidence **${r.confidence}**`,
    `- Searches: ${m.queries} (${m.searchPath.join(' → ')}), answered by ${m.providersUsed.join(', ') || 'none'}${m.searchErrors.length ? `, errors ${m.searchErrors.join(', ')}` : ''}`,
    `- Cost: search $${m.searchUsd.toFixed(4)}, Claude $${m.aiUsd.toFixed(4)} (${m.inputTokens ?? 0} tokens in, ${m.outputTokens ?? 0} out)${m.aiFailure ? `, Claude failed: ${m.aiFailure}` : ''}`,
    `- Searched for: “${r.searchedFor}”`,
  ];
  if (r.subject) out.push(`- Subject: ${r.subject}`);
  const claims = (h: string, list: { text: string; sources: number[] }[]) => {
    if (!list.length) return;
    out.push(`- ${h}:`);
    for (const c of list) out.push(`  - ${c.text}${c.sources.length ? ` [${c.sources.join('][')}]` : ''}`);
  };
  claims('What happened', r.whatHappened);
  claims('Key details', r.details.map((d) => ({ ...d, text: `${d.label}: ${d.text}` })));
  claims('Confirmed', r.confirmed);
  claims('Reported by one source', r.reported);
  claims('Unclear', r.unclear);
  if (r.notes.length) out.push(`- Notes: ${r.notes.join(', ')}`);
  if (r.sources.length) {
    out.push('- Sources:');
    for (const s of r.sources) out.push(`  ${s.n}. [${s.title}](${s.url}) · ${s.publisher} · ${s.published ?? 'no date'} · ${s.kind} · ${s.match}${s.copyOf ? ` · repeats ${s.copyOf}` : ''}${s.via ? ` · credits ${s.via}` : ''}`);
  }
  out.push(`- Set aside: ${r.setAside}`);
  return out;
}

/** Every factual line cites a source that is in the list. */
function sourced(r: StoryReport): boolean {
  const ns = new Set(r.sources.map((s) => s.n));
  return [...r.whatHappened, ...r.details, ...r.confirmed, ...r.reported].every((c) => c.sources.length > 0 && c.sources.every((n) => ns.has(n)));
}

describe.skipIf(!LIVE)('LIVE Story Search (real services)', () => {
  if (STEP === 'normal') {
    it('has its keys', () => {
      expect(exaKey, 'EXA_API_KEY (or STORY_LIVE_PROXY_KEYS=1)').toBeTruthy();
      expect(tavilyKey, 'TAVILY_API_KEY (or STORY_LIVE_PROXY_KEYS=1)').toBeTruthy();
      expect(anthropicKey, 'LINKPEEK_ANTHROPIC_API_KEY').toBeTruthy();
    });

    it('1. a real Exa search finds real, dated reports with page text', { timeout: TIMEOUT }, async () => {
      const o = await exa.search({ text: 'Pope Francis dies aged 88', purpose: 'best', news: true }, { limit: 8, ...WINDOW });
      lines.push('## 1. Exa alone', '', `- ${describeOutcome(o)}`, ...(o.ok ? o.hits.map((h) => `  - [${h.title}](${h.url}) · ${h.published ?? 'no date'}`) : []), '');
      expect(o.ok, describeOutcome(o)).toBe(true);
      if (!o.ok) return;
      expect(o.hits.filter((h) => /francis/i.test(h.title) && ABOUT_DEATH.test(h.title)).length).toBeGreaterThanOrEqual(2);
      expect(o.hits.filter((h) => h.passages.length).length).toBeGreaterThanOrEqual(2);
    });

    it('2. a real Tavily search works on its own', { timeout: TIMEOUT }, async () => {
      const o = await tavily.search({ text: 'Pope Francis dies aged 88', purpose: 'best', news: true }, { limit: 8, ...WINDOW });
      lines.push('## 2. Tavily alone', '', `- ${describeOutcome(o)}`, ...(o.ok ? o.hits.map((h) => `  - [${h.title}](${h.url}) · ${h.published ?? 'no date'}`) : []), '');
      expect(o.ok, describeOutcome(o)).toBe(true);
      if (!o.ok) return;
      expect(o.hits.filter((h) => /francis/i.test(h.title) && ABOUT_DEATH.test(h.title)).length).toBeGreaterThanOrEqual(2);
      expect(o.hits.filter((h) => h.passages.length).length).toBeGreaterThanOrEqual(2);
    });

    describe('5. real stories, end to end (Exa, then Tavily if needed, then Claude)', () => {
      for (const c of CASES) {
        it(c.name, { timeout: TIMEOUT }, async () => {
          const out = await investigate(c.req, { provider: chain, model: model() });
          lines.push(`## 5. ${c.name}`, '', `Expected: ${c.expect}`, '');
          if (!out.ok) {
            lines.push(`- Failed: \`${out.code}\`, searches ${out.metrics.searchPath.join(' → ')}${out.metrics.searchErrors.length ? `, errors ${out.metrics.searchErrors.join(', ')}` : ''}`, '');
            expect(out.ok, out.code).toBe(true);
            return;
          }
          const r = out.report;
          lines.push(...reportMarkdown(r, out.metrics), `- Every factual line sourced: ${sourced(r) ? 'yes' : 'NO'}`, '');
          expect(sourced(r)).toBe(true);
          if (c.kind === 'story') {
            expect(r.status).toBe('report');
            expect(r.match).toBe('strong');
            expect(r.sources.length).toBeGreaterThanOrEqual(2);
            expect(r.whatHappened.length).toBeGreaterThan(0);
          }
          if (c.kind === 'nothing') expect(r.status === 'report' && r.match === 'strong').toBe(false);
        });
      }
    });

    it('writes the results for review', () => write('Story Search live test: normal'));
  }

  if (STEP === 'search-only') {
    // The real searching and matching, without Claude: which sources Story Search would hand to the AI.
    const noAi = { name: 'none (search only)', analyse: async () => ({ ok: false as const, code: 'misconfigured' as const }) };
    describe('real searching and matching for each case (Claude not called)', () => {
      for (const c of CASES) {
        it(c.name, { timeout: TIMEOUT }, async () => {
          const out = await investigate(c.req, { provider: chain, model: noAi });
          lines.push(`## ${c.name}`, '', `Expected: ${c.expect}`, '');
          if (!out.ok) {
            lines.push(`- Failed: ${out.code}, searches ${out.metrics.searchPath.join(' → ')} ${out.metrics.searchErrors.join(', ')}`, '');
            expect(out.ok, out.code).toBe(true);
            return;
          }
          const r = out.report;
          const m = out.metrics;
          lines.push(
            `- Searches: ${m.queries} (${m.searchPath.join(' → ')}), answered by ${m.providersUsed.join(', ') || 'none'}${m.searchErrors.length ? `, errors ${m.searchErrors.join(', ')}` : ''}`,
            `- Search cost: $${m.searchUsd.toFixed(4)} (estimate)`,
            `- Searched for: “${r.searchedFor}”`,
            `- Results kept: ${m.results}; sent on to the AI: ${m.candidates}; closest shown: ${r.sources.length}`,
            ...r.sources.map((s) => `  ${s.n}. [${s.title}](${s.url}) · ${s.publisher} · ${s.published ?? 'no date'} · ${s.kind}`),
            '',
          );
          if (c.kind === 'story') expect(r.sources.length, 'close results for a real story').toBeGreaterThanOrEqual(2);
        });
      }
    });
    it('writes the results for review', () => write('Story Search live test: searching and matching only (no Claude)'));
  }
});
