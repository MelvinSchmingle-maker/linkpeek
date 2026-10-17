/**
 * Recent results, so opening the same link twice doesn't fetch it twice.
 *
 * Kept in chrome.storage.session: memory only, gone when the browser closes,
 * and not readable by content scripts (so web pages can't get at it). Each
 * entry expires after 24 hours; at most MAX_ENTRIES are kept. Only the
 * verdict, a first sentence or short preview, the 20-word summary and a few
 * derived facts for the headline check (which study limits the article states,
 * and its money and percentage figures) are stored, never article text.
 */
import type { Assessment } from '../extract/assess';

export const TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ENTRIES = 60;
const PREFIX = 'rc:';
const INDEX = 'rc-index';

interface Entry {
  at: number;
  assessment: Assessment;
}

export async function getCached(key: string, now = Date.now()): Promise<Assessment | undefined> {
  const stored = await chrome.storage.session.get(PREFIX + key);
  const entry = stored[PREFIX + key] as Entry | undefined;
  if (!entry) return undefined;
  if (now - entry.at > TTL_MS) {
    await chrome.storage.session.remove(PREFIX + key);
    return undefined;
  }
  return entry.assessment;
}

export async function setCached(key: string, assessment: Assessment, now = Date.now()): Promise<void> {
  const { [INDEX]: index = [] } = (await chrome.storage.session.get(INDEX)) as { [INDEX]?: string[] };
  const next = index.filter((k) => k !== key);
  next.push(key);
  const evicted = next.splice(0, Math.max(0, next.length - MAX_ENTRIES));
  if (evicted.length) await chrome.storage.session.remove(evicted.map((k) => PREFIX + k));
  await chrome.storage.session.set({ [PREFIX + key]: { at: now, assessment } satisfies Entry, [INDEX]: next });
}

/**
 * Problems that may pass on a later try, so they are not remembered: a
 * timeout, a dropped connection, "too many requests", a server error, a
 * refused request, a robot check, and missing permission.
 */
const NOT_REMEMBERED = ['timeout', 'network', 'http-429', 'http-403', 'http-5xx', 'bot-challenge', 'permission-denied'];

/** Whether a result is worth remembering. Trying again later may work for the problems listed above. */
export function cacheable(a: Assessment): boolean {
  return !a.failure || !NOT_REMEMBERED.includes(a.failure);
}

/** Forget every remembered result (for example when the summary engine changes). */
export async function clearCached(): Promise<void> {
  const { [INDEX]: index = [] } = (await chrome.storage.session.get(INDEX)) as { [INDEX]?: string[] };
  await chrome.storage.session.remove([...index.map((k) => PREFIX + k), INDEX]);
}
