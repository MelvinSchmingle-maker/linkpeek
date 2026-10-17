import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { assessHtml } from '../extract/assess';
import { extractHtml } from '../extract/html';
import { ChromeBuiltInProvider, type Availability, type SummarizerApi } from './chrome-builtin';
import { enforceLimit, MAX_SUMMARY_WORDS, trimAtClause } from './enforce';
import { providersFor, summarise } from './engine';
import { ExtractiveProvider } from './extractive';
import { summaryInputFor } from './input';
import type { SummaryInput, SummaryProvider } from './provider';
import { qualityProblem } from './quality';
import { RemoteProvider } from './remote';
import { countWords } from './wordcount';

const n = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');

describe('word count rule', () => {
  it.each([
    ['energy-support', 1],
    ['a well-known long-running cross-party agreement', 5],
    ['£3.5bn', 1],
    ['2026', 1],
    ['12%', 1],
    ['1,000 homes', 2],
    ['U.K.', 1],
    ['NHS', 1],
    ['e.g. this', 2],
    ['—', 0],
    ['-', 0],
    ['&', 0],
    ['…', 0],
    ['Profits rose — sharply — this year', 5],
    ['rose—sharply', 2],
    ['won 3–2 at home', 4],
    ['red–green alliance', 3],
    ['and/or', 1],
    ['🙂', 0],
    ['  spaced out\ttext\n', 3],
    ['', 0],
  ])('%j is %i words', (text, expected) => {
    expect(countWords(text)).toBe(expected);
  });

  it('counts words in scripts written without spaces', () => {
    expect(countWords('東京で新しい図書館が開館した')).toBeGreaterThan(3);
    expect(countWords('ห้องสมุดใหม่เปิดแล้ว')).toBeGreaterThan(1);
  });

  it('counts accented and non-Latin words like any other', () => {
    expect(countWords('Le conseil a approuvé deux kilomètres de pistes cyclables')).toBe(9);
    expect(countWords('Совет одобрил новые велодорожки')).toBe(4);
  });
});

describe('the 20-word limit', () => {
  it('passes exactly 20 words as they are', async () => {
    const r = await enforceLimit(`${n(19)} end.`);
    expect(r).toMatchObject({ ok: true, how: 'as-is', wordCount: 20 });
  });

  it('trims 21 words at the last clause boundary that leaves a sentence', async () => {
    const text = 'The council approved two kilometres of protected cycle lanes on the High Street, with work due to start in early March.';
    expect(countWords(text)).toBe(21);
    const r = await enforceLimit(text);
    expect(r).toEqual({ ok: true, how: 'trimmed', wordCount: 13, text: 'The council approved two kilometres of protected cycle lanes on the High Street.' });
  });

  it('can cut at "and" and "but"', async () => {
    const r = await enforceLimit('Engineers replaced the whole deck of the Old Mill footbridge over the summer and the council says the second phase starts in spring.');
    expect(r.ok && r.text).toBe('Engineers replaced the whole deck of the Old Mill footbridge over the summer.');
  });

  it('never adds "..." and never cuts mid-phrase', async () => {
    const r = await enforceLimit(`${n(25)}.`);
    expect(r).toEqual({ ok: false, reason: 'over-limit' });
    const t = await enforceLimit('The bridge, which was built in 1840 by a local mill owner for his workers to cross the river safely each morning, has reopened.');
    if (t.ok) {
      expect(t.text).not.toMatch(/\.\.\.|…/);
      expect(countWords(t.text)).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);
    }
  });

  it('does not leave a lead-in on its own ("After the vote on Tuesday evening at the town hall.")', () => {
    expect(trimAtClause('After the long and narrow vote on Tuesday evening at the town hall, councillors agreed to approve the cycle lanes for the High Street next year.')).toBeUndefined();
  });

  it('does not end on a dangling word or inside a quote', () => {
    expect(trimAtClause('The mayor said the plan was supported by "most residents, shop owners and bus drivers who use the route every single day" at the meeting.')).toBeUndefined();
    expect(trimAtClause('Residents will be able to comment on the plans for the new ramp at the, library on Green Lane near the old station in town.')).toBeUndefined();
  });

  it('with no comma, "and" or "but", cuts just before a dependent clause', () => {
    expect(trimAtClause('Millbrook Leisure Centre will close its swimming pool for about a year after an inspection found corrosion in the steel frame of the roof.')).toBe(
      'Millbrook Leisure Centre will close its swimming pool for about a year.',
    );
    // Never before "that": "The study suggests." would leave the verb hanging.
    expect(trimAtClause('A small study by researchers at the university suggests that adding garden compost to soil may reduce blight in tomato plants.')).toBeUndefined();
  });

  it.each([
    // An "and" inside a clause that hasn't finished.
    ['Valley Foods said profits fell by 18% to £42m last year as energy and packaging costs rose sharply at both of its factories.', 'Valley Foods said profits fell by 18% to £42m last year.'],
    // A range is not two clauses: the cut comes before "without", not inside "between 2022 and 2024".
    ['Martin Hale is accused of approving four grants worth a total of 96,000 pounds between 2022 and 2024 without declaring it.', 'Martin Hale is accused of approving four grants worth a total of 96,000 pounds between 2022 and 2024.'],
    // A short stretch after a comma is a list item or a fragment.
    ['Hillside Primary School has been rated good by inspectors, who praised the way it teaches reading, two years after it was told to improve.', 'Hillside Primary School has been rated good by inspectors, who praised the way it teaches reading.'],
    // Before "that" is fine after a noun, not after a reporting verb or "at prices".
    ['A former Millbrook councillor has denied fraud charges over community grants that prosecutors say were paid to his own companies.', 'A former Millbrook councillor has denied fraud charges over community grants.'],
  ])('trims "%s" to a whole sentence', (text, expected) => {
    expect(trimAtClause(text)).toBe(expected);
  });

  it('refuses rather than leave a fragment', () => {
    // Only cut available splits "between 2022 and 2024".
    expect(trimAtClause('Martin Hale is accused of approving four grants worth a total of 96,000 pounds between 2022 and 2024 for youth projects in the north.')).toBeUndefined();
    // "The Granary, which opened in September." has no main verb; "...at prices." isn't finished.
    expect(trimAtClause('The Granary, which opened on Mill Lane in September, serves some of the best cooking in Millbrook at prices that feel fair.')).toBeUndefined();
    // "The Millbrook terrier, also called the mill dog." is a subject and an aside.
    expect(trimAtClause('The Millbrook terrier, also called the mill dog, is a small wire-haired terrier bred to keep rats out of grain stores.')).toBeUndefined();
    // "...patched so often." needs its "that": the cut goes before ", which" instead.
    expect(trimAtClause('Engineers spent the summer replacing the deck, which had been patched so often that nobody could say how much original timber was left.')).toBe(
      'Engineers spent the summer replacing the deck.',
    );
    // "The study suggests." leaves the verb hanging.
    expect(trimAtClause('A small study by researchers at the university suggests that adding garden compost to soil may reduce blight in tomato plants.')).toBeUndefined();
  });

  it('keeps a short lead-in, which is followed by the main clause', () => {
    expect(trimAtClause('In 2021, at 42 years old, I had the reading age of a four-year-old, and I could not read a menu.')).toBe(
      'In 2021, at 42 years old, I had the reading age of a four-year-old.',
    );
  });

  it('a comma inside a number is not a clause boundary', () => {
    expect(trimAtClause(`About 1,000 ${n(25)}.`)).toBeUndefined();
  });

  it('fails cleanly on text that is all numbers', async () => {
    expect(await enforceLimit(Array.from({ length: 21 }, (_, i) => String(2000 + i)).join(' '))).toEqual({ ok: false, reason: 'over-limit' });
  });

  it('fails cleanly on long hyphenated words with no boundary', async () => {
    expect(await enforceLimit(`${n(21, 'state-of-the-art')}.`)).toEqual({ ok: false, reason: 'over-limit' });
  });

  it('asks the provider to shorten once, and uses the shorter version', async () => {
    const shorten = vi.fn(async () => 'The council approved new cycle lanes for the High Street.');
    const r = await enforceLimit(`${n(30)}.`, { shorten });
    expect(shorten).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true, how: 'shortened', text: 'The council approved new cycle lanes for the High Street.' });
  });

  it('trims when the shortened version is still over, and survives a failing provider', async () => {
    const long = 'The council approved two kilometres of protected cycle lanes on the High Street, with work due to start in March after a vote.';
    const stillLong = vi.fn(async () => long);
    expect(await enforceLimit(`${n(30)}.`, { shorten: stillLong })).toMatchObject({ ok: true, how: 'trimmed' });
    const broken = vi.fn(async () => {
      throw new Error('model gone');
    });
    expect(await enforceLimit(long, { shorten: broken })).toMatchObject({ ok: true, how: 'trimmed' });
  });

  it('works on non-English text', async () => {
    const r = await enforceLimit(
      'Le conseil municipal a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue, avec des travaux qui commenceront en mars.',
    );
    expect(r.ok && r.text).toBe('Le conseil municipal a approuvé deux kilomètres de pistes cyclables protégées sur la Grand-Rue.');
  });
});

describe('quality filters', () => {
  it.each([
    'This article discusses the new cycle lanes on High Street.',
    'In this article, we look at the new cycle lanes.',
    'The author explores what the cycle lanes mean for shops.',
    "Here's what you need to know about the cycle lanes.",
  ])('rejects filler opener: %s', (s) => {
    expect(qualityProblem(s, 'Council approves cycle lanes')).toBe('filler-opener');
  });

  it('rejects the headline repeated back', () => {
    expect(qualityProblem('Council approves protected cycle lanes for High Street.', 'Council approves protected cycle lanes for High Street')).toBe('repeats-headline');
  });

  it('rejects questions and fragments', () => {
    expect(qualityProblem('Will the new lanes really help the shops on High Street?', 'x')).toBe('question');
    expect(qualityProblem('Big news today.', 'x')).toBe('too-short');
  });

  it('accepts a plain statement of what happened', () => {
    expect(qualityProblem('Millbrook council approved two kilometres of protected cycle lanes on High Street.', 'Council approves cycle lanes')).toBeUndefined();
  });
});

const article = (paragraphs: string[], headline = 'Old Mill bridge reopens after summer repairs'): SummaryInput => ({
  evidence: 'full',
  headline,
  url: 'https://example.test/a',
  paragraphs,
});

describe('extractive summaries', () => {
  const extractive = new ExtractiveProvider();

  it("uses the article's opening sentence when it states the news", async () => {
    const r = await extractive.summarise(
      article([
        'The Old Mill footbridge reopened on Tuesday morning after fourteen weeks of repairs, which cost the council 410,000 pounds and ran three weeks late.',
        'Engineers spent the summer replacing the deck.',
      ]),
    );
    expect(r).toMatchObject({ ok: true, summary: { provider: 'extractive', evidence: 'full', flags: ['trimmed'] } });
    // The longest complete sentence that fits: cut at "and", not at the first comma.
    expect(r.ok && r.summary.text).toBe('The Old Mill footbridge reopened on Tuesday morning after fourteen weeks of repairs, which cost the council 410,000 pounds.');
  });

  it('skips an opening quote or question for a sentence that says what happened', async () => {
    const r = await extractive.summarise(
      article([
        '"It feels like the town has its heart back," said one shopkeeper on Mill Lane.',
        'What does it mean for the estate?',
        'The Old Mill footbridge reopened on Tuesday after fourteen weeks of repairs costing 410,000 pounds.',
      ]),
    );
    expect(r.ok && r.summary.text).toMatch(/^The Old Mill footbridge reopened on Tuesday/);
  });

  it('a partial page gets a preview from its description, flagged as one', async () => {
    const r = await extractive.summarise({
      evidence: 'partial',
      headline: 'Members only: the draft budget',
      url: 'https://example.test/p',
      previewText: 'Members only: a look at the draft budget for next year.',
    });
    expect(r).toMatchObject({ ok: true, summary: { evidence: 'partial', flags: ['preview'], text: 'Members only: a look at the draft budget for next year.' } });
  });

  it('never builds a preview from the cut-off end of a long description', async () => {
    const r = await extractive.summarise({
      evidence: 'partial',
      headline: 'x',
      url: 'https://example.test/p',
      previewText: 'The market returns this weekend with twenty stalls and a new hot food area. Organisers said the council would…',
    });
    expect(r.ok && r.summary.text).toBe('The market returns this weekend with twenty stalls and a new hot food area.');
  });

  it('gives no summary from the headline alone', async () => {
    const r = await extractive.summarise({ evidence: 'headline-only', headline: 'Council approves cycle lanes', url: 'https://example.test/h' });
    expect(r).toMatchObject({ ok: false, reason: 'insufficient' });
  });
});

/** A stand-in for Chrome's Summarizer API. */
function fakeSummarizer(state: Availability, outputs: string[]): SummarizerApi & { created: unknown[] } {
  const created: unknown[] = [];
  return {
    created,
    availability: vi.fn(async () => state),
    create: vi.fn(async (options) => {
      created.push(options);
      return { summarize: vi.fn(async () => outputs.shift() ?? ''), destroy: vi.fn() };
    }),
  };
}

describe("Chrome's on-device summaries", () => {
  const input = article(['The Old Mill footbridge reopened on Tuesday after fourteen weeks of repairs.', 'Engineers replaced the deck.']);

  it('is unavailable when Chrome has no Summarizer', async () => {
    expect(await new ChromeBuiltInProvider(undefined).summarise(input)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it("never starts the model download itself: 'downloadable' counts as unavailable", async () => {
    const api = fakeSummarizer('downloadable', ['x']);
    expect(await new ChromeBuiltInProvider(api).summarise(input)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('asks for a plain-text "headline" summary and labels it as Chrome\'s', async () => {
    const api = fakeSummarizer('available', ['Old Mill footbridge reopens after fourteen weeks of council repairs costing 410,000 pounds']);
    const r = await new ChromeBuiltInProvider(api).summarise(input);
    expect(r).toMatchObject({ ok: true, summary: { provider: 'chrome-on-device', flags: [] } });
    expect(api.created[0]).toMatchObject({ type: 'headline', format: 'plain-text', length: 'medium' });
  });

  it('asks once for a shorter one when it runs long', async () => {
    const api = fakeSummarizer('available', [`${n(25)}.`, 'Old Mill footbridge reopens after fourteen weeks of repairs']);
    const r = await new ChromeBuiltInProvider(api).summarise(input);
    expect(r).toMatchObject({ ok: true, summary: { flags: ['shortened'] } });
    expect(api.created[1]).toMatchObject({ length: 'short' });
  });

  it('skips languages the model does not support', async () => {
    const api = fakeSummarizer('available', ['x']);
    expect(await new ChromeBuiltInProvider(api).summarise({ ...input, language: 'cy-GB' })).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('rejects filler, and survives the model failing', async () => {
    expect(await new ChromeBuiltInProvider(fakeSummarizer('available', ['This article discusses the reopening of the bridge.'])).summarise(input)).toMatchObject({
      ok: false,
      reason: 'filtered',
    });
    const broken: SummarizerApi = { availability: async () => 'available', create: async () => Promise.reject(new Error('boom')) };
    expect(await new ChromeBuiltInProvider(broken).summarise(input)).toMatchObject({ ok: false, reason: 'error' });
  });

  it('only summarises whole articles', async () => {
    const api = fakeSummarizer('available', ['x']);
    expect(await new ChromeBuiltInProvider(api).summarise({ ...input, evidence: 'partial', previewText: 'A preview.' })).toMatchObject({ ok: false });
  });
});

describe('the engine', () => {
  const input = article(['The Old Mill footbridge reopened on Tuesday after fourteen weeks of repairs costing 410,000 pounds.']);

  it('falls back to the extractive summary when the AI is unavailable', async () => {
    const s = await summarise(input, [new ChromeBuiltInProvider(undefined), new RemoteProvider(undefined), new ExtractiveProvider()]);
    expect(s?.provider).toBe('extractive');
  });

  it('never lets an over-long or filler summary through, whatever a provider claims', async () => {
    const liar: SummaryProvider = {
      name: 'remote',
      summarise: async () => ({ ok: true, summary: { text: `${n(30)}.`, wordCount: 3, provider: 'remote' } }),
    };
    const s = await summarise(input, [liar, new ExtractiveProvider()]);
    expect(s?.provider).toBe('extractive');
    expect(countWords(s!.text)).toBeLessThanOrEqual(20);
  });

  it('gives nothing for headline-only or unavailable evidence', async () => {
    expect(await summarise({ ...input, evidence: 'headline-only' }, providersFor('extractive'))).toBeUndefined();
    expect(await summarise({ ...input, evidence: 'unavailable' }, providersFor('chrome-on-device'))).toBeUndefined();
  });
});

describe('what may be summarised', () => {
  const fixture = (name: string) => readFileSync(join(process.cwd(), 'test-pages/articles', name), 'utf8');
  const read = (name: string) => {
    const html = fixture(name);
    const url = `http://127.0.0.1:4173/articles/${name}`;
    const ex = extractHtml(html, url);
    return { a: assessHtml({ requestedUrl: url, finalUrl: url, status: 200 }, html, ex), ex, url };
  };

  it("a paywalled page's summary input is only the publisher's description, never its body", async () => {
    const { a, ex, url } = read('paywall.html');
    const input = summaryInputFor(a, { headline: 'Budget', url, paragraphs: ex.paragraphs });
    expect(input).toEqual({ evidence: 'partial', headline: 'Budget', url, previewText: 'Members only: a look at the draft budget for next year.', language: undefined });
    const s = await summarise(input!, providersFor('extractive'));
    expect(JSON.stringify(s)).not.toMatch(/Councillors voted seven to five/);
  });

  it('a full article gives its paragraphs from the opening, and its language', () => {
    const { a, ex, url } = read('split-blocks.html');
    const input = summaryInputFor(a, { headline: 'x', url, paragraphs: ex.paragraphs, language: ex.language });
    expect(input?.paragraphs?.[0]).toMatch(/^The Old Mill footbridge reopened on Tuesday morning/);
    expect(input?.language).toBe('en');
  });

  it('failures give nothing to summarise', () => {
    const { ex, url } = read('cycle-lanes.html');
    expect(summaryInputFor({ evidence: 'unavailable', failure: 'http-4xx' }, { headline: 'x', url, paragraphs: ex.paragraphs })).toBeUndefined();
  });
});
