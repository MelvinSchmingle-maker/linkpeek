/**
 * Vercel entry point: POST /api/story (and the CORS preflight). Story Search.
 * Everything is in src/story/; this file only reads the environment and wires it up.
 *
 * 60 seconds: the search (up to two rounds of 8 s) plus Claude (20 s) plus
 * the checks fit well inside it.
 */
import { limiterFor } from '../src/ratelimit.js';
import { AnthropicStoryModel } from '../src/story/analyse.js';
import { MemoryReportCache } from '../src/story/cache.js';
import { DEFAULT_RATE_WEIGHT, handleStory } from '../src/story/handler.js';
import { searchProviderFor } from '../src/story/providers/index.js';

export const config = { maxDuration: 60 };

const provider = searchProviderFor(process.env);
const model = new AnthropicStoryModel();
const limiter = limiterFor(process.env);
const cache = new MemoryReportCache();
const enabled = process.env.STORY_SEARCH_ENABLED !== 'false';
const weight = Number(process.env.STORY_RATE_WEIGHT);
const rateWeight = Number.isInteger(weight) && weight >= 1 && weight <= 10 ? weight : DEFAULT_RATE_WEIGHT;

export function POST(request: Request): Promise<Response> {
  return handleStory(request, { provider, model, limiter, cache, enabled, rateWeight });
}

export function OPTIONS(request: Request): Promise<Response> {
  return handleStory(request, { provider, model, limiter, cache, enabled, rateWeight });
}
