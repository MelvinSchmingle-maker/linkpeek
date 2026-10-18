/**
 * The site an X link card names. X writes the card's domain at the start of
 * the card's accessible label ("dailymail.com <headline>"). It is text on the
 * page, so it is only used when it is a plain public domain name.
 *
 * It is a hint about the site, not the article's address. LinkPeek reads the
 * article only through the card's t.co link, and only while the network rules
 * allow the t.co hop and this site (src/background/card-network.ts).
 */
export const SHORTENER_HOST = 't.co';

const X_HOSTS = ['x.com', 'twitter.com', SHORTENER_HOST];
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A plain public domain name (not an address, not X's own names, not a single label). */
export function isSiteHostname(host: string | null | undefined): host is string {
  if (typeof host !== 'string') return false;
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!DOMAIN.test(h)) return false;
  return !X_HOSTS.some((x) => h === x || h.endsWith(`.${x}`));
}

/** The site named at the start of a card's accessible label, or undefined when it doesn't name a plain domain. */
export function cardSiteFromLabel(label: string | null | undefined): string | undefined {
  const first = (label ?? '').trim().split(/\s+/)[0] ?? '';
  const host = first.toLowerCase();
  return isSiteHostname(host) ? host : undefined;
}

/** Whether a link is one of X's t.co shortener links. */
export function isShortenerHref(href: string): boolean {
  try {
    const url = new URL(href);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname === SHORTENER_HOST;
  } catch {
    return false;
  }
}
