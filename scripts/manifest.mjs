/**
 * Builds manifest.json. Name and description come from src/brand.json,
 * version from package.json, so neither is ever edited here.
 *
 * Permissions are kept to the minimum. See docs/permissions.md for the
 * plain-English reason for each one.
 */
import { readFileSync } from 'node:fs';

const brand = JSON.parse(readFileSync(new URL('../src/brand.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const ICONS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
};

/** @param {{ e2e?: boolean, onDemand?: boolean, live?: boolean }} opts */
export function buildManifest({ e2e = false, onDemand = false, live = false } = {}) {
  const manifest = {
    manifest_version: 3,
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    version: pkg.version,
    icons: ICONS,
    action: {
      default_title: brand.name,
      default_popup: 'popup/index.html',
      default_icon: ICONS,
    },
    options_ui: { page: 'options/index.html', open_in_tab: true },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'offscreen'],
    // Nothing at install. Each site is asked for when you turn LinkPeek on
    // there (or all sites, if you choose that in settings).
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    commands: {
      'peek-link': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Peek at the focused link',
      },
    },
    minimum_chrome_version: '116',
  };

  if (e2e) {
    // Test-only builds. Let automated browser tests reach the local test
    // server (127.0.0.1, and demo.test mapped onto it) without a permission
    // prompt nobody can click. Never shipped: the normal build has no host
    // access at all.
    //  - default test build: Chrome adds LinkPeek to those pages by itself,
    //    like a site you turned on.
    //  - on-demand test build: nothing runs until the test injects it, like
    //    a right-click peek or "Scan this page" on any other site.
    manifest.name = `${brand.name} (test build${onDemand ? ', on demand' : ''})`;
    manifest.host_permissions = ['http://127.0.0.1/*', 'http://demo.test/*'];
    // The live check (scripts/live-check.mjs) reads real websites: all sites.
    if (live) {
      manifest.name = `${brand.name} (live check build)`;
      manifest.host_permissions = ['https://*/*', 'http://*/*'];
    }
    if (!onDemand) {
      manifest.content_scripts = [
        { matches: ['http://127.0.0.1/*', 'http://demo.test/*'], js: ['content.js'], run_at: 'document_idle' },
      ];
    }
  }

  return manifest;
}
