/**
 * "Check where this link goes" (Part 11). Only runs when the user presses the
 * card's button. It asks the link's site where the address ends up, the way a
 * browser would follow it: no cookies, no referrer, the body never read.
 *
 * Limits, stated in docs/security-services.md and docs/privacy.md: Chrome
 * doesn't show an extension each redirect along the way, so only the final
 * address is known; and Chrome decides how many redirects to follow, so
 * LinkPeek can't enforce its own limit of five.
 */
import { originPattern } from '../core/sites';
import type { RedirectCheckResult } from '../content/messages';

const TIMEOUT_MS = 8_000;

export async function checkRedirects(url: string): Promise<RedirectCheckResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { kind: 'error', reason: 'network' };
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return { kind: 'error', reason: 'network' };
  // Without access to the site, Chrome refuses the request. Say so, rather than guess why it failed.
  const pattern = originPattern(url);
  if (!pattern || !(await chrome.permissions.contains({ origins: [pattern] }))) return { kind: 'error', reason: 'no-access' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    });
    // Only the address is wanted. Don't download the page.
    await res.body?.cancel().catch(() => undefined);
    const final = new URL(res.url || url);
    if (final.protocol !== 'http:' && final.protocol !== 'https:') return { kind: 'error', reason: 'network' };
    return { kind: 'ok', finalUrl: final.href };
  } catch (err) {
    return { kind: 'error', reason: (err as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
