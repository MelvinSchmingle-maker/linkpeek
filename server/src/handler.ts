/**
 * POST /api/summarise. Framework-free: takes a web-standard Request and
 * returns a Response, so it runs on Vercel and in plain tests alike.
 *
 * Order: CORS preflight, method, size, JSON, validation, kill switch, rate
 * limits, then the model. Nothing about the article is stored or logged:
 * one log line per request with the status, the error code, timings and
 * token counts.
 */
import type { SummaryModel } from './anthropic.js';
import { MAX_BODY_BYTES, parseRequest, type ErrorCode, type SummariseResponse } from './contract.js';
import type { RateLimiter } from './ratelimit.js';

export interface Deps {
  model: SummaryModel;
  limiter: RateLimiter;
  enabled: boolean;
  log?: (line: Record<string, unknown>) => void;
  now?: () => number;
}

/**
 * Any origin may call this, without cookies. The extension calls it from
 * its own pages; allowing every origin means it needs no extra site
 * permission. Nothing here relies on who the caller is.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const STATUS: Record<ErrorCode, number> = {
  'bad-request': 400,
  'too-large': 413,
  'method-not-allowed': 405,
  'rate-limited': 429,
  busy: 503,
  disabled: 503,
  refused: 422,
  truncated: 502,
  timeout: 504,
  upstream: 502,
  misconfigured: 500,
};

function json(body: SummariseResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((line) => console.log(JSON.stringify(line)));
  const started = now();
  const fail = (code: ErrorCode, extra: Record<string, unknown> = {}) => {
    log({ at: 'summarise', status: STATUS[code], code, ms: now() - started, ...extra });
    return json({ error: code }, STATUS[code]);
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return fail('method-not-allowed');

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return fail('too-large');
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail('bad-request');
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail('too-large');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('bad-request');
  }
  const req = parseRequest(body);
  if (!req) return fail('bad-request');

  if (!deps.enabled) return fail('disabled');

  const limit = await deps.limiter.check(req.installId, request).catch(() => 'misconfigured' as const);
  if (limit === 'limited') return fail('rate-limited');
  if (limit === 'misconfigured') return fail('misconfigured', { reason: 'rate-limit' });

  const result = await deps.model.summarise(req);
  if (!result.ok) return fail(result.code, { task: req.task });

  log({
    at: 'summarise',
    status: 200,
    task: req.task,
    insufficient: 'insufficient' in result,
    model: result.model,
    ms: now() - started,
    ...result.usage,
  });
  if ('insufficient' in result) return json({ insufficient: true, model: result.model, usage: result.usage });
  return json({ summary: result.summary, model: result.model, usage: result.usage });
}
