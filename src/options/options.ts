import { ALL_SITES, grantedSiteOrigins, hasSiteAccess, hostFromPattern, sitePatterns } from '../core/sites';
import { getSettings, onSettingsChanged, updateSettings } from '../core/storage/settings';
import { chromeSummarizer, summarizerOptions, type Availability } from '../core/summary/chrome-builtin';
import type { SummaryEngine } from '../core/summary/provider';
import { renderModePicker } from '../ui/mode-picker';
import { MSG } from '../core/messages';
import { applyBrand } from '../ui/theme';
import { deleteAllFeedback, listFeedback, type FeedbackEntry } from '../core/feedback/store';
import { countReasons, countVotes, exportFeedback } from '../core/feedback/report';
import { FEEDBACK_REASON_LABEL } from '../core/messages';
import { ANNOYANCE_LABEL, ANNOYANCE_ORDER } from '../content/annoyance/labels';

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
  const { disabledSites, overruledWarnings } = await getSettings();
  $('#overruled-list').replaceChildren(
    ...(overruledWarnings.length
      ? overruledWarnings.map((site) =>
          item(site, 'Show warnings again', () =>
            void updateSettings({ overruledWarnings: overruledWarnings.filter((s) => s !== site) }),
          ),
        )
      : [empty('None.')]),
  );
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

// Your feedback (Part 09): what's stored here, a file to export, and delete-all.
// Delete takes two presses, so nothing is lost by a stray click and no dialog is needed.
const feedbackCounts = $('#feedback-counts');
const feedbackStatus = $('#feedback-status');
const feedbackDelete = $<HTMLButtonElement>('#feedback-delete');
const DELETE_LABEL = 'Delete all feedback';
let deleteArmed = false;

async function renderFeedback(): Promise<FeedbackEntry[]> {
  const entries = await listFeedback();
  const votes = countVotes(entries);
  const up = votes['summary-usefulness']?.up ?? 0;
  const down = votes['summary-usefulness']?.down ?? 0;
  const disagree = votes.clickbait?.disagree ?? 0;
  const lines: string[] = [
    `Summaries: ${up} thumbs up, ${down} thumbs down.`,
    `Headline checks: ${disagree} "disagree" votes.`,
  ];
  const reasons = countReasons(entries).filter((r) => r.count > 0);
  const reasonItems = reasons.map(({ reason, count }) =>
    reason === 'none' ? `No reason given: ${count}` : `${FEEDBACK_REASON_LABEL[reason]}: ${count}`,
  );
  feedbackCounts.replaceChildren(
    ...[...lines, ...(reasonItems.length ? ['Thumbs-down reasons:', ...reasonItems] : [])].map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }),
  );
  feedbackDelete.disabled = entries.length === 0;
  return entries;
}

$('#feedback-export').addEventListener('click', async () => {
  const entries = await listFeedback();
  const blob = new Blob([exportFeedback(entries, Date.now())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'linkpeek-feedback.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  feedbackStatus.textContent = `Exported ${entries.length} ${entries.length === 1 ? 'vote' : 'votes'}.`;
});

feedbackDelete.addEventListener('click', async () => {
  if (!deleteArmed) {
    deleteArmed = true;
    feedbackDelete.textContent = 'Press again to delete every vote';
    feedbackStatus.textContent = 'Nothing is deleted until you press it a second time.';
    return;
  }
  await deleteAllFeedback();
  deleteArmed = false;
  feedbackDelete.textContent = DELETE_LABEL;
  feedbackStatus.textContent = 'All feedback deleted.';
  await renderFeedback();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.feedback) void renderFeedback();
});
await renderFeedback();

// Annoyance tools (Part 12): the global choices, and each site's own choices.
function renderAnnoyanceOptions(settings: Awaited<ReturnType<typeof getSettings>>): void {
  $('#annoyance-global').replaceChildren(
    ...ANNOYANCE_ORDER.map((tool) => {
      const label = document.createElement('label');
      label.className = 'toggle';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = settings.annoyance[tool];
      box.addEventListener('change', () =>
        void (async () => {
          const latest = await getSettings();
          await updateSettings({ annoyance: { ...latest.annoyance, [tool]: box.checked } });
        })(),
      );
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
  const sites = Object.entries(settings.annoyanceSites);
  $('#annoyance-sites').replaceChildren(
    ...(sites.length
      ? sites.map(([site, choices]) => {
          const on = ANNOYANCE_ORDER.filter((t) => choices[t] !== undefined).map((t) => `${ANNOYANCE_LABEL[t].name}: ${choices[t] ? 'on' : 'off'}`);
          return item(`${site} (${on.join(', ')})`, 'Remove', () => {
            void (async () => {
              const latest = await getSettings();
              const next = { ...latest.annoyanceSites };
              delete next[site];
              await updateSettings({ annoyanceSites: next });
            })();
          });
        })
      : [empty('None. The popup sets these for one site at a time.')]),
  );
}
onSettingsChanged((next) => renderAnnoyanceOptions(next));
renderAnnoyanceOptions(await getSettings());

