/**
 * POST /api/story. Framework-free, like /api/summarise: a web-standard
 * Request in, a Response out.
 *
 * Order: CORS preflight, method, size, JSON, validation, kill switch, rate
 * limits (Story Search counts as several requests), cache, then the
 * investigation. A request that gets that far is answered as a stream of
 * JSON lines, one per stage as it really happens, ending with the report or
 * an error:
 *
 *   {"stage":"searching"}
 *   {"stage":"analysing","found":4}
 *   {"stage":"writing"}
 *   {"report":{...}}
 *
 * Nothing about the link is logged: one line per request with the status,
 * timings, counts, tokens and estimated cost.
 */
import type { RateLimiter } from '../ratelimit.js';
import type { StoryModel } from './analyse.js';
import { cacheKey, ttlFor, type ReportCache } from './cache.js';
import { MAX_STORY_BODY_BYTES, parseStoryRequest, type StoryErrorCode, type StoryEvent } from './contract.js';
import { investigate, type Metrics } from './investigate.js';
import type { SearchProvider } from './providers/types.js';

export interface StoryDeps {
  provider: SearchProvider;
  model: StoryModel;
  limiter: RateLimiter;
  cache: ReportCache;
  enabled: boolean;
  /** How many summary-sized requests one Story Search counts as. */
  rateWeight?: number;
  /** Most searches one Story Search may make. */
  maxSearches?: number;
  /** "free" or "paid", for the log line. */
  spending?: string;
  log?: (line: Record<string, unknown>) => void;
  now?: () => number;
  /** The date the investigation treats as today (for date windows and the AI's <today>). Tests fix it so recordings replay. */
  clock?: () => Date;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const STATUS: Record<StoryErrorCode, number> = {
  'bad-request': 400,
  'too-large': 413,
  'method-not-allowed': 405,
  'rate-limited': 429,
  disabled: 503,
  'not-configured': 503,
  'search-failed': 502,
  'search-timeout': 504,
  'out-of-credit': 503,
  misconfigured: 500,
};

export const DEFAULT_RATE_WEIGHT = 3;

function json(body: StoryEvent, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

export async function handleStory(request: Request, deps: StoryDeps): Promise<Response> {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((line) => console.log(JSON.stringify(line)));
  const started = now();
  const fail = (code: StoryErrorCode, extra: Record<string, unknown> = {}) => {
    log({ at: 'story', status: STATUS[code], code, ms: now() - started, ...extra });
    return json({ error: code }, STATUS[code]);
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return fail('method-not-allowed');

  if (Number(request.headers.get('content-length') ?? 0) > MAX_STORY_BODY_BYTES) return fail('too-large');
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail('bad-request');
  }
  if (new TextEncoder().encode(raw).length > MAX_STORY_BODY_BYTES) return fail('too-large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('bad-request');
  }
  const req = parseStoryRequest(body);
  if (!req) return fail('bad-request');
  if (!deps.enabled) return fail('disabled');

  const limit = await deps.limiter
    .check(req.installId, request, { scope: 'story', weight: deps.rateWeight ?? DEFAULT_RATE_WEIGHT })
    .catch(() => 'misconfigured' as const);
  if (limit === 'limited') return fail('rate-limited');
  if (limit === 'misconfigured') return fail('misconfigured', { reason: 'rate-limit' });

  const key = cacheKey(req);
  const cached = deps.cache.get(key);
  if (cached) {
    log({ at: 'story', status: 200, cached: true, ms: now() - started, outcome: cached.status });
    return json({ report: cached }, 200);
  }

  // From here on the answer streams: the status is 200 and errors arrive as the last line.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StoryEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // The extension went away (card closed). The work finishes; nobody reads it.
        }
      };
      let metrics: Metrics | undefined;
      let outcome = 'error';
      try {
        const result = await investigate(
          req,
          { provider: deps.provider, model: deps.model, ...(deps.maxSearches ? { maxSearches: deps.maxSearches } : {}), ...(deps.clock ? { now: deps.clock } : {}) },
          send,
        );
        metrics = result.metrics;
        if (result.ok) {
          outcome = result.report.status;
          // The AI being down is a passing problem: not cached, so trying again tries again.
          // Brave's terms reserve storing results for custom plans, so a report built on Brave results isn't kept.
          const brave = result.metrics.providersUsed.includes('brave');
          if (result.report.status !== 'report-failed' && !brave) deps.cache.set(key, result.report, ttlFor(result.report, new Date()));
          send({ report: result.report });
        } else {
          outcome = result.code;
          send({ error: result.code });
        }
      } catch {
        send({ error: 'search-failed' });
      } finally {
        log({
          at: 'story',
          status: 200,
          outcome,
          spending: deps.spending ?? 'free',
          ms: now() - started,
          ...(metrics ?? {}),
          costUsd: metrics ? Math.round((metrics.searchUsd + metrics.aiUsd) * 1e5) / 1e5 : 0,
        });
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', ...CORS },
  });
}
