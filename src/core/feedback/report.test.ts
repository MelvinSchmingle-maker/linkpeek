import { describe, expect, it } from 'vitest';
import { countReasons, countVotes, exportFeedback } from './report';
import type { FeedbackEntry } from './store';

const at = Date.UTC(2026, 9, 17, 12, 0, 0);
const entry = (over: Partial<FeedbackEntry>): FeedbackEntry => ({
  resultId: 'r',
  signal: 'summary-usefulness',
  value: 'up',
  hostname: 'news.example.test',
  evidence: 'full',
  isDemo: false,
  at,
  ...over,
});

describe('feedback counts', () => {
  it('counts votes per signal, so a headline rating never adds to summary votes', () => {
    const counts = countVotes([
      entry({ value: 'up' }),
      entry({ value: 'down' }),
      entry({ value: 'down' }),
      entry({ signal: 'clickbait', value: 'disagree', verdict: 'pass' }),
    ]);
    expect(counts['summary-usefulness']).toEqual({ up: 1, down: 2, disagree: 0 });
    expect(counts.clickbait).toEqual({ up: 0, down: 0, disagree: 1 });
  });

  it('lists every reason, even with no votes, and counts skipped reasons as "none"', () => {
    const rows = countReasons([
      entry({ value: 'down', reason: 'too-vague' }),
      entry({ value: 'down' }),
      entry({ value: 'down', reason: 'too-vague' }),
      entry({ value: 'up' }),
    ]);
    expect(rows.find((r) => r.reason === 'too-vague')?.count).toBe(2);
    expect(rows.find((r) => r.reason === 'other')?.count).toBe(0);
    expect(rows.find((r) => r.reason === 'none')?.count).toBe(1);
    expect(rows).toHaveLength(7);
  });
});

describe('feedback export', () => {
  it('is JSON with hostnames and times, and no result ids or page addresses', () => {
    const text = exportFeedback([entry({ resultId: 'secret-hash', value: 'down', reason: 'inaccessible' })], at);
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe('LinkPeek');
    expect(parsed.count).toBe(1);
    expect(parsed.exportedAt).toBe('2026-10-17T12:00:00.000Z');
    expect(parsed.feedback[0]).toMatchObject({ hostname: 'news.example.test', reason: 'inaccessible' });
    expect(parsed.feedback[0].at).toBe('2026-10-17T12:00:00.000Z');
    expect(text).not.toContain('secret-hash');
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('an empty export is still a valid file', () => {
    expect(JSON.parse(exportFeedback([], at)).feedback).toEqual([]);
  });
});
