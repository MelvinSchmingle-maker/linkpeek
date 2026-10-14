/**
 * Service worker. Chrome can stop and restart it at any time, so it keeps no
 * state in memory that matters: everything lives in chrome.storage or in
 * Chrome's own permission and script registries. All listeners are added at
 * the top level, as Manifest V3 requires.
 */
import { hostFromPattern, originPattern, syncSiteScripts } from '../core/sites';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../core/storage/settings';
import type { ContentMessage, ContentResponse, SiteStatus } from '../content/messages';

const MENU_ID = 'linkpeek-peek';
const PEEK_COMMAND = 'peek-link';
/** How long a "Turn on" press stays pending while Chrome shows its prompt. */
const PENDING_TURN_ON_MS = 2 * 60 * 1000;

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  // Chrome keeps menus across restarts and fires onInstalled on Chrome
  // updates too, so clear before creating to avoid a duplicate-id error.
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Peek at this link with LinkPeek',
    contexts: ['link'],
  });
  await syncSiteScripts();
});

chrome.runtime.onStartup.addListener(() => void syncSiteScripts());

// The content script asks whether it may run by itself on this site.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse: (r: SiteStatus) => void) => {
  if (msg?.type !== 'site-status') return false;
  siteAllowed(sender.url ?? sender.tab?.url).then(
    (allowed) => sendResponse({ allowed }),
    () => sendResponse({ allowed: false }),
  );
  return true;
});

async function siteAllowed(pageUrl: string | undefined): Promise<boolean> {
  if (__E2E__) {
    // Test builds have access to the test server baked in, so tests set this
    // to play "a site you haven't turned on". Not present in the real build.
    const { e2eSiteAllowed } = await chrome.storage.local.get('e2eSiteAllowed');
    if (typeof e2eSiteAllowed === 'boolean') return e2eSiteAllowed;
  }
  const pattern = originPattern(pageUrl);
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false;
}

// Site access changed (granted in the popup, or removed in Chrome's settings).
chrome.permissions.onAdded.addListener(async (perms) => {
  await syncSiteScripts();
  // The user pressed "Turn on" for a site (the popup may have closed while
  // Chrome asked): undo their earlier "turn off" for exactly that site.
  // Access granted for any other reason (e.g. LinkPeek restoring sites after
  // "all websites" is unticked) leaves their "off" marks alone.
  const { pendingTurnOn } = await chrome.storage.local.get('pendingTurnOn');
  const pending = pendingTurnOn as { host: string; at: number } | undefined;
  const hosts = (perms.origins ?? []).map(hostFromPattern);
  if (pending && Date.now() - pending.at >= PENDING_TURN_ON_MS) await chrome.storage.local.remove('pendingTurnOn');
  else if (pending && hosts.includes(pending.host)) {
    await chrome.storage.local.remove('pendingTurnOn');
    const settings = await getSettings();
    if (settings.disabledSites.includes(pending.host)) {
      await updateSettings({ disabledSites: settings.disabledSites.filter((h) => h !== pending.host) });
    }
  }
  // Start right away on open tabs of the newly allowed sites.
  if (perms.origins?.length) {
    const tabs = await chrome.tabs.query({ url: perms.origins });
    await Promise.all(
      tabs.map(async (t) => {
        if (!t.id) return;
        try {
          await inject(t.id, 0);
          await chrome.tabs.sendMessage(t.id, { type: 'refresh' } satisfies ContentMessage, { frameId: 0 });
        } catch {
          // Tab can't be scripted (e.g. still loading a browser page). It will pick up the change on reload.
        }
      }),
    );
  }
});
chrome.permissions.onRemoved.addListener(() => void syncSiteScripts());

// Right-click a link > "Peek at this link". The click grants activeTab.
// The link may be inside a frame, so talk to that frame.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.linkUrl) return;
  const frameId = info.frameId ?? 0;
  await closeCardsInTab(tab.id);
  const res = await send(tab.id, frameId, { type: 'peek', url: info.linkUrl });
  if (!res?.ok) await showProblem(tab.id);
});

// Keyboard shortcut on a focused link. The shortcut grants activeTab. The
// focused link may be in a frame: add LinkPeek to every frame it may run in,
// then ask them all; only the frame that has focus answers.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== PEEK_COMMAND || !tab?.id) return;
  const tabId = tab.id;
  await closeCardsInTab(tabId);
  let res: ContentResponse | undefined;
  try {
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    } catch {
      await inject(tabId, 0); // some frames can't be scripted; the top one may still work
    }
    res = (await chrome.tabs.sendMessage(tabId, { type: 'peek-focused' } satisfies ContentMessage)) as ContentResponse;
  } catch {
    res = undefined;
  }
  if (!res?.ok) await showProblem(tabId);
});

async function inject(tabId: number, frameId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['content.js'] });
}

/** Make sure the content script is in the frame, then message it. */
async function send(tabId: number, frameId: number, msg: ContentMessage): Promise<ContentResponse | undefined> {
  try {
    await inject(tabId, frameId); // does nothing if it's already running (guarded)
    return (await chrome.tabs.sendMessage(tabId, msg, { frameId })) as ContentResponse;
  } catch {
    // Chrome's own pages, the Web Store, PDFs and frames from other sites can't be scripted.
    return undefined;
  }
}

/** One card at a time per tab: close any card open in any frame before a new peek. */
async function closeCardsInTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'close-card' } satisfies ContentMessage);
  } catch {
    // No LinkPeek in this tab yet. Nothing to close.
  }
}

/**
 * A peek didn't work (nothing focused, a page LinkPeek can't run on, a frame
 * from another site). Say so on the toolbar button for a few seconds rather
 * than failing silently.
 */
async function showProblem(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6b7280' });
    await chrome.action.setBadgeText({ tabId, text: '?' });
    await chrome.action.setTitle({ tabId, title: "LinkPeek couldn't peek at that link here." });
    setTimeout(() => {
      void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
      void chrome.action.setTitle({ tabId, title: '' }).catch(() => undefined);
    }, 4000);
  } catch {
    // Tab closed meanwhile.
  }
}
