/**
 * Story Search reports on this device, so asking about the same link again
 * soon doesn't search again (and isn't counted against the rate limit).
 *
 * In chrome.storage.session: memory only, cleared when Chrome closes, and not
 * readable by web pages. Each report is kept for 30 minutes (a developing
 * story changes quickly), at most 20 of them. The key is a hash of what was
 * sent, so the stored entry holds no address in its name.
 */
import type { StoryReport, StoryRequestClues } from './types';

export const STORY_TTL_MS = 30 * 60 * 1000;
export const MAX_STORY_ENTRIES = 20;
const PREFIX = 'sr:';
const INDEX = 'sr-index';

interface Entry {
  at: number;
  report: StoryReport;
}

export async function storyKey(req: StoryRequestClues): Promise<string> {
  const text = JSON.stringify([req.url, req.headline?.text, req.slug, req.date, req.description?.text, req.selection]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)).slice(0, 18)).replace(/[+/=]/g, '');
}

export async function getStoryReport(key: string, now = Date.now()): Promise<StoryReport | undefined> {
  const stored = await chrome.storage.session.get(PREFIX + key);
  const entry = stored[PREFIX + key] as Entry | undefined;
  if (!entry) return undefined;
  if (now - entry.at > STORY_TTL_MS) {
    await chrome.storage.session.remove(PREFIX + key);
    return undefined;
  }
  return entry.report;
}

export async function setStoryReport(key: string, report: StoryReport, now = Date.now()): Promise<void> {
  const { [INDEX]: index = [] } = (await chrome.storage.session.get(INDEX)) as { [INDEX]?: string[] };
  const next = index.filter((k) => k !== key);
  next.push(key);
  const evicted = next.splice(0, Math.max(0, next.length - MAX_STORY_ENTRIES));
  if (evicted.length) await chrome.storage.session.remove(evicted.map((k) => PREFIX + k));
  await chrome.storage.session.set({ [PREFIX + key]: { at: now, report } satisfies Entry, [INDEX]: next });
}

export async function clearStoryReports(): Promise<void> {
  const { [INDEX]: index = [] } = (await chrome.storage.session.get(INDEX)) as { [INDEX]?: string[] };
  await chrome.storage.session.remove([...index.map((k) => PREFIX + k), INDEX]);
}
