/**
 * Vercel entry point: POST /api/summarise (and the CORS preflight).
 * Everything is in src/; this file only reads the environment and wires it up.
 */
import { AnthropicSummaryModel } from '../src/anthropic.js';
import { handle } from '../src/handler.js';
import { limiterFor } from '../src/ratelimit.js';

export const config = { maxDuration: 30 };

const model = new AnthropicSummaryModel();
// Vercel Firewall rules on Vercel; "memory" only for local runs; anything else refuses (src/ratelimit.ts).
const limiter = limiterFor(process.env);
const enabled = process.env.SUMMARIES_ENABLED !== 'false';

export function POST(request: Request): Promise<Response> {
  return handle(request, { model, limiter, enabled });
}

export function OPTIONS(request: Request): Promise<Response> {
  return handle(request, { model, limiter, enabled });
}
