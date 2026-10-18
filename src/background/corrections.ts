/**
 * The corrections-page check, run by the service worker when the user asks.
 * It uses LinkPeek's own fetch (no cookies), and only where LinkPeek already
 * has access to the site. A result for a site is remembered for a day, in
 * session storage, so it's gone when the browser closes.
 */
import { fetchLimited } from '../core/retrieve/fetcher';
import { findCorrectionsPage, type CorrectionsResult, type PageCheck } from '../core/source/corrections';
import { hasHostAccess } from './retrieve';
import { withSharedNetwork } from './card-network';

const TTL_MS = 24 * 60 * 60 * 1000;
const PREFIX = 'corrections:';

export async function checkSiteCorrections(url: string): Promise<CorrectionsResult> {
  let origin: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { kind: 'error' };
    origin = u.origin;
  } catch {
    return { kind: 'error' };
  }
  if (!(await hasHostAccess(url))) return { kind: 'needs-access' };

  const cached = await readCached(origin);
  if (cached) return cached;
  const result = await findCorrectionsPage(origin, fetchCheck);
  // Errors aren't remembered: trying again later may work.
  if (result.kind === 'found' || result.kind === 'not-found') await writeCached(origin, result);
  return result;
}

async function fetchCheck(url: string): Promise<PageCheck | undefined> {
  const outcome = await withSharedNetwork(() => fetchLimited(url, { via: 'extension' }));
  if (!outcome.ok) return undefined;
  const { status, contentType, redirected, finalUrl, text } = outcome.raw;
  // A redirect counts only when it lands on something still called corrections, editorial or ethics: not a login or home page.
  const landed = !redirected || /correction|editorial|ethic/i.test(new URL(finalUrl).pathname);
  return { status, html: contentType === 'text/html' && landed, text: text ?? '' };
}

async function readCached(origin: string): Promise<CorrectionsResult | undefined> {
  try {
    const key = PREFIX + origin;
    const stored = (await chrome.storage.session.get(key))[key] as { at: number; result: CorrectionsResult } | undefined;
    return stored && Date.now() - stored.at < TTL_MS ? stored.result : undefined;
  } catch {
    return undefined;
  }
}

async function writeCached(origin: string, result: CorrectionsResult): Promise<void> {
  try {
    await chrome.storage.session.set({ [PREFIX + origin]: { at: Date.now(), result } });
  } catch {
    // Session storage unavailable: the next question just asks again.
  }
}
