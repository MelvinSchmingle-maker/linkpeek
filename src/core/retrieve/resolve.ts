/**
 * Works out where a link really goes, before anything is fetched or any
 * permission is asked for. Social sites send outgoing links through wrapper
 * addresses. This follows only the wrappers listed below, and only through the
 * one parameter each of them is known to use. Any other query string is left
 * alone: a "url=" or "redirect=" on some other address is never followed.
 *
 * Three addresses are kept apart elsewhere in LinkPeek:
 *   - the original: the link the user saw or clicked;
 *   - the resolved: the destination this module found (not set when only
 *     following the wrapper can reveal it);
 *   - the final: where the permitted fetch actually ended up.
 */

/** How many wrappers may be unwrapped in a row. */
export const MAX_WRAPPER_DEPTH = 3;
/** Longer addresses are refused before they are parsed. */
export const MAX_ADDRESS_LENGTH = 2048;

export type WrapperName = 'Facebook' | 'Instagram' | 'X' | 'Reddit' | 'Google News';

export type RejectReason = 'malformed' | 'not-web' | 'credentials' | 'missing-destination' | 'loop' | 'too-deep';

export type Resolution =
  /** Not a wrapper: the address as the URL parser reads it. */
  | { kind: 'direct'; url: string; hops: number }
  /** A wrapper that carries its destination: the innermost address, after `hops` unwraps. */
  | { kind: 'decoded'; url: string; wrapper: WrapperName; hops: number }
  /** A wrapper whose destination is only known by following it (for example t.co). `url` is the wrapper. */
  | { kind: 'needs-redirect'; url: string; wrapper: WrapperName; hops: number }
  | { kind: 'rejected'; reason: RejectReason; hops: number };

interface Wrapper {
  name: WrapperName;
  /** Exact hostname, never a suffix: evil-l.facebook.com is not Facebook. */
  host: string;
  /** Exact path. */
  path: RegExp;
  /** The query parameter that holds the destination, when the wrapper carries one. */
  param?: string;
}

/**
 * Known wrappers. Facebook and Instagram put the real address in `u`. X,
 * Reddit and Google News don't show it in the link, so only following them
 * reveals the destination.
 */
const WRAPPERS: Wrapper[] = [
  { name: 'Facebook', host: 'l.facebook.com', path: /^\/l\.php$/, param: 'u' },
  { name: 'Instagram', host: 'l.instagram.com', path: /^\/$/, param: 'u' },
  { name: 'X', host: 't.co', path: /^\/[A-Za-z0-9]+$/ },
  { name: 'Reddit', host: 'out.reddit.com', path: /^\/.+$/ },
  { name: 'Google News', host: 'news.google.com', path: /^\/rss\/articles\/[^/]+$/ },
];

/** Control characters are never part of a real address. */
function hasControlCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function resolveLink(input: string): Resolution {
  return resolveFrom(input, new Set(), 0);
}

/**
 * The address a fetch or permission should be about: the resolved destination
 * when there is one, otherwise the link itself (for a wrapper that can only
 * be followed, that is the wrapper's own address).
 */
export function destinationOf(res: Resolution, original: string): string {
  return res.kind === 'rejected' ? original : res.url;
}

function resolveFrom(input: string, seen: ReadonlySet<string>, hops: number): Resolution {
  if (input.length > MAX_ADDRESS_LENGTH || hasControlCharacter(input)) return { kind: 'rejected', reason: 'malformed', hops };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: 'rejected', reason: 'malformed', hops };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'rejected', reason: 'not-web', hops };
  if (url.username || url.password) return { kind: 'rejected', reason: 'credentials', hops };

  const wrapper = WRAPPERS.find((w) => w.host === url.hostname && w.path.test(url.pathname));
  if (!wrapper) return { kind: 'direct', url: url.href, hops };
  if (!wrapper.param) return { kind: 'needs-redirect', url: url.href, wrapper: wrapper.name, hops };

  if (hops >= MAX_WRAPPER_DEPTH) return { kind: 'rejected', reason: 'too-deep', hops };
  if (seen.has(url.href)) return { kind: 'rejected', reason: 'loop', hops };
  const destination = url.searchParams.get(wrapper.param);
  if (!destination) return { kind: 'rejected', reason: 'missing-destination', hops };

  const inner = resolveFrom(destination, new Set([...seen, url.href]), hops + 1);
  if (inner.kind === 'direct') return { kind: 'decoded', url: inner.url, wrapper: wrapper.name, hops: hops + 1 };
  if (inner.kind === 'decoded' || inner.kind === 'needs-redirect') return { ...inner, wrapper: wrapper.name };
  return inner;
}
