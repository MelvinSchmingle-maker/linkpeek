import { hostOf, originPattern, ALL_SITES } from '../core/sites';
import { getSettings, updateSettings } from '../core/storage/settings';
import type { ContentResponse } from '../content/messages';
import { renderModePicker } from '../ui/mode-picker';
import { applyBrand } from '../ui/theme';

applyBrand();
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

$('[data-version]').textContent = chrome.runtime.getManifest().version;
void renderModePicker($('#mode-section'));
$('#open-options').addEventListener('click', (e) => {
  e.preventDefault();
  void chrome.runtime.openOptionsPage();
});
void chrome.commands.getAll().then((cmds) => {
  const shortcut = cmds.find((c) => c.name === 'peek-link')?.shortcut;
  $('#shortcut').textContent = shortcut || 'not set';
});

/**
 * The tab this popup acts on. Normally the active tab. The automated tests
 * open the popup as its own tab, so the test build accepts ?tab=<id>.
 */
async function targetTab(): Promise<chrome.tabs.Tab | undefined> {
  const forced = __E2E__ ? Number(new URLSearchParams(location.search).get('tab')) : NaN;
  if (forced) return chrome.tabs.get(forced);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const tab = await targetTab();
const pattern = originPattern(tab?.url);
const host = hostOf(tab?.url);

// ---------- This site ----------

async function renderSite(): Promise<void> {
  const name = $('#site-name');
  const state = $('#site-state');
  const toggle = $<HTMLButtonElement>('#site-toggle');
  if (!pattern || !host) {
    name.textContent = 'This page';
    state.textContent = "LinkPeek can't run on browser pages.";
    toggle.hidden = true;
    $<HTMLButtonElement>('#scan').disabled = true;
    return;
  }
  const allowed = await chrome.permissions.contains({ origins: [pattern] });
  const disabled = (await getSettings()).disabledSites.includes(host);
  const on = allowed && !disabled;
  name.textContent = host;
  state.textContent = on ? 'On. Runs here by itself.' : 'Off. Runs only when you ask.';
  toggle.textContent = on ? 'Turn off' : 'Turn on';
  toggle.setAttribute('aria-label', `${on ? 'Turn off' : 'Turn on'} LinkPeek for ${host}`);
  toggle.hidden = false;
  toggle.onclick = () => (on ? turnOff(allowed) : turnOn(allowed, disabled));
}

function turnOn(allowed: boolean, disabled: boolean): void {
  if (!allowed) {
    // Must be the first thing in the click handler, or Chrome refuses to show
    // the prompt. Chrome may close this popup while asking; the service worker
    // finishes the job when access is granted.
    void chrome.permissions.request({ origins: [pattern!] }).then(renderSite);
    return;
  }
  void (async () => {
    if (disabled) {
      const s = await getSettings();
      await updateSettings({ disabledSites: s.disabledSites.filter((h) => h !== host) });
    }
    if (tab?.id) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => undefined);
    await renderSite();
  })();
}

async function turnOff(allowed: boolean): Promise<void> {
  const s = await getSettings();
  // Stops LinkPeek on the open page straight away.
  if (!s.disabledSites.includes(host!)) await updateSettings({ disabledSites: [...s.disabledSites, host!] });
  // Give the access back too, unless it comes from "all sites".
  const everywhere = await chrome.permissions.contains({ origins: ALL_SITES });
  if (allowed && !everywhere) await chrome.permissions.remove({ origins: [pattern!] }).catch(() => false);
  await renderSite();
}

// ---------- Scan this page ----------

$('#scan').addEventListener('click', async () => {
  const status = $('#scan-status');
  status.textContent = 'Scanning...';
  try {
    if (!tab?.id) throw new Error('no tab');
    // Clicking the toolbar button granted access to this tab only.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const res = (await chrome.tabs.sendMessage(tab.id, { type: 'scan' })) as ContentResponse;
    const n = res.found ?? 0;
    status.textContent =
      n === 0 ? 'No article links found on this page.' : `Found ${n} article link${n === 1 ? '' : 's'}. Look for the eye icons.`;
  } catch {
    status.textContent = "LinkPeek can't run on this page.";
  }
});

await renderSite();
