/**
 * The Story Search client: reading the streamed answer, mapping failures to
 * plain codes, and checking the report before anything reaches the card.
 * No network: fetch is a stand-in.
 */
import { describe, expect, it } from 'vitest';
import { parseReport, runStorySearch, type StoryEvent } from './client';
import type { StoryReport, StoryRequestBody } from './types';

const BODY: StoryRequestBody = { installId: 'abcdefghijklmnop1234', url: 'https://paper.example.org/2026/11/24/story', headline: { text: 'Ferry strike called off', from: 'link-text', confidence: 'high' } };

const REPORT: StoryReport = {
  status: 'report',
  subject: 'Ferry strike called off after talks',
  match: 'strong',
  confidence: 'partial',
  whatHappened: [{ text: 'Ferry workers called off a strike planned for 1 December 2026.', sources: [1] }],
  details: [{ label: 'who', text: 'Harbour Ferries staff.', sources: [1] }],
  confirmed: [],
  reported: [{ text: 'Talks ended late on 25 November.', sources: [1] }],
  unclear: [{ text: 'Terms of the deal were not published.', sources: [] }],
  sources: [{ n: 1, title: 'Strike off', publisher: 'Example News', url: 'https://news.example.com/a', published: '2026-11-25', kind: 'news', match: 'strong' }],
  setAside: 1,
  notes: ['single-source'],
  searchedFor: 'Ferry strike called off',
  checkedAt: '2026-11-26T10:00:00.000Z',
};

function streamResponse(lines: string[], { chunked = false } = {}): Response {
  const text = lines.join('\n') + '\n';
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      if (chunked) for (let i = 0; i < text.length; i += 7) c.enqueue(enc.encode(text.slice(i, i + 7)));
      else c.enqueue(enc.encode(text));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
}

async function collect(res: Response | (() => Promise<Response>), opts: { timeoutMs?: number } = {}) {
  const seen: StoryEvent[] = [];
  let sent: RequestInit | undefined;
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    sent = init;
    return typeof res === 'function' ? res() : res;
  }) as unknown as typeof fetch;
  const last = await runStorySearch('https://api.example/api/story', BODY, (e) => seen.push(e), { fetchImpl, ...opts });
  return { seen, last, sent };
}

describe('runStorySearch', () => {
  it('passes each stage on as it arrives, then the report, even when lines arrive in pieces', async () => {
    const { seen, last, sent } = await collect(
      streamResponse([JSON.stringify({ stage: 'searching' }), JSON.stringify({ stage: 'analysing', found: 3 }), JSON.stringify({ stage: 'writing' }), JSON.stringify({ report: REPORT })], { chunked: true }),
    );
    expect(seen.map((e) => (e.kind === 'stage' ? e.stage : e.kind))).toEqual(['searching', 'analysing', 'writing', 'report']);
    expect(last).toEqual({ kind: 'report', report: REPORT });
    expect(sent).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('reads a cached report sent as plain JSON', async () => {
    const { last } = await collect(Response.json({ report: REPORT }));
    expect(last).toEqual({ kind: 'report', report: REPORT });
  });

  it.each([
    [429, { error: 'rate-limited' }, 'rate-limited'],
    [503, { error: 'disabled' }, 'not-configured'],
    [503, { error: 'not-configured' }, 'not-configured'],
    [404, {}, 'not-configured'],
    [503, { error: 'out-of-credit' }, 'out-of-credit'],
    [500, { error: 'misconfigured' }, 'unavailable'],
    [400, { error: 'bad-request' }, 'unavailable'],
  ])('HTTP %i %j is "%s"', async (status, body, code) => {
    expect((await collect(Response.json(body, { status }))).last).toEqual({ kind: 'error', code });
  });

  it('an error line from the server ends the search with that error', async () => {
    const { last } = await collect(streamResponse([JSON.stringify({ stage: 'searching' }), JSON.stringify({ error: 'search-timeout' })]));
    expect(last).toEqual({ kind: 'error', code: 'search-timeout' });
  });

  it('a garbled line, a stream that stops early, or no connection is never a report', async () => {
    expect((await collect(streamResponse(['{"stage":"searching"}', '<html>oops']))).last).toEqual({ kind: 'error', code: 'bad-response' });
    expect((await collect(streamResponse([JSON.stringify({ stage: 'searching' })]))).last).toEqual({ kind: 'error', code: 'unavailable' });
    expect((await collect(() => Promise.reject(new TypeError('Failed to fetch')))).last).toEqual({ kind: 'error', code: 'unavailable' });
  });

  it('gives up after its time limit', async () => {
    const hang = () => new Promise<Response>(() => undefined);
    const fetchImpl = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        void hang();
      })) as unknown as typeof fetch;
    const last = await runStorySearch('https://api.example/api/story', BODY, () => undefined, { fetchImpl, timeoutMs: 20 });
    expect(last).toEqual({ kind: 'error', code: 'search-timeout' });
  });

  it('without a server address, says Story Search is not set up', async () => {
    expect(await runStorySearch('', BODY, () => undefined)).toEqual({ kind: 'error', code: 'not-configured' });
  });
});

describe('parseReport', () => {
  it('keeps a valid report as it is', () => {
    expect(parseReport(REPORT)).toEqual(REPORT);
  });

  it('drops unknown fields and caps long text', () => {
    const r = parseReport({ ...REPORT, html: '<script>x</script>', subject: 'x'.repeat(500) })!;
    expect(r).not.toHaveProperty('html');
    expect(r.subject!.length).toBe(160);
  });

  it('refuses a report with a source that is not a web link', () => {
    expect(parseReport({ ...REPORT, sources: [{ ...REPORT.sources[0], url: 'javascript:alert(1)' }] })).toBeUndefined();
  });

  it('drops factual claims whose sources are not in the list, keeps unclear ones without', () => {
    const r = parseReport({ ...REPORT, whatHappened: [{ text: 'Unsourced.', sources: [] }, { text: 'Cites a missing source.', sources: [7] }, REPORT.whatHappened[0]] })!;
    expect(r.whatHappened).toEqual(REPORT.whatHappened);
    expect(r.unclear).toEqual(REPORT.unclear);
  });

  it('refuses anything that is not a report', () => {
    for (const bad of [null, 'report', [], { ...REPORT, status: 'great' }, { ...REPORT, confidence: '97%' }, { ...REPORT, sources: 'x' }]) {
      expect(parseReport(bad)).toBeUndefined();
    }
  });
});
