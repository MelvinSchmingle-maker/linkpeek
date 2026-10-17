/**
 * A random ID for this install, sent to LinkPeek's summary backend only so it
 * can rate-limit (Part 06). It says nothing about the person: 128 random bits,
 * made on the device, replaced every 30 days so it can't follow anyone for long.
 * Only made if AI summaries are switched on.
 */
const KEY = 'installId';
export const ROTATE_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  id: string;
  createdAt: number;
}

export async function getInstallId(now = Date.now()): Promise<string> {
  const { [KEY]: stored } = (await chrome.storage.local.get(KEY)) as { [KEY]?: Stored };
  if (stored && typeof stored.id === 'string' && now - stored.createdAt < ROTATE_MS) return stored.id;
  const id = randomId();
  await chrome.storage.local.set({ [KEY]: { id, createdAt: now } satisfies Stored });
  return id;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
