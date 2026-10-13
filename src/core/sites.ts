/**
 * Which sites LinkPeek runs on by itself.
 *
 * Chrome is the source of truth: a site is "on" when the user granted
 * LinkPeek access to it (optional host permission). We register one dynamic
 * content script that matches exactly those sites, so nothing runs anywhere
 * else. Turning a site off inside LinkPeek (while access stays granted, e.g.
 * after "allow all sites") is handled by the content script reading
 * settings.disabledSites.
 */
export const SITE_SCRIPT_ID = 'linkpeek-sites';

/** Origins granted at runtime (not the ones baked into the manifest). */
export async function grantedSiteOrigins(): Promise<string[]> {
  const { origins = [] } = await chrome.permissions.getAll();
  const baked = new Set(chrome.runtime.getManifest().host_permissions ?? []);
  return origins.filter((o) => !baked.has(o));
}

export async function syncSiteScripts(): Promise<void> {
  const matches = await grantedSiteOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SITE_SCRIPT_ID] });
  if (matches.length === 0) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SITE_SCRIPT_ID] });
    return;
  }
  const script: chrome.scripting.RegisteredContentScript = {
    id: SITE_SCRIPT_ID,
    matches,
    js: ['content.js'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

/** "https://news.example.com/*" for a page URL, or undefined for non-web pages. */
export function originPattern(pageUrl: string | undefined): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return undefined;
  }
}

export const ALL_SITES = ['https://*/*', 'http://*/*'];

/** Hostname of a page URL, or undefined. */
export function hostOf(pageUrl: string | undefined): string | undefined {
  try {
    return pageUrl ? new URL(pageUrl).hostname : undefined;
  } catch {
    return undefined;
  }
}

/** "news.example.com" from "https://news.example.com/*" or "*://news.example.com/*". */
export function hostFromPattern(pattern: string): string {
  return pattern.replace(/^[\w*]+:\/\//, '').replace(/\/.*$/, '');
}

/** Access pattern for a hostname on both http and https. */
export function sitePattern(host: string): string {
  return `*://${host}/*`;
}

/** True if LinkPeek may run on this host over https or http. */
export async function hasSiteAccess(host: string): Promise<boolean> {
  const [https, http] = await Promise.all([
    chrome.permissions.contains({ origins: [`https://${host}/*`] }),
    chrome.permissions.contains({ origins: [`http://${host}/*`] }),
  ]);
  return https || http;
}
