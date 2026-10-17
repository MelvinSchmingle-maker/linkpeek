/**
 * Feedback, stored on this device only. Nothing is sent anywhere unless the
 * (hidden, off) upload setting is switched on in a later part; see upload.ts.
 *
 * Privacy: we keep the hostname, never the full URL, and never article text.
 * One vote per result per signal: voting again replaces the earlier vote, and
 * repeating the same vote (a double click) changes nothing. The reason for a
 * thumbs-down is added to that same vote, so there's still only one record.
 * Separate signals are never merged, and no vote feeds into any result.
 */
import type { EvidenceLevel, HeadlineVerdict } from '../types';

/** What a vote is about. The card offers "summary-usefulness" and "clickbait" today. */
export type FeedbackSignal = 'summary-usefulness' | 'summary-accuracy' | 'clickbait' | 'security';
/** Thumbs up or down for usefulness; "disagree" for a headline rating. */
export type FeedbackValue = 'up' | 'down' | 'disagree';

/** The optional reasons for a thumbs-down, in the order the card shows them. */
export const FEEDBACK_REASONS = [
  'missed-main-point',
  'factually-inaccurate',
  'too-vague',
  'not-article-match',
  'inaccessible',
  'other',
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export interface FeedbackEntry {
  resultId: string;
  signal: FeedbackSignal;
  value: FeedbackValue;
  /** Only with a thumbs-down, and only if the user picked one. */
  reason?: FeedbackReason;
  hostname: string;
  evidence: EvidenceLevel;
  provider?: string;
  wordCount?: number;
  /** The headline rating the user disagreed with (clickbait signal only). */
  verdict?: HeadlineVerdict;
  isDemo: boolean;
  /** Milliseconds since the epoch. */
  at: number;
}

/** What a caller passes in: everything except the time, which the store adds, and the reason, which comes later. */
export type NewFeedback = Omit<FeedbackEntry, 'at' | 'reason'>;

const KEY = 'feedback';
/** Cap so local storage can't grow without limit. Oldest entries drop first. */
export const MAX_ENTRIES = 500;

export async function listFeedback(): Promise<FeedbackEntry[]> {
  const stored = await chrome.storage.local.get(KEY);
  return (stored[KEY] as FeedbackEntry[] | undefined) ?? [];
}

/**
 * Records a vote. Returns false when it changed nothing: the same vote again
 * (a double click), which is ignored rather than stored twice.
 */
export async function recordFeedback(entry: NewFeedback): Promise<boolean> {
  const all = await listFeedback();
  const same = (e: FeedbackEntry) => e.resultId === entry.resultId && e.signal === entry.signal;
  const existing = all.find(same);
  if (existing && existing.value === entry.value && existing.verdict === entry.verdict) return false;
  const kept = all.filter((e) => !same(e));
  kept.push({ ...entry, at: Date.now() });
  await chrome.storage.local.set({ [KEY]: kept.slice(-MAX_ENTRIES) });
  return true;
}

/**
 * Adds a reason to an existing thumbs-down. Only a thumbs-down can have one;
 * anything else returns false. Choosing the same reason again changes nothing.
 */
export async function addFeedbackReason(
  resultId: string,
  signal: FeedbackSignal,
  reason: FeedbackReason,
): Promise<boolean> {
  const all = await listFeedback();
  const target = all.find((e) => e.resultId === resultId && e.signal === signal);
  if (!target || target.value !== 'down' || target.reason === reason) return false;
  target.reason = reason;
  await chrome.storage.local.set({ [KEY]: all });
  return true;
}

/** "Delete all feedback": removes every vote on this device. */
export async function deleteAllFeedback(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
