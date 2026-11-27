/**
 * Picks the search provider(s) from the environment.
 *
 *   STORY_SPENDING        = free (default) | paid
 *   STORY_SEARCH_PROVIDER = exa,tavily (default) | exa | tavily | brave | any list, in order
 *   EXA_API_KEY / TAVILY_API_KEY / BRAVE_SEARCH_API_KEY = keys (server only, never in the extension)
 *
 * Free mode (the default) uses only services with a free monthly allowance
 * that needs no card: Exa and Tavily. Brave is left out even if listed (its
 * free credit needs a card). Nothing here enables a paid feature. When both
 * allowances are used up, Story Search stops and says so until they renew.
 * What makes this a guarantee is the accounts: with no card on file, Exa and
 * Tavily can't charge. LinkPeek's code can't see a provider's billing.
 *
 * Paid mode is only ever an explicit choice (STORY_SPENDING=paid). It allows
 * Brave. Spending limits for paid use are set in each provider's dashboard
 * (Exa: key and team budgets; Tavily: the pay-as-you-go limit).
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
/** Services whose free allowance needs no card. The only ones free mode uses. */
export const FREE_PROVIDERS = new Set(['exa', 'tavily']);

export type Spending = 'free' | 'paid';

export function spendingMode(env: Record<string, string | undefined>): Spending {
  return env.STORY_SPENDING?.trim().toLowerCase() === 'paid' ? 'paid' : 'free';
}

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
    const tags: string[] = [];
    for (const p of this.providers) {
      if (opts.signal?.aborted) break;
      const out = await p.search(query, opts);
      if (out.ok) return out;
      failures.push(out.code);
      if (out.tag) tags.push(`${p.name}:${out.tag}`);
    }
    return { ok: false, code: worst(failures), ...(tags.length ? { tag: tags.join(',') } : {}) };
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
  const spending = spendingMode(env);
  const names = [
    ...new Set(
      (env.STORY_SEARCH_PROVIDER?.trim() || DEFAULT_PROVIDERS)
        .toLowerCase()
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ].filter((n) => spending === 'paid' || FREE_PROVIDERS.has(n));
  if (!names.length) return { name: 'none', search: async () => ({ ok: false, code: 'misconfigured' }) };
  const providers = names.map((n) => one(n, env));
  return providers.length === 1 ? providers[0]! : new ProviderChain(providers);
}
