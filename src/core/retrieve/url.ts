/** Address helpers for retrieval and caching. */

/** Tracking parameters that don't change which article a link points to. */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|ocid|cmpid)$/i;

/**
 * One key per article: drops the #fragment and tracking parameters, so
 * "story?utm_source=x#comments" and "story" share a cache entry.
 */
export function cacheKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const name of [...u.searchParams.keys()]) if (TRACKING.test(name)) u.searchParams.delete(name);
    u.searchParams.sort();
    return u.href;
  } catch {
    return url;
  }
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** The address without its #fragment: is the link pointing at the page the user is on? */
export function samePage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    x.hash = '';
    y.hash = '';
    return x.href === y.href;
  } catch {
    return false;
  }
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Registrable-ish host for "did this redirect change site?" ("www." ignored). */
export function siteOf(url: string): string {
  return hostname(url).replace(/^www\./, '');
}
