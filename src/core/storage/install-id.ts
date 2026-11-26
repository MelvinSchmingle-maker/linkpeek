/**
 * A random ID for this install, sent to LinkPeek's summary backend only so it
 * can rate-limit (Part 06). It says nothing about the person: 128 random bits,
 * made on the device, replaced every 30 days so it can't follow anyone for long.
 * Only made if AI summaries are switched on.
 *
 * Story Search has its own ID under STORY_INSTALL_KEY, made on the first
 * search and deleted when Story Search is switched off, so switching one
 * feature off never affects the other.
 */
const KEY = 'installId';
export const STORY_INSTALL_KEY = 'storyInstallId';
export const ROTATE_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  id: string;
  createdAt: number;
}

export async function getInstallId(now = Date.now(), key = KEY): Promise<string> {
  const { [key]: stored } = (await chrome.storage.local.get(key)) as Record<string, Stored | undefined>;
  if (stored && typeof stored.id === 'string' && now - stored.createdAt < ROTATE_MS) return stored.id;
  const id = randomId();
  await chrome.storage.local.set({ [key]: { id, createdAt: now } satisfies Stored });
  return id;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
