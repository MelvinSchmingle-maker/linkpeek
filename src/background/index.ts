/**
 * Service worker. Chrome can stop and restart it at any time, so it keeps no
 * state in memory that matters: everything lives in chrome.storage or in
 * Chrome's own permission and script registries.
 */
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../core/storage/settings';
import type { ContentMessage, ContentResponse } from '../content/messages';
import { hostFromPattern, syncSiteScripts } from '../core/sites';

const MENU_ID = 'linkpeek-peek';
const PEEK_COMMAND = 'peek-link';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Peek at this link with LinkPeek',
    contexts: ['link'],
  });
  await syncSiteScripts();
});

chrome.runtime.onStartup.addListener(() => void syncSiteScripts());

// Site access changed (granted in the popup, or removed in Chrome's settings).
chrome.permissions.onAdded.addListener(async (perms) => {
  await syncSiteScripts();
  // Allowing a site again undoes an earlier "turn off for this site".
  const hosts = (perms.origins ?? []).map(hostFromPattern);
  const settings = await getSettings();
  if (settings.disabledSites.some((h) => hosts.includes(h))) {
    await updateSettings({ disabledSites: settings.disabledSites.filter((h) => !hosts.includes(h)) });
  }
  // Start right away on open tabs of the newly allowed sites.
  if (perms.origins?.length) {
    const tabs = await chrome.tabs.query({ url: perms.origins });
    await Promise.all(tabs.map((t) => (t.id ? inject(t.id).catch(() => undefined) : undefined)));
  }
});
chrome.permissions.onRemoved.addListener(() => void syncSiteScripts());

// Right-click a link > "Peek at this link". The click grants activeTab.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.linkUrl) return;
  await send(tab.id, { type: 'peek', url: info.linkUrl });
});

// Keyboard shortcut on a focused link. The shortcut grants activeTab.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== PEEK_COMMAND || !tab?.id) return;
  await send(tab.id, { type: 'peek-focused' });
});

async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

/** Make sure the content script is on the page, then message it. */
async function send(tabId: number, msg: ContentMessage): Promise<ContentResponse | undefined> {
  try {
    await inject(tabId); // does nothing if it's already running (guarded)
    return (await chrome.tabs.sendMessage(tabId, msg)) as ContentResponse;
  } catch {
    // Chrome's own pages and the Web Store can't be scripted. Nothing to do.
    return undefined;
  }
}
