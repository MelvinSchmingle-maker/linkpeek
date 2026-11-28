// @vitest-environment node
/**
 * The evaluation harness's handling of real search answers (D75): what the
 * pipeline sees, what is kept, and how recordings are matched.
 */
import { describe, expect, it } from 'vitest';
import { comparableRequest, recordingFetch, replayFetch, type Exchange } from './harness';

const PAGE_TEXT = 'A long article. '.repeat(400);
const exaAnswer = { results: [{ title: 'Report', url: 'https://www.bbc.co.uk/news/1', highlights: ['A short highlight.'], text: PAGE_TEXT }], costDollars: { total: 0.007 } };
const real = (async () => Response.json(exaAnswer)) as unknown as typeof fetch;
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

describe('real search answers in the evaluation (D75)', () => {
  it('recording: the pipeline and the saved copy both get the trimmed answer, never page text', async () => {
    const sink: Exchange[] = [];
    const got = (await (await recordingFetch(real, sink)('https://api.exa.ai/search', post({ query: 'x' }))).json()) as typeof exaAnswer;
    expect(got.results[0]!.text).toBeUndefined();
    expect(JSON.stringify(sink)).not.toContain('A long article');
  });

  it('a live run with real searches: the pipeline gets the whole answer, page text included; the saved copy stays trimmed', async () => {
    const sink: Exchange[] = [];
    const got = (await (await recordingFetch(real, sink, { full: true })('https://api.exa.ai/search', post({ query: 'x' }))).json()) as typeof exaAnswer;
    expect(got.results[0]!.text).toBe(PAGE_TEXT);
    expect(JSON.stringify(sink)).not.toContain('A long article');
  });

  it('recordings are matched without the page-text options only: everything else must be the same', async () => {
    expect(comparableRequest('exa', { query: 'x', contents: { highlights: { maxCharacters: 1200 }, text: { maxCharacters: 5000 } } })).toEqual({ query: 'x', contents: { highlights: { maxCharacters: 1200 } } });
    expect(comparableRequest('tavily', { query: 'x', include_raw_content: 'text', max_results: 8 })).toEqual({ query: 'x', max_results: 8 });
    const recorded: Exchange[] = [{ provider: 'exa', request: { method: 'POST', path: '/search', body: { query: 'x', contents: { highlights: { maxCharacters: 1200 } } } }, status: 200, response: { results: [] } }];
    const same = replayFetch(recorded, 'case');
    await same.fetch('https://api.exa.ai/search', post({ query: 'x', contents: { highlights: { maxCharacters: 1200 }, text: { maxCharacters: 5000 } } }));
    expect(same.errors).toEqual([]);
    const other = replayFetch(recorded, 'case');
    await other.fetch('https://api.exa.ai/search', post({ query: 'y', contents: { highlights: { maxCharacters: 1200 } } }));
    expect(other.errors).toHaveLength(1);
  });
});
