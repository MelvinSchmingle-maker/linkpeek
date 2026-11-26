/**
 * What a link's address says about its story, worked out on the device
 * without visiting it (Story Search, stage 1).
 *
 * - Link wrappers (Facebook's l.php, Google's /url?q=, Outlook safe links...)
 *   carry the real address in a parameter. That is unwrapped here, with no
 *   network request.
 * - Shortened links (bit.ly, t.co...) hide the destination. They are flagged,
 *   and their "slug" is ignored because it's a random code, not words.
 * - The slug ("famous-american-popstar-found-dead-hotel") is decoded into
 *   words, without IDs, file extensions and filler segments.
 * - A date in the path (/2026/11/26/, 2026-11-26, 20261126) is read.
 *
 * Pure: no DOM, no chrome APIs.
 */
import { TRACKING } from '../retrieve/url';

/** Hosts that only redirect, with the parameter holding the real address. */
const WRAPPERS: [RegExp, string[]][] = [
  [/^(l|lm|m|www)\.facebook\.com$/, ['u']],
  [/^l\.instagram\.com$/, ['u']],
  [/^(www\.)?google\.[a-z.]+$/, ['q', 'url']],
  [/^out\.reddit\.com$/, ['url']],
  [/^t\.umblr\.com$/, ['z']],
  [/^(www\.)?youtube\.com$/, ['q']],
  [/^([a-z0-9-]+\.)?safelinks\.protection\.outlook\.com$/, ['url']],
  [/^slack-redir\.net$/, ['url']],
  [/^(www\.)?linkedin\.com$/, ['url']],
];
/** Paths on those hosts that are wrappers (so a normal Google or YouTube page isn't "unwrapped"). */
const WRAPPER_PATH = /^\/(l\.php|url|redirect|link|safety\/go)?\/?$/i;

/**
 * Link shorteners: the address says nothing about the story. Includes
 * publishers' own short domains (nyti.ms, bbc.in). Following them would mean
 * a request to the shortener, which Story Search doesn't make.
 */
const SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 't.co', 'tinyurl.com', 'ow.ly', 'buff.ly', 'goo.gl', 'is.gd', 'lnkd.in', 'dlvr.it',
  'trib.al', 'fb.me', 'amzn.to', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 't.ly', 'bl.ink', 's.id',
  'ift.tt', 'flip.it', 'wp.me', 'reut.rs', 'nyti.ms', 'bbc.in', 'cnn.it', 'wapo.st', 'econ.st', 'bloom.bg',
  'n.pr', 'abcn.ws', 'nbcnews.to', 'politi.co', 'hill.cm', 'theatln.tc', 'apne.ws', 'gu.com', 'trib.in',
  'on.ft.com', 'on.wsj.com', 'aje.io', 'yhoo.it', 'shrtm.nu', 'qr.ae', 'redd.it', 'youtu.be', 'spoti.fi',
  'apple.news', 'news.google.com',
]);

/** Path segments that carry no story words. */
const FILLER_SEGMENTS = new Set([
  'news', 'story', 'stories', 'article', 'articles', 'post', 'posts', 'item', 'items', 'index', 'amp', 'www',
  'en', 'en-gb', 'en-us', 'uk', 'us', 'world', 'html', 'content', 'p', 'a', 'id', 'archive', 'archives', 'blog',
  'blogs', 'live', 'video', 'videos', 'watch', 'read', 'view', 'default', 'home', 'latest', 'section',
]);

export interface UrlFacts {
  /** The address after unwrapping and with tracking parameters and #fragment removed. */
  cleaned: string;
  /** What is sent for Story Search: origin and path only, never the query string (it can carry tokens). */
  sendable: string;
  host: string;
  /** "bbc.co.uk" from "www.bbc.co.uk". */
  site: string;
  /** The link went through a wrapper such as Facebook's l.php, unwrapped here. */
  unwrapped: boolean;
  /** A link shortener: the address hides where it goes. */
  shortened: boolean;
  /** Words from the path, e.g. "famous american popstar found dead hotel". Empty when the path has none. */
  slugWords: string;
  /** Date in the path: "2026-11-26", or "2026-11" when only a month is given. */
  date?: string;
}

export function analyseUrl(href: string): UrlFacts | undefined {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
  let unwrapped = false;
  for (let i = 0; i < 2; i++) {
    const inner = unwrap(u);
    if (!inner) break;
    u = inner;
    unwrapped = true;
  }
  u.hash = '';
  u.username = '';
  u.password = '';
  for (const name of [...u.searchParams.keys()]) if (TRACKING.test(name)) u.searchParams.delete(name);

  const host = u.hostname.toLowerCase();
  const site = host.replace(/^(www|m|amp|mobile)\./, '');
  const shortened = SHORTENERS.has(host) || SHORTENERS.has(site) || looksShortened(u);
  return {
    cleaned: u.href,
    sendable: `${u.origin}${u.pathname}`.slice(0, 500),
    host,
    site,
    unwrapped,
    shortened,
    slugWords: shortened ? '' : slugWords(u.pathname),
    date: shortened ? undefined : pathDate(u.pathname),
  };
}

function unwrap(u: URL): URL | undefined {
  const host = u.hostname.toLowerCase();
  for (const [pattern, params] of WRAPPERS) {
    if (!pattern.test(host) || !WRAPPER_PATH.test(u.pathname)) continue;
    for (const p of params) {
      const value = u.searchParams.get(p);
      if (!value) continue;
      try {
        const inner = new URL(value);
        if (inner.protocol === 'https:' || inner.protocol === 'http:') return inner;
      } catch {
        // Not an address: not a wrapper after all.
      }
    }
  }
  return undefined;
}

/** A short host with one short code for a path, like "xyz.co/Ab3dE9". */
function looksShortened(u: URL): boolean {
  const parts = u.hostname.split('.');
  const label = parts.length >= 2 ? parts[parts.length - 2]! : '';
  const path = u.pathname.replace(/^\/|\/$/g, '');
  return label.length <= 4 && parts.length === 2 && /^[A-Za-z0-9_-]{4,10}$/.test(path) && /\d/.test(path) && /[A-Za-z]/.test(path);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** A token that is an ID, not a word: digits, hex hashes, mixed letters and digits. */
function isIdToken(t: string): boolean {
  if (/^\d+$/.test(t)) return true;
  if (/^[0-9a-f]{8,}$/i.test(t) && /\d/.test(t)) return true;
  if (/\d/.test(t) && /[a-z]/i.test(t) && t.length >= 5) return true;
  return false;
}

/**
 * The path segment that reads most like a headline, as words. Segments are
 * scored by how many real words they hold, so "/world/us-canada-67891234" and
 * "/2026/11/famous-american-popstar-found-dead-hotel.html" both give their words.
 */
export function slugWords(pathname: string): string {
  const segments = pathname.split('/').map(safeDecode).filter(Boolean);
  let best: string[] = [];
  for (const raw of segments) {
    const seg = raw.toLowerCase().replace(/\.(s?html?|php|aspx?|jsp|cms|amp)$/i, '');
    if (FILLER_SEGMENTS.has(seg)) continue;
    const words = seg
      .split(/[-_+.,:;~\s]+/)
      .filter(Boolean)
      .filter((t) => !isIdToken(t))
      .filter((t) => /^[\p{L}][\p{L}'’]*$/u.test(t));
    if (words.length > best.length) best = words;
  }
  // Two words or fewer is usually a section name ("us-canada", "sport"), not a story.
  return best.length >= 3 ? best.join(' ').slice(0, 200) : '';
}

/** A date written into the path. Only plausible dates count. */
export function pathDate(pathname: string): string | undefined {
  const ok = (y: number, m: number, d?: number) =>
    y >= 1990 && y <= 2099 && m >= 1 && m <= 12 && (d === undefined || (d >= 1 && d <= 31));
  const pad = (n: number) => String(n).padStart(2, '0');
  let m = pathname.match(/(?:^|\/)((?:19|20)\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/);
  if (m && ok(+m[1]!, +m[2]!, +m[3]!)) return `${m[1]}-${pad(+m[2]!)}-${pad(+m[3]!)}`;
  m = pathname.match(/(?:^|[/_-])((?:19|20)\d{2})-(\d{2})-(\d{2})(?:[/_.-]|$)/);
  if (m && ok(+m[1]!, +m[2]!, +m[3]!)) return `${m[1]}-${m[2]}-${m[3]}`;
  m = pathname.match(/(?:^|[/_-])((?:19|20)\d{2})(\d{2})(\d{2})(?:[/_.-]|$)/);
  if (m && ok(+m[1]!, +m[2]!, +m[3]!)) return `${m[1]}-${m[2]}-${m[3]}`;
  m = pathname.match(/(?:^|\/)((?:19|20)\d{2})\/(\d{1,2})(?:\/|$)/);
  if (m && ok(+m[1]!, +m[2]!)) return `${m[1]}-${pad(+m[2]!)}`;
  return undefined;
}
