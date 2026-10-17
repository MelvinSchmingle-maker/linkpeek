import { describe, expect, it } from 'vitest';
import { addFeedbackReason, deleteAllFeedback, FEEDBACK_REASONS, hostnameOf, listFeedback, MAX_ENTRIES, recordFeedback } from './store';

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

  it('the same vote again (a double click) is ignored and stored once', async () => {
    expect(await recordFeedback(base)).toBe(true);
    expect(await recordFeedback(base)).toBe(false);
    expect(await listFeedback()).toHaveLength(1);
  });

  it('a thumbs-down takes one reason, and choosing it again changes nothing', async () => {
    await recordFeedback({ ...base, value: 'down' });
    expect(await addFeedbackReason('r1', 'summary-usefulness', 'too-vague')).toBe(true);
    expect(await addFeedbackReason('r1', 'summary-usefulness', 'too-vague')).toBe(false);
    const [entry] = await listFeedback();
    expect(entry?.reason).toBe('too-vague');
    expect(await listFeedback()).toHaveLength(1);
  });

  it('a reason can only be added to a thumbs-down, never to a thumbs-up', async () => {
    await recordFeedback(base);
    expect(await addFeedbackReason('r1', 'summary-usefulness', 'other')).toBe(false);
    expect((await listFeedback())[0]?.reason).toBeUndefined();
  });

  it('changing your mind replaces the vote and drops its reason', async () => {
    await recordFeedback({ ...base, value: 'down' });
    await addFeedbackReason('r1', 'summary-usefulness', 'factually-inaccurate');
    await recordFeedback(base);
    const [entry] = await listFeedback();
    expect(entry?.value).toBe('up');
    expect(entry?.reason).toBeUndefined();
  });

  it('a reason for a result that has no vote is refused, and nothing is stored', async () => {
    expect(await addFeedbackReason('nobody', 'summary-usefulness', 'other')).toBe(false);
    expect(await listFeedback()).toHaveLength(0);
  });

  it('keeps the headline rating the user disagreed with, under its own signal', async () => {
    await recordFeedback({ ...base, signal: 'clickbait', value: 'disagree', verdict: 'fail' });
    await recordFeedback({ ...base });
    const all = await listFeedback();
    expect(all).toHaveLength(2);
    expect(all.find((e) => e.signal === 'clickbait')).toMatchObject({ value: 'disagree', verdict: 'fail' });
  });

  it('delete all removes every vote and nothing else is left behind', async () => {
    await recordFeedback(base);
    await recordFeedback({ ...base, resultId: 'r2', value: 'down' });
    await deleteAllFeedback();
    expect(await listFeedback()).toEqual([]);
  });

  it('lists every reason the card can give, in order', () => {
    expect(FEEDBACK_REASONS).toEqual([
      'missed-main-point',
      'factually-inaccurate',
      'too-vague',
      'not-article-match',
      'inaccessible',
      'other',
    ]);
  });
});
