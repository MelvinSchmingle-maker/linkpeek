/**
 * Talks to LinkPeek's Story Search endpoint (server/api/story.ts). Runs in
 * the service worker, so the request comes from the extension, not from the
 * page: the page's site isn't revealed, and no cookies or referrer go with it.
 *
 * The answer streams, one JSON object per line: stages as the server reaches
 * them, then the report or an error. Everything that comes back is checked
 * here, field by field, before it reaches the card: the server is trusted to
 * write the report, not to send markup or scripts, so only known fields of
 * the right types are kept, strings are capped, and source links must be
 * http(s).
 */
import type {
  Claim,
  DetailLabel,
  Evidence,
  EvidenceDepth,
  HeadlineBasis,
  HeadlineCheck,
  HeadlineVerdict,
  InvestigationConfidence,
  MatchStatus,
  ReportNote,
  ReportSource,
  ReportStatus,
  SourceKind,
  StoryErrorCode,
  StoryReport,
  StoryRequestBody,
} from './types';

export type StoryEvent =
  | { kind: 'stage'; stage: 'searching' | 'analysing' | 'writing'; found?: number }
  | { kind: 'report'; report: StoryReport }
  | { kind: 'error'; code: StoryErrorCode };

/** The server's own limit is 60 seconds. */
const TIMEOUT_MS = 65_000;

export async function runStorySearch(
  url: string,
  body: StoryRequestBody,
  onEvent: (e: StoryEvent) => void,
  { fetchImpl = (...a: Parameters<typeof fetch>) => fetch(...a), signal, timeoutMs = TIMEOUT_MS }: { fetchImpl?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<StoryEvent> {
  const finish = (e: StoryEvent) => {
    onEvent(e);
    return e;
  };
  if (!url) return finish({ kind: 'error', code: 'not-configured' });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch {
      return finish({ kind: 'error', code: timedOut ? 'search-timeout' : 'unavailable' });
    }
    if (!res.ok) return finish({ kind: 'error', code: await httpError(res) });

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('ndjson')) {
      // A cached report comes back as one plain JSON object.
      const data = await res.json().catch(() => undefined);
      return finish(lineEvent(data) ?? { kind: 'error', code: 'bad-response' });
    }
    if (!res.body) return finish({ kind: 'error', code: 'bad-response' });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        return finish({ kind: 'error', code: timedOut ? 'search-timeout' : 'unavailable' });
      }
      if (chunk.done) break;
      buffered += decoder.decode(chunk.value, { stream: true });
      let nl: number;
      while ((nl = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, nl).trim();
        buffered = buffered.slice(nl + 1);
        if (!line) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return finish({ kind: 'error', code: 'bad-response' });
        }
        const e = lineEvent(parsed);
        if (!e) return finish({ kind: 'error', code: 'bad-response' });
        if (e.kind !== 'stage') return finish(e);
        onEvent(e);
      }
      if (buffered.length > 512 * 1024) return finish({ kind: 'error', code: 'bad-response' });
    }
    // The stream ended without a report.
    return finish({ kind: 'error', code: 'unavailable' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function httpError(res: Response): Promise<StoryErrorCode> {
  const data = (await res.json().catch(() => undefined)) as { error?: unknown } | undefined;
  const code = typeof data?.error === 'string' ? data.error : '';
  if (res.status === 429 || code === 'rate-limited') return 'rate-limited';
  if (code === 'out-of-credit') return 'out-of-credit';
  if (code === 'not-configured' || code === 'disabled' || res.status === 404) return 'not-configured';
  if (code === 'search-timeout' || res.status === 504) return 'search-timeout';
  if (code === 'search-failed') return 'search-failed';
  return 'unavailable';
}

function lineEvent(v: unknown): StoryEvent | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (o.stage === 'searching' || o.stage === 'writing') return { kind: 'stage', stage: o.stage };
  if (o.stage === 'analysing') return { kind: 'stage', stage: 'analysing', ...(Number.isInteger(o.found) ? { found: o.found as number } : {}) };
  if ('report' in o) {
    const report = parseReport(o.report);
    return report ? { kind: 'report', report } : undefined;
  }
  if (typeof o.error === 'string') {
    const map: Record<string, StoryErrorCode> = {
      'not-configured': 'not-configured',
      disabled: 'not-configured',
      'search-failed': 'search-failed',
      'search-timeout': 'search-timeout',
      'rate-limited': 'rate-limited',
      'out-of-credit': 'out-of-credit',
    };
    return { kind: 'error', code: map[o.error] ?? 'unavailable' };
  }
  return undefined;
}

// ---------- Checking the report ----------

const STATUSES: ReportStatus[] = ['report', 'no-results', 'no-match', 'report-failed'];
const MATCHES: MatchStatus[] = ['strong', 'possible', 'none'];
const CONFIDENCES: InvestigationConfidence[] = ['strong', 'partial', 'conflicting', 'insufficient'];
const KINDS: SourceKind[] = ['primary', 'agency', 'news', 'opinion', 'social', 'other'];
const LABELS: DetailLabel[] = ['who', 'what', 'where', 'when', 'why'];
const NOTES: ReportNote[] = ['single-source', 'developing', 'headlines-only', 'excerpts-only', 'older-story', 'syndicated', 'vague-link', 'no-established-sources', 'withdrawn'];
const DEPTHS: EvidenceDepth[] = ['headline', 'excerpt', 'extended', 'full'];
const BASES: HeadlineBasis['kind'][] = ['supported', 'contradicted', 'alleged', 'unsupported', 'disputed', 'insufficient'];
const VERDICTS: HeadlineVerdict[] = ['accurate', 'partly-accurate', 'misleading', 'unverified'];
const MAX_SOURCES = 8;
/** One passage per cited source, so never fewer than the sources a claim can cite. */
const MAX_QUOTES = MAX_SOURCES;

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return list.includes(v as T) ? (v as T) : undefined;
}

function webUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Returns a clean copy of the report, or undefined if it isn't one. */
export function parseReport(v: unknown): StoryReport | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const status = oneOf(o.status, STATUSES);
  const match = oneOf(o.match, MATCHES);
  const confidence = oneOf(o.confidence, CONFIDENCES);
  if (!status || !match || !confidence || !Array.isArray(o.sources)) return undefined;

  const sources: ReportSource[] = [];
  for (const s of o.sources.slice(0, MAX_SOURCES) as Record<string, unknown>[]) {
    if (typeof s !== 'object' || s === null) return undefined;
    const n = s.n;
    const url = webUrl(s.url);
    const title = str(s.title, 220);
    const kind = oneOf(s.kind, KINDS);
    const m = oneOf(s.match, ['strong', 'possible'] as const);
    if (!Number.isInteger(n) || !url || !title || !kind || !m) return undefined;
    const published = typeof s.published === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.published) ? s.published : undefined;
    const updated = typeof s.updated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.updated) ? s.updated : undefined;
    const depth = oneOf(s.depth, DEPTHS);
    sources.push({
      n: n as number,
      title,
      publisher: str(s.publisher, 100) ?? new URL(url).hostname,
      url,
      ...(published ? { published } : {}),
      kind,
      match: m,
      ...(Number.isInteger(s.copyOf) ? { copyOf: s.copyOf as number } : {}),
      ...(str(s.via, 60) ? { via: str(s.via, 60) } : {}),
      ...(s.original === true ? { original: true } : {}),
      ...(updated ? { updated } : {}),
      ...(s.corrected === true ? { corrected: true } : {}),
      ...(depth ? { depth } : {}),
    });
  }
  const numbers = new Set(sources.map((s) => s.n));
  // Quotes: plain text, capped, each pointing at a source in the list.
  const evidence = (x: unknown): Evidence[] =>
    Array.isArray(x)
      ? (x as Record<string, unknown>[])
          .filter((q) => q && Number.isInteger(q.source) && numbers.has(q.source as number))
          .map((q) => ({ source: q.source as number, quote: str(q.quote, 320) }))
          .filter((q): q is Evidence => Boolean(q.quote))
          .slice(0, MAX_QUOTES)
      : [];
  const claims = (x: unknown, max: number, needSources: boolean): Claim[] | undefined => {
    if (!Array.isArray(x)) return undefined;
    const out: Claim[] = [];
    for (const c of x.slice(0, max) as Record<string, unknown>[]) {
      const text = str(c?.text, 400);
      const refs = Array.isArray(c?.sources) ? (c.sources as unknown[]).filter((r): r is number => Number.isInteger(r) && numbers.has(r as number)) : [];
      // A factual claim whose sources aren't in the list is dropped here too.
      if (!text || (needSources && !refs.length)) continue;
      const quotes = evidence(c.evidence);
      out.push({ text, sources: refs, ...(quotes.length ? { evidence: quotes } : {}), ...(c.weak === true ? { weak: true } : {}) });
    }
    return out;
  };
  const whatHappened = claims(o.whatHappened, 3, true);
  const confirmed = claims(o.confirmed, 6, true);
  const reported = claims(o.reported, 6, true);
  const unclear = claims(o.unclear, 4, false);
  if (!whatHappened || !confirmed || !reported || !unclear || !Array.isArray(o.details)) return undefined;
  const details: (Claim & { label: DetailLabel })[] = [];
  for (const d of (o.details as Record<string, unknown>[]).slice(0, 5)) {
    const label = oneOf(d?.label, LABELS);
    const [c] = claims([d], 1, true) ?? [];
    if (label && c) details.push({ ...c, label });
  }
  const notes = Array.isArray(o.notes) ? (o.notes as unknown[]).filter((x): x is ReportNote => NOTES.includes(x as ReportNote)) : [];
  const h = o.headline as Record<string, unknown> | undefined;
  const verdict = h && typeof h === 'object' ? oneOf(h.verdict, VERDICTS) : undefined;
  const b = h && typeof h === 'object' ? (h.basis as Record<string, unknown> | undefined) : undefined;
  const basisKind = b && typeof b === 'object' ? oneOf(b.kind, BASES) : undefined;
  const basisTerms = Array.isArray(b?.terms) ? (b!.terms as unknown[]).map((t) => str(t, 40)).filter((t): t is string => Boolean(t)).slice(0, 5) : [];
  const headline: HeadlineCheck | undefined =
    h && verdict && str(h.headline, 300)
      ? { headline: str(h.headline, 300)!, verdict, reason: str(h.reason, 320) ?? '', evidence: evidence(h.evidence), ...(basisKind ? { basis: { kind: basisKind, ...(basisTerms.length ? { terms: basisTerms } : {}) } } : {}) }
      : undefined;
  const independent = Number.isInteger(o.independent) && (o.independent as number) >= 0 && (o.independent as number) <= sources.length ? (o.independent as number) : undefined;
  return {
    status,
    ...(str(o.subject, 160) ? { subject: str(o.subject, 160) } : {}),
    match,
    confidence,
    whatHappened,
    details,
    confirmed,
    reported,
    unclear,
    sources,
    ...(independent !== undefined ? { independent } : {}),
    setAside: Number.isInteger(o.setAside) && (o.setAside as number) >= 0 ? (o.setAside as number) : 0,
    notes: [...new Set(notes)],
    ...(headline ? { headline } : {}),
    searchedFor: str(o.searchedFor, 220) ?? '',
    checkedAt: typeof o.checkedAt === 'string' && !Number.isNaN(Date.parse(o.checkedAt)) ? o.checkedAt : new Date().toISOString(),
  };
}
