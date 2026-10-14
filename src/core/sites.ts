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

/**
 * Pages Chrome never lets extensions run on, even with access to every site.
 * Treated like browser pages so the popup doesn't claim LinkPeek runs there.
 */
export function isRestrictedUrl(u: URL): boolean {
  return (
    u.hostname === 'chromewebstore.google.com' ||
    (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore'))
  );
}

/** "https://news.example.com/*" for a page URL, or undefined for pages LinkPeek can't run on. */
export function originPattern(pageUrl: string | undefined): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    if (isRestrictedUrl(u)) return undefined;
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

/**
 * Access patterns for a hostname, one per scheme. Chrome only accepts a
 * request whose patterns each fit inside one manifest entry (all https sites,
 * or all http sites), so a combined "any scheme" pattern is refused.
 */
export function sitePatterns(host: string): string[] {
  return [`https://${host}/*`, `http://${host}/*`];
}

/** True if LinkPeek may run on this host over https or http. */
export async function hasSiteAccess(host: string): Promise<boolean> {
  const results = await Promise.all(sitePatterns(host).map((o) => chrome.permissions.contains({ origins: [o] })));
  return results.some(Boolean);
}
