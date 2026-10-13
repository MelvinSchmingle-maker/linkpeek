import { describe, expect, it } from 'vitest';
import { hostnameOf, listFeedback, MAX_ENTRIES, recordFeedback } from './store';

const base = {
  resultId: 'r1',
  signal: 'summary-usefulness' as const,
  value: 'up' as const,
  hostname: 'example.test',
  evidence: 'full' as const,
  isDemo: false,
};

describe('feedback store', () => {
  it('stores a vote with a timestamp', async () => {
    await recordFeedback(base);
    const [entry] = await listFeedback();
    expect(entry).toMatchObject(base);
    expect(entry?.at).toBeTypeOf('number');
  });

  it('one vote per result per signal: a second vote replaces the first', async () => {
    await recordFeedback(base);
    await recordFeedback({ ...base, value: 'down' });
    const all = await listFeedback();
    expect(all).toHaveLength(1);
    expect(all[0]?.value).toBe('down');
  });

  it('keeps separate results separate', async () => {
    await recordFeedback(base);
    await recordFeedback({ ...base, resultId: 'r2' });
    expect(await listFeedback()).toHaveLength(2);
  });

  it('caps how much is stored', async () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) await recordFeedback({ ...base, resultId: `r${i}` });
    const all = await listFeedback();
    expect(all).toHaveLength(MAX_ENTRIES);
    expect(all[0]?.resultId).toBe('r5');
  });

  it('keeps the hostname only, never a path', () => {
    expect(hostnameOf('https://news.example.test/2026/10/story?id=1')).toBe('news.example.test');
    expect(hostnameOf('not a url')).toBe('');
  });
});
