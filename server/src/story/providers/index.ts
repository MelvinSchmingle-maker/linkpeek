/**
 * Picks the search provider(s) from the environment.
 *
 *   STORY_SEARCH_PROVIDER = exa,tavily (default) | exa | tavily | brave | any list, in order
 *   EXA_API_KEY / TAVILY_API_KEY / BRAVE_SEARCH_API_KEY = keys (server only, never in the extension)
 *
 * With a list, each query goes to the first provider; if it fails (its free
 * credit is used up, it's down, or it has no key) the next one gets it. So
 * the default setup uses Exa's free $10 a month, then Tavily's free 1,000
 * credits, and neither needs a card.
 *
 * With no keys at all, the provider answers "misconfigured", so the
 * extension can say Story Search isn't set up, rather than pretend.
 */
import { BraveProvider } from './brave.js';
import { ExaProvider } from './exa.js';
import { TavilyProvider } from './tavily.js';
import type { SearchFailure, SearchOptions, SearchOutcome, SearchProvider } from './types.js';
import type { SearchQuery } from '../queries.js';

export const DEFAULT_PROVIDERS = 'exa,tavily';

function one(name: string, env: Record<string, string | undefined>): SearchProvider {
  if (name === 'exa') return new ExaProvider(env.EXA_API_KEY?.trim() || undefined);
  if (name === 'tavily') return new TavilyProvider(env.TAVILY_API_KEY?.trim() || undefined);
  if (name === 'brave') return new BraveProvider(env.BRAVE_SEARCH_API_KEY?.trim() || undefined);
  return { name, search: async () => ({ ok: false, code: 'misconfigured' }) };
}

/** Tries each provider in order until one answers. */
export class ProviderChain implements SearchProvider {
  readonly name: string;
  readonly exactPhrases: boolean;

  constructor(private readonly providers: SearchProvider[]) {
    this.name = providers.map((p) => p.name).join('+');
    this.exactPhrases = providers[0]?.exactPhrases ?? true;
  }

  async search(query: SearchQuery, opts: SearchOptions): Promise<SearchOutcome> {
    const failures: SearchFailure[] = [];
    for (const p of this.providers) {
      if (opts.signal?.aborted) break;
      const out = await p.search(query, opts);
      if (out.ok) return out;
      failures.push(out.code);
    }
    return { ok: false, code: worst(failures) };
  }
}

/**
 * The failure to report when every provider failed. A provider without a key
 * only counts when none has one. "Out of credit" only when every provider
 * with a key is out of credit; if another one only had a passing problem,
 * that's reported instead, because trying again may work.
 */
function worst(failures: SearchFailure[]): SearchFailure {
  const real = failures.filter((f) => f !== 'misconfigured');
  if (!real.length) return 'misconfigured';
  if (real.every((f) => f === 'quota')) return 'quota';
  return real.find((f) => f !== 'quota') ?? 'upstream';
}

export function searchProviderFor(env: Record<string, string | undefined>): SearchProvider {
  const names = (env.STORY_SEARCH_PROVIDER?.trim() || DEFAULT_PROVIDERS)
    .toLowerCase()
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const providers = [...new Set(names)].map((n) => one(n, env));
  return providers.length === 1 ? providers[0]! : new ProviderChain(providers);
}
