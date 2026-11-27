/**
 * Vercel entry point: POST /api/story (and the CORS preflight). Story Search.
 * Everything is in src/story/; this file only reads the environment and wires it up.
 *
 * 60 seconds: up to 3 searches one after another (8 s each at most) plus
 * Claude (20 s) plus the checks fit inside it.
 */
import { limiterFor } from '../src/ratelimit.js';
import { AnthropicStoryModel } from '../src/story/analyse.js';
import { MemoryReportCache } from '../src/story/cache.js';
import { DEFAULT_RATE_WEIGHT, handleStory } from '../src/story/handler.js';
import { searchProviderFor, spendingMode } from '../src/story/providers/index.js';

export const config = { maxDuration: 60 };

// Free mode unless STORY_SPENDING=paid: only Exa and Tavily, on their free allowances (providers/index.ts).
const spending = spendingMode(process.env);
const provider = searchProviderFor(process.env);
const model = new AnthropicStoryModel();
const limiter = limiterFor(process.env);
const cache = new MemoryReportCache();
const enabled = process.env.STORY_SEARCH_ENABLED !== 'false';
const weight = Number(process.env.STORY_RATE_WEIGHT);
const rateWeight = Number.isInteger(weight) && weight >= 1 && weight <= 10 ? weight : DEFAULT_RATE_WEIGHT;
const searches = Number(process.env.STORY_MAX_SEARCHES);
const maxSearches = Number.isInteger(searches) && searches >= 1 && searches <= 5 ? searches : undefined;

const deps = { provider, model, limiter, cache, enabled, rateWeight, spending, ...(maxSearches ? { maxSearches } : {}) };

export function POST(request: Request): Promise<Response> {
  return handleStory(request, deps);
}

export function OPTIONS(request: Request): Promise<Response> {
  return handleStory(request, deps);
}
