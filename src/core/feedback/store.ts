/**
 * Feedback, stored on this device only. Nothing is sent anywhere.
 *
 * Privacy: we keep the hostname, never the full URL, and never article text.
 * One vote per result per signal: voting again replaces the earlier vote.
 * Part 09 adds reasons, export and delete-all on top of this.
 */
import type { EvidenceLevel } from '../types';

/** Separate signals are never merged. Part 09 adds the others. */
export type FeedbackSignal = 'summary-usefulness';
export type FeedbackValue = 'up' | 'down';

export interface FeedbackEntry {
  resultId: string;
  signal: FeedbackSignal;
  value: FeedbackValue;
  hostname: string;
  evidence: EvidenceLevel;
  provider?: string;
  wordCount?: number;
  isDemo: boolean;
  at: number;
}

const KEY = 'feedback';
/** Cap so local storage can't grow without limit. Oldest entries drop first. */
export const MAX_ENTRIES = 500;

export async function listFeedback(): Promise<FeedbackEntry[]> {
  const stored = await chrome.storage.local.get(KEY);
  return (stored[KEY] as FeedbackEntry[] | undefined) ?? [];
}

export async function recordFeedback(entry: Omit<FeedbackEntry, 'at'>): Promise<void> {
  const all = (await listFeedback()).filter(
    (e) => !(e.resultId === entry.resultId && e.signal === entry.signal),
  );
  all.push({ ...entry, at: Date.now() });
  await chrome.storage.local.set({ [KEY]: all.slice(-MAX_ENTRIES) });
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
