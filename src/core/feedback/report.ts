/**
 * Turns stored feedback into what the options page and the export show.
 * Pure: takes the entries it's given, so every rule is easy to test.
 */
import { FEEDBACK_REASONS, type FeedbackEntry, type FeedbackReason, type FeedbackSignal, type FeedbackValue } from './store';

export const EXPORT_VERSION = 1;

export interface VoteCounts {
  up: number;
  down: number;
  disagree: number;
}

/** Votes per signal, e.g. how many "down" votes the summary usefulness signal has. */
export function countVotes(entries: FeedbackEntry[]): Partial<Record<FeedbackSignal, VoteCounts>> {
  const out: Partial<Record<FeedbackSignal, VoteCounts>> = {};
  for (const e of entries) {
    const c = (out[e.signal] ??= { up: 0, down: 0, disagree: 0 });
    c[e.value as FeedbackValue] += 1;
  }
  return out;
}

/**
 * Why people gave a thumbs-down. Every reason is listed, even with a zero
 * count, so the page always shows the same rows. "No reason given" counts
 * the thumbs-downs where the reason was skipped.
 */
export function countReasons(entries: FeedbackEntry[]): { reason: FeedbackReason | 'none'; count: number }[] {
  const downs = entries.filter((e) => e.signal === 'summary-usefulness' && e.value === 'down');
  const rows: { reason: FeedbackReason | 'none'; count: number }[] = FEEDBACK_REASONS.map((reason) => ({
    reason,
    count: downs.filter((e) => e.reason === reason).length,
  }));
  rows.push({ reason: 'none', count: downs.filter((e) => !e.reason).length });
  return rows;
}

/**
 * The JSON file "Export feedback" downloads. The result id is left out: it's
 * a hash of the page address, and the file shouldn't be a way to look one up.
 * Hostnames only, never article text.
 */
export function exportFeedback(entries: FeedbackEntry[], now: number): string {
  const rows = entries.map(({ resultId: _omit, at, ...rest }) => ({
    ...rest,
    at: new Date(at).toISOString(),
  }));
  return JSON.stringify(
    {
      app: 'LinkPeek',
      exportVersion: EXPORT_VERSION,
      exportedAt: new Date(now).toISOString(),
      note: 'Votes kept on this device. Hostnames only, never page addresses or article text.',
      count: rows.length,
      feedback: rows,
    },
    null,
    2,
  );
}
