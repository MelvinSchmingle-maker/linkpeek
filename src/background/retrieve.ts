/**
 * Getting a link's content, in the service worker.
 *
 *  1. A recent result for the same article? Use it.
 *  2. The page already fetched it (same-site link) or sent itself (the link
 *     points at the page the user is on)? Read that.
 *  3. LinkPeek has access to the link's site? Fetch it here, without cookies.
 *  4. The link is on the same site as the page? Ask the page to fetch it:
 *     a same-site request needs no extra permission.
 *  5. Otherwise LinkPeek needs the user's permission for that site first.
 *
 * Reading (parsing HTML, PDF text) happens in the offscreen document.
 */
import type { Assessment } from '../core/extract/assess';
import { checkHeadline } from '../core/clickbait/check';
import { assessFetchError } from '../core/extract/assess';
import { cacheable, getCached, setCached } from '../core/retrieve/cache';
import { REFUSE_LOCAL, refusedUrl } from '../core/retrieve/address';
import { localRuleReady } from './local-rule';
import { destinationOf, resolveLink, type Resolution } from '../core/retrieve/resolve';
import { forget } from './in-flight';
import { fetchLimited, type FetchOutcome, type RawFetch } from '../core/retrieve/fetcher';
import { cacheKey, hostname, sameOrigin } from '../core/retrieve/url';
import type { LinkResult } from '../core/types';
import { getInstallId } from '../core/storage/install-id';
import { getSettings } from '../core/storage/settings';
import { adapterFor } from '../adapters';
import { OFFSCREEN_TARGET, type OffscreenRequest, type OffscreenResponse } from '../offscreen/messages';

export interface RetrieveRequest {
  type: 'retrieve';
  url: string;
  headline: string;
  /** What the page fetched or read itself, when it did. */
  fromPage?: FetchOutcome;
  /** Reading mode (Part 12): also return the article's paragraphs. Reads the page again; nothing is cached.*/
  readable?: boolean;
}

export type RetrieveResponse = { kind: 'result'; result: LinkResult } | { kind: 'fetch-from-page' };

const inFlight = new Map<string, Promise<Assessment | 'fetch-from-page'>>();

/** Automatic reading refuses this computer, the local network and reserved addresses (see REFUSE_LOCAL). */
const REFUSE = REFUSE_LOCAL ? refusedUrl : undefined;

export async function retrieve(req: RetrieveRequest, pageUrl: string | undefined): Promise<RetrieveResponse> {
  const resolution = resolveLink(req.url);
  // The cache and the in-flight map use the destination, so two wrappers for one article share a result.
  const key = cacheKey(destinationOf(resolution, req.url));
  // Shared between simultaneous requests for the same article from the same
  // site (whether the page may fetch it depends on which site it's on).
  const flightKey = `${key}|${pageUrl ? new URL(pageUrl).origin : ''}|${req.readable ? 'readable' : ''}`;
  let pending = inFlight.get(flightKey);
  if (!pending || req.fromPage) {
    pending = work(req, resolution, key, pageUrl);
    inFlight.set(flightKey, pending);
    forget(inFlight, flightKey, pending);
  }
  const outcome = await pending;
  if (outcome === 'fetch-from-page') return { kind: 'fetch-from-page' };
  return { kind: 'result', result: toResult(req, key, outcome, resolution) };
}

async function work(
  req: RetrieveRequest,
  resolution: Resolution,
  key: string,
  pageUrl: string | undefined,
): Promise<Assessment | 'fetch-from-page'> {
  if (resolution.kind === 'rejected') return { evidence: 'unavailable', failure: 'bad-link' };
  // A wrapper that only reveals its destination by being followed (t.co, Reddit, Google News). Following
  // it reaches the destination before any permission for it is checked: measured in Chrome, the request
  // arrives and only the response is withheld. So LinkPeek doesn't follow it.
  if (resolution.kind === 'needs-redirect') return { evidence: 'unavailable', failure: 'bad-link' };
  // The address LinkPeek reads: the destination of a wrapper, or the link itself.
  const target = destinationOf(resolution, req.url);
  // A platform adapter (Part 13) may answer first. None is registered yet, so the general reader runs.
  const adapter = adapterFor(new URL(req.url));
  if (adapter && !req.readable) {
    const answer = await adapter.read({ url: new URL(req.url), headline: req.headline }).catch(() => undefined);
    if (answer) return answer;
  }
  // Reading mode always reads the page: the cache holds no article text, so it can't answer.
  if (!req.fromPage && !req.readable) {
    const cached = await getCached(key);
    if (cached) return cached;
  }

  // The page's own copy (or the page the user is already on) sends no new request, so it isn't refused again.
  if (!req.fromPage && REFUSE?.(target)) return { evidence: 'unavailable', failure: 'unsafe-address' };

  let outcome: FetchOutcome;
  if (req.fromPage) {
    outcome = req.fromPage;
  } else if (await hasHostAccess(target)) {
    // Without the network rule a redirect could reach a private address, so nothing is requested without it.
    if (!(await localRuleReady())) return { evidence: 'unavailable', failure: 'network' };
    outcome = await fetchLimited(target, { via: 'extension', refuse: REFUSE });
  } else if (resolution.kind === 'direct' && pageUrl && sameOrigin(target, pageUrl)) {
    // Only a link to the page's own site is fetched by the page. A wrapper's destination is always fetched here.
    return 'fetch-from-page';
  } else {
    return { evidence: 'unavailable', failure: 'permission-denied' };
  }

  const assessment = outcome.ok ? await assessRaw(outcome.raw, req.headline, req.readable) : assessFetchError(outcome.error);
  if (cacheable(assessment)) {
    // The article's text (reading mode) is handed on, but never kept.
    const storable: Assessment = { ...assessment };
    delete storable.readable;
    await setCached(key, storable);
  }
  return assessment;
}

function toResult(req: RetrieveRequest, key: string, a: Assessment, resolution: Resolution): LinkResult {
  return {
    id: `r-${hash(key)}`,
    url: req.url,
    ...(resolution.kind === 'decoded' ? { resolvedUrl: resolution.url } : {}),
    headline: req.headline,
    evidence: a.evidence,
    ...(a.failure ? { failure: a.failure } : {}),
    ...(a.preview ? { preview: a.preview } : {}),
    ...(a.extract ? { extract: a.extract } : {}),
    ...(a.source ? { source: a.source } : {}),
    ...(a.unsupported ? { unsupported: true } : {}),
    ...(a.finalUrl ? { finalUrl: a.finalUrl } : {}),
    ...(a.summary ? { summary: a.summary } : {}),
    ...(a.readable ? { readable: a.readable } : {}),
    ...(a.failure === 'permission-denied' ? { needsPermissionFor: hostname(destinationOf(resolution, req.url)) } : {}),
    // Run per request, not cached: the same article can be linked with different wording.
    headlineCheck: checkHeadline({
      headline: req.headline,
      evidence: a.evidence,
      facts: a.facts,
      published: a.source?.published?.value,
      modified: a.source?.modified?.value,
      summary: a.summary?.text,
    }),
    linkRisk: { level: 'not-checked' },
    isDemo: false,
  };
}

/** Can the extension itself fetch from this link's site? */
export async function hasHostAccess(url: string): Promise<boolean> {
  if (__E2E__) {
    // Test builds have the test server baked in; tests set this to play "no access".
    const { e2eHostAccess } = await chrome.storage.local.get('e2eHostAccess');
    if (typeof e2eHostAccess === 'boolean') return e2eHostAccess;
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return await chrome.permissions.contains({ origins: [`${u.protocol}//${u.hostname}/*`] });
  } catch {
    return false;
  }
}

// ---------- Offscreen document ----------

const OFFSCREEN_URL = 'offscreen/index.html';
const OFFSCREEN_IDLE_MS = 2 * 60 * 1000;
let creating: Promise<void> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (contexts.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.WORKERS],
      justification: 'Read the articles you ask LinkPeek to preview (parse their HTML and PDF text).',
    })
    .finally(() => {
      creating = undefined;
    });
  await creating;
}

async function assessRaw(raw: RawFetch, headline: string, readable?: boolean): Promise<Assessment> {
  await ensureOffscreen();
  clearTimeout(idleTimer);
  try {
    const { summaryEngine } = await getSettings();
    // AI summaries from LinkPeek's backend only when switched on and this build has one.
    const engine = summaryEngine === 'remote' && !__API_URL__ ? 'extractive' : summaryEngine;
    const remote = engine === 'remote' ? { url: __API_URL__, installId: await getInstallId() } : undefined;
    const msg: OffscreenRequest = {
      target: OFFSCREEN_TARGET,
      type: 'assess',
      raw,
      headline,
      engine,
      ...(remote ? { remote } : {}),
      ...(readable ? { readable: true } : {}),
    };
    const res = (await chrome.runtime.sendMessage(msg)) as OffscreenResponse | undefined;
    if (!res?.ok) return { evidence: 'unavailable', failure: 'extraction-failed' };
    const a = res.assessment;
    if (raw.via === 'current-page' && a.extract) a.extract.method = 'current-page';
    return a;
  } catch {
    return { evidence: 'unavailable', failure: 'extraction-failed' };
  } finally {
    // The reader page isn't needed between previews. Close it when idle.
    idleTimer = setTimeout(() => void chrome.offscreen.closeDocument().catch(() => undefined), OFFSCREEN_IDLE_MS);
  }
}

/** Short stable id for a cache key (for one-vote-per-result feedback). */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
