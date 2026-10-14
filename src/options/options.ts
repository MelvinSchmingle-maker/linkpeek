import { ALL_SITES, grantedSiteOrigins, hasSiteAccess, hostFromPattern, sitePatterns } from '../core/sites';
import { getSettings, onSettingsChanged, updateSettings } from '../core/storage/settings';
import { renderModePicker } from '../ui/mode-picker';
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
