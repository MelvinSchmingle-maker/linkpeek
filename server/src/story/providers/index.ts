/**
 * Picks the search provider from the environment.
 *
 *   STORY_SEARCH_PROVIDER = exa (default) | brave
 *   EXA_API_KEY / BRAVE_SEARCH_API_KEY = the provider's key (server only, never in the extension)
 *
 * A missing key gives a provider that answers "misconfigured", so the
 * extension can say Story Search isn't set up, rather than pretend.
 */
import { BraveProvider } from './brave.js';
import { ExaProvider } from './exa.js';
import type { SearchProvider } from './types.js';

export function searchProviderFor(env: Record<string, string | undefined>): SearchProvider {
  const name = (env.STORY_SEARCH_PROVIDER ?? 'exa').trim().toLowerCase();
  if (name === 'brave') return new BraveProvider(env.BRAVE_SEARCH_API_KEY?.trim() || undefined);
  if (name === 'exa') return new ExaProvider(env.EXA_API_KEY?.trim() || undefined);
  return { name, search: async () => ({ ok: false, code: 'misconfigured' }) };
}
