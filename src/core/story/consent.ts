/**
 * Whether the user has seen what Story Search sends and pressed "Search".
 * Until they have, every Story Search first shows exactly what will be sent
 * and waits. Settings can reset it, so the next search asks again.
 *
 * Kept under its own key, not in the settings object: a settings change
 * makes every open page re-apply its mode, which would close the very card
 * the user just pressed "Search" in.
 */
export const CONSENT_KEY = 'storySearchConsent';

export async function hasStoryConsent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_KEY);
  return stored[CONSENT_KEY] === true;
}

export async function giveStoryConsent(): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: true });
}

export async function resetStoryConsent(): Promise<void> {
  await chrome.storage.local.remove(CONSENT_KEY);
}
