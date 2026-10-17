import { ALL_SITES, grantedSiteOrigins, hasSiteAccess, hostFromPattern, sitePatterns } from '../core/sites';
import { getSettings, onSettingsChanged, updateSettings } from '../core/storage/settings';
import { chromeSummarizer, summarizerOptions, type Availability } from '../core/summary/chrome-builtin';
import type { SummaryEngine } from '../core/summary/provider';
import { renderModePicker } from '../ui/mode-picker';
import { MSG } from '../core/messages';
import { applyBrand } from '../ui/theme';

applyBrand();
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

void renderModePicker($('#mode-section'));

void chrome.commands.getAll().then((cmds) => {
  $('#shortcut').textContent = cmds.find((c) => c.name === 'peek-link')?.shortcut || 'not set';
});

const demo = $<HTMLInputElement>('#demo-toggle');
demo.checked = (await getSettings()).showDemoResults;
demo.addEventListener('change', () => void updateSettings({ showDemoResults: demo.checked }));

// Summaries: who writes them (src/core/summary). The choice is saved at once.
const engineInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="engine"]')];
const onDeviceStatus = $<HTMLElement>('#ondevice-status');
const onDeviceDownload = $<HTMLButtonElement>('#ondevice-download');
const remoteInput = engineInputs.find((i) => i.value === 'remote')!;
let engine = (await getSettings()).summaryEngine;
if (!__API_URL__) {
  // This build has no backend: the option can't be chosen, and says why.
  remoteInput.disabled = true;
  $<HTMLElement>('#remote-status').textContent = "Not set up in this version of LinkPeek.";
  if (engine === 'remote') engine = 'extractive';
}
for (const input of engineInputs) {
  input.checked = input.value === engine;
  input.addEventListener('change', () => {
    if (!input.checked) return;
    void updateSettings({ summaryEngine: input.value as SummaryEngine });
    void showOnDeviceStatus();
  });
}
onDeviceDownload.addEventListener('click', () => void downloadModel());
void showOnDeviceStatus();

function onDeviceChosen(): boolean {
  return engineInputs.some((i) => i.value === 'chrome-on-device' && i.checked);
}

async function showOnDeviceStatus(): Promise<void> {
  const api = chromeSummarizer();
  onDeviceDownload.hidden = true;
  if (!api) {
    onDeviceStatus.textContent = "This version of Chrome doesn't offer on-device summaries.";
    return;
  }
  let state: Availability = 'unavailable';
  try {
    state = await api.availability(summarizerOptions('en', 'medium'));
  } catch {
    // Treated as unavailable.
  }
  onDeviceStatus.textContent = ON_DEVICE_STATUS[state];
  onDeviceDownload.hidden = state !== 'downloadable' || !onDeviceChosen();
}

async function downloadModel(): Promise<void> {
  const api = chromeSummarizer();
  if (!api) return;
  onDeviceDownload.disabled = true;
  onDeviceStatus.textContent = ON_DEVICE_STATUS.downloading;
  try {
    // Needs the click that got us here: Chrome only downloads the model after a user action.
    const session = await api.create({
      ...summarizerOptions('en', 'medium'),
      monitor(m: EventTarget) {
        m.addEventListener('downloadprogress', (e) => {
          const loaded = (e as ProgressEvent).loaded;
          onDeviceStatus.textContent = `Downloading Chrome's AI model: ${Math.round(loaded * 100)}%`;
        });
      },
    } as Parameters<typeof api.create>[0]);
    session.destroy?.();
  } catch {
    onDeviceStatus.textContent = "Chrome couldn't download its AI model. LinkPeek will keep picking a sentence from the article.";
    onDeviceDownload.disabled = false;
    return;
  }
  onDeviceDownload.disabled = false;
  await showOnDeviceStatus();
}

const allSites = $<HTMLInputElement>('#all-sites');
allSites.addEventListener('change', () => {
  if (allSites.checked) {
    // First call in the handler so Chrome shows its prompt.
    void chrome.permissions.request({ origins: ALL_SITES }).catch(() => false).then(render);
    return;
  }
  void (async () => {
    // Removing "all sites" also takes away every site that sits inside it,
    // including the ones turned on one by one. Put those back. Chrome doesn't
    // ask again for access the extension itself gave back.
    const keep = (await grantedSiteOrigins()).filter((o) => !ALL_SITES.includes(o));
    await chrome.permissions.remove({ origins: ALL_SITES }).catch(() => false);
    if (keep.length) await chrome.permissions.request({ origins: keep }).catch(() => false);
    await render();
  })();
});

function item(text: string, action: string, onClick: () => void): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'row';
  const name = document.createElement('span');
  name.textContent = text;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'secondary';
  b.textContent = action;
  b.setAttribute('aria-label', `${action}: ${text}`);
  b.addEventListener('click', onClick);
  li.append(name, b);
  return li;
}

function empty(text: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'muted';
  li.textContent = text;
  return li;
}

async function render(): Promise<void> {
  const origins = await grantedSiteOrigins();
  allSites.checked = ALL_SITES.every((o) => origins.includes(o));
  const sites = origins.filter((o) => !ALL_SITES.includes(o));
  const allowed = $('#allowed-list');
  allowed.replaceChildren(
    ...(sites.length
      ? sites.map((o) =>
          item(hostFromPattern(o), 'Remove', () => void chrome.permissions.remove({ origins: [o] }).then(render)),
        )
      : [empty('None yet. Turn LinkPeek on for a site from its toolbar button.')]),
  );
  const { disabledSites } = await getSettings();
  const hasAccess = new Set(
    await Promise.all(
      disabledSites.map(async (h) => ((await hasSiteAccess(h)) ? h : '')),
    ),
  );
  $('#disabled-list').replaceChildren(
    ...(disabledSites.length
      ? disabledSites.map((h) =>
          item(h, 'Turn back on', () => {
            if (!hasAccess.has(h)) {
              // Access was given back when it was turned off: ask again.
              // The service worker clears the "off" mark once granted.
              void chrome.permissions
                .request({ origins: sitePatterns(h) })
                .then(async (granted) => {
                  if (granted) {
                    const s = await getSettings();
                    await updateSettings({ disabledSites: s.disabledSites.filter((x) => x !== h) });
                  }
                })
                .catch(() => undefined)
                .then(render);
              return;
            }
            void updateSettings({ disabledSites: disabledSites.filter((x) => x !== h) });
          }),
        )
      : [empty('None.')]),
  );
}

chrome.permissions.onAdded.addListener(() => void render());
chrome.permissions.onRemoved.addListener(() => void render());
onSettingsChanged(() => void render());
await render();

const ON_DEVICE_STATUS: Record<Availability, string> = {
  unavailable: "This computer can't run Chrome's on-device AI. LinkPeek will pick a sentence from the article instead.",
  downloadable: "Chrome needs to download its AI model first. Until then, LinkPeek picks a sentence from the article.",
  downloading: "Chrome is downloading its AI model. Until it's done, LinkPeek picks a sentence from the article.",
  available: 'Ready. Summaries are written on this computer.',
};

// Headline checks: the same three outcomes the card explains (src/core/messages.ts).
$('#headline-intro').textContent = MSG.definitionsIntro;
for (const [term, meaning] of MSG.verdictDefinitions) {
  const line = document.createElement('p');
  const name = document.createElement('strong');
  name.textContent = term;
  line.append(name, ` ${meaning}`);
  $('#verdict-definitions').append(line);
}
