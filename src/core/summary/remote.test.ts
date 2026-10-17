import { describe, expect, it, vi } from 'vitest';
import { getInstallId, ROTATE_MS } from '../storage/install-id';
import { providersFor, summarise } from './engine';
import type { SummaryInput } from './provider';
import { RemoteProvider, TEXT_SENT_CHARS } from './remote';
import { countWords } from './wordcount';

const config = { url: 'https://api.linkpeek.test/api/summarise', installId: 'abcdefghijklmnop1234' };
const article: SummaryInput = {
  evidence: 'full',
  headline: 'Ferry timetable cut for winter',
  url: 'https://news.example/ferries?session=secret-token',
  language: 'en-GB',
  paragraphs: ['Harbour Ferries will cut its winter timetable to four crossings a day from November.', 'The company says fuel costs rose.'],
};

/** A stand-in backend: replies in order, and records every request body. */
function backend(...replies: (Record<string, unknown> | number | Error)[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const r = replies.shift() ?? { summary: 'Harbour Ferries will cut winter crossings to four a day.' };
    if (r instanceof Error) throw r;
    if (typeof r === 'number') return new Response('{}', { status: r });
    return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

describe('AI summaries from LinkPeek’s backend', () => {
  it('sends the article text, link text, language and install ID, and never the page address', async () => {
    const { fetchImpl, bodies } = backend({ summary: 'Harbour Ferries will cut winter crossings to four a day.' });
    const r = await new RemoteProvider(config, fetchImpl).summarise(article);
    expect(r).toMatchObject({ ok: true, summary: { provider: 'remote', text: 'Harbour Ferries will cut winter crossings to four a day.', flags: [] } });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      installId: config.installId,
      task: 'summarise',
      evidence: 'full',
      headline: 'Ferry timetable cut for winter',
      language: 'en-GB',
      text: article.paragraphs!.join('\n\n'),
    });
    expect(JSON.stringify(bodies)).not.toMatch(/news\.example|secret-token/);
  });

  it(`sends at most ${TEXT_SENT_CHARS} characters of article text`, async () => {
    const { fetchImpl, bodies } = backend();
    await new RemoteProvider(config, fetchImpl).summarise({ ...article, paragraphs: ['word '.repeat(5000)] });
    expect(String(bodies[0]!.text).length).toBe(TEXT_SENT_CHARS);
  });

  it('asks once to shorten an over-long summary', async () => {
    const long = 'Harbour Ferries said on Monday that it will reduce its winter timetable to only four crossings each day from early November onwards because fuel costs rose.';
    const { fetchImpl, bodies } = backend({ summary: long }, { summary: 'Harbour Ferries will cut winter crossings to four a day.' });
    const r = await new RemoteProvider(config, fetchImpl).summarise(article);
    expect(r).toMatchObject({ ok: true, summary: { flags: ['shortened'] } });
    expect(bodies[1]).toMatchObject({ task: 'shorten', previous: long });
    expect(bodies[1]).not.toHaveProperty('text');
  });

  it('asks once to rewrite filler, saying what was wrong', async () => {
    const { fetchImpl, bodies } = backend({ summary: 'This article discusses the ferry timetable for the winter.' }, { summary: 'Harbour Ferries will cut winter crossings to four a day.' });
    const r = await new RemoteProvider(config, fetchImpl).summarise(article);
    expect(r).toMatchObject({ ok: true });
    expect(bodies[1]).toMatchObject({ task: 'summarise', problem: 'filler-opener', previous: 'This article discusses the ferry timetable for the winter.' });
  });

  it('gives up after one rewrite: no third try, and never shows the bad one', async () => {
    const { fetchImpl, bodies } = backend({ summary: 'This article discusses ferries and their timetables.' }, { summary: 'In this article, we look at the ferries.' });
    const r = await new RemoteProvider(config, fetchImpl).summarise(article);
    expect(r).toMatchObject({ ok: false, reason: 'filtered' });
    expect(bodies).toHaveLength(2);
  });

  it.each([
    ['the backend is down', new TypeError('Failed to fetch')],
    ['the backend errors', 502],
    ['it is rate limited', 429],
    ['the model refused', 422],
  ])('falls back to the free summary when %s', async (_name, reply) => {
    const { fetchImpl } = backend(reply);
    const s = await summarise(article, [new RemoteProvider(config, fetchImpl), ...providersFor('extractive')]);
    expect(s?.provider).toBe('extractive');
    expect(countWords(s!.text)).toBeLessThanOrEqual(20);
  });

  it('does nothing without a backend address, or for previews', async () => {
    const { fetchImpl } = backend();
    expect(await new RemoteProvider(undefined, fetchImpl).summarise(article)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await new RemoteProvider(config, fetchImpl).summarise({ ...article, evidence: 'partial', previewText: 'A preview.' })).toMatchObject({ ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('"not enough to go on" from the AI falls through to the free summary', async () => {
    const { fetchImpl } = backend({ insufficient: true });
    const s = await summarise(article, [new RemoteProvider(config, fetchImpl), ...providersFor('extractive')]);
    expect(s?.provider).toBe('extractive');
  });
});

describe('install ID', () => {
  it('is random, kept, and replaced after 30 days', async () => {
    const a = await getInstallId(1000);
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(await getInstallId(2000)).toBe(a);
    const later = await getInstallId(1000 + ROTATE_MS + 1);
    expect(later).not.toBe(a);
  });
});
