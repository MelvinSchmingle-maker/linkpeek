/**
 * "Check where this link goes" (Part 11). Only runs when the user presses the
 * card's button. It asks the link's site where the address ends up, the way a
 * browser would follow it: no cookies, no referrer, the body never read.
 *
 * For a social wrapper that carries its destination (Facebook, Instagram), it
 * asks about the destination, not the wrapper: the wrapper's own answer is
 * usually a login page.
 *
 * Limits, stated in docs/security-services.md and docs/privacy.md: Chrome
 * doesn't show an extension each redirect along the way, so only the final
 * address is known; and Chrome decides how many redirects to follow, so
 * LinkPeek can't enforce its own limit of five. The address check (see
 * core/retrieve/address.ts) covers the start and the final address only.
 */
import { originPattern } from '../core/sites';
import { REFUSE_LOCAL, refusedUrl } from '../core/retrieve/address';
import { destinationOf, resolveLink } from '../core/retrieve/resolve';
import { localRuleReady } from './local-rule';
import type { RedirectCheckResult } from '../content/messages';

const TIMEOUT_MS = 8_000;

export async function checkRedirects(url: string): Promise<RedirectCheckResult> {
  const start = destinationOf(resolveLink(url), url);
  let target: URL;
  try {
    target = new URL(start);
  } catch {
    return { kind: 'error', reason: 'network' };
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return { kind: 'error', reason: 'network' };
  if (REFUSE_LOCAL && refusedUrl(start)) return { kind: 'error', reason: 'unsafe-address' };
  // Without access to the site, Chrome refuses the request. Say so, rather than guess why it failed.
  const pattern = originPattern(start);
  if (!pattern || !(await chrome.permissions.contains({ origins: [pattern] }))) return { kind: 'error', reason: 'no-access' };
  if (!(await localRuleReady())) return { kind: 'error', reason: 'network' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(start, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    });
    // Only the address is wanted. Don't download the page.
    await res.body?.cancel().catch(() => undefined);
    const final = new URL(res.url || start);
    if (final.protocol !== 'http:' && final.protocol !== 'https:') return { kind: 'error', reason: 'network' };
    if (REFUSE_LOCAL && refusedUrl(final.href)) return { kind: 'error', reason: 'unsafe-address' };
    return { kind: 'ok', finalUrl: final.href };
  } catch (err) {
    return { kind: 'error', reason: (err as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
