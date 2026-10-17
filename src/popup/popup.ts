import { hostOf, originPattern, ALL_SITES } from '../core/sites';
import { annoyanceFor, getSettings, onSettingsChanged, updateSettings, type AnnoyanceSettings } from '../core/storage/settings';
import type { ContentMessage, ContentResponse } from '../content/messages';
import { ANNOYANCE_LABEL, ANNOYANCE_ORDER } from '../content/annoyance/labels';
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
    state.textContent = "LinkPeek can't run on browser pages or the Chrome Web Store.";
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
    // Chrome may close this popup while it asks. Leave a note so the service
    // worker can finish the job ("undo turn off") once access is granted.
    // Not awaited: the request below must happen within this click.
    void chrome.storage.local.set({ pendingTurnOn: { host, at: Date.now() } });
    // Must be in the click handler itself, or Chrome refuses to show the prompt.
    void chrome.permissions
      .request({ origins: [pattern!] })
      .then(async (granted) => {
        // Chrome doesn't always show a prompt (e.g. access LinkPeek gave back
        // earlier), so the popup may still be open: finish the job here too.
        // The service worker does the same; doing it twice is harmless.
        if (granted && disabled) {
          const s = await getSettings();
          await updateSettings({ disabledSites: s.disabledSites.filter((h) => h !== host) });
        }
      })
      .catch(() => undefined)
      .then(renderSite);
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

// Keep the popup honest if something changes while it's open.
onSettingsChanged(() => void renderSite());
chrome.permissions.onAdded.addListener(() => void renderSite());
chrome.permissions.onRemoved.addListener(() => void renderSite());

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

// ---------- Annoyance tools on this site (Part 12) ----------

/** Each tool is a switch for this site only. Undo puts back what the tools changed on the open page. */
async function renderAnnoyance(): Promise<void> {
  if (!host) return;
  $<HTMLElement>('#annoyance-section').hidden = false;
  const list = $('#annoyance-list');
  list.replaceChildren(
    ...ANNOYANCE_ORDER.map((tool) => {
      const label = document.createElement('label');
      label.className = 'toggle';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.tool = tool;
      box.addEventListener('change', () => void setSiteTool(tool, box.checked));
      const text = document.createElement('span');
      text.textContent = ANNOYANCE_LABEL[tool].name;
      const hint = document.createElement('span');
      hint.className = 'muted';
      hint.textContent = ANNOYANCE_LABEL[tool].hint;
      text.append(document.createElement('br'), hint);
      label.append(box, text);
      return label;
    }),
  );
  await showAnnoyance();
}

async function showAnnoyance(): Promise<void> {
  const current = annoyanceFor(await getSettings(), host!);
  for (const box of document.querySelectorAll<HTMLInputElement>('#annoyance-list input')) {
    box.checked = current[box.dataset.tool as keyof typeof current];
  }
}

async function setSiteTool(tool: keyof AnnoyanceSettings, on: boolean): Promise<void> {
  const settings = await getSettings();
  const sites = { ...settings.annoyanceSites };
  sites[host!] = { ...(sites[host!] ?? {}), [tool]: on };
  await updateSettings({ annoyanceSites: sites });
}

$('#annoyance-undo').addEventListener('click', async () => {
  const status = $('#annoyance-status');
  try {
    if (!tab?.id) throw new Error('no tab');
    await chrome.tabs.sendMessage(tab.id, { type: 'annoyance-undo' } satisfies ContentMessage);
    status.textContent = 'Put back what was hidden or labelled on this page.';
  } catch {
    status.textContent = "LinkPeek isn't running on this page, so there's nothing to undo.";
  }
});

onSettingsChanged(() => void showAnnoyance());
await renderAnnoyance();
