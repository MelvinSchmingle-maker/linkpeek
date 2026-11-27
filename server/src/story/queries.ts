/**
 * Search queries from what the extension found about a link.
 *
 * Publishers word the same story differently ("Popstar found dead in hotel",
 * "Police investigate death of music superstar"), so one query isn't enough.
 * The first two or three run straight away; the rest only when those find
 * little. Near-duplicates are dropped, so no search is paid for twice.
 */
import type { StoryRequest } from './contract.js';
import { clip, jaccard, names, termSet, terms, words } from './text.js';

export type QueryPurpose =
  | 'exact-headline'
  | 'headline'
  | 'headline-keywords'
  | 'names-and-event'
  | 'alternative-headline'
  | 'description'
  | 'address-words'
  | 'nearby-text'
  | 'selection';

export interface SearchQuery {
  text: string;
  purpose: QueryPurpose;
  /** Search for this exact wording, where the provider supports it. */
  exact?: boolean;
  /** Prefer news results. The broader expansion queries search everything, so official sources can turn up. */
  news: boolean;
}

export interface QueryPlan {
  initial: SearchQuery[];
  expansion: SearchQuery[];
  /** Shown to the user as "Searched for". */
  main: string;
}

const MAX_QUERY_CHARS = 200;
const MAX_KEYWORDS = 9;

function firstSentence(text: string): string {
  return (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();
}

/** The most useful words of a text, in their original order: names first kept, stopwords dropped. */
function keywords(text: string, max = MAX_KEYWORDS): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words(text)) {
    const [t] = terms(w);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(w);
    if (out.length >= max) break;
  }
  return out.join(' ');
}

/**
 * `exactPhrases`: whether the provider honours exact-wording searches. Exa
 * and Tavily search by meaning, so for them the headline and its key words
 * are the same search, and only one is sent.
 */
export function buildQueries(req: StoryRequest, { exactPhrases = true }: { exactPhrases?: boolean } = {}): QueryPlan {
  const all: SearchQuery[] = [];
  const add = (text: string | undefined, purpose: QueryPurpose, opts: { exact?: boolean; news?: boolean } = {}) => {
    const t = clip((text ?? '').replace(/["“”]/g, ''), MAX_QUERY_CHARS).replace(/…$/, '');
    if (terms(t).length < 2) return;
    const exact = Boolean(opts.exact && exactPhrases);
    const q: SearchQuery = { text: t, purpose: opts.exact && !exactPhrases ? 'headline' : purpose, news: opts.news ?? true, ...(exact ? { exact: true } : {}) };
    // With exact wording, the exact query and its keyword version are different searches.
    // Otherwise every query must differ in its words.
    if (all.some((o) => (!exactPhrases || Boolean(o.exact) === exact) && jaccard(termSet(o.text), termSet(q.text)) >= 0.8)) return;
    all.push(q);
  };

  const headline = req.headline?.text;
  const strongHeadline = headline && req.headline?.confidence !== 'low' ? headline : undefined;
  const alt = req.altHeadlines?.map((a) => a.text) ?? [];
  const description = req.description ? firstSentence(req.description.text) : undefined;
  const everything = [headline, ...alt, req.description?.text, req.context?.text, req.selection, ...(req.keywords ?? [])].filter(Boolean).join('. ');
  const people = names(everything);

  // 1. The headline as written, then its key words.
  if (strongHeadline) {
    const n = words(strongHeadline).length;
    if (n >= 4 && n <= 14) add(strongHeadline, 'exact-headline', { exact: true });
    add(keywords(strongHeadline), 'headline-keywords');
  }
  // 2. Names with what happened: "Jamie Rivers Paris hotel death".
  if (people.length) {
    const event = keywords([strongHeadline ?? '', description ?? '', req.slug ?? ''].join(' '), 5);
    add(keywords(`${people.slice(0, 3).join(' ')} ${event}`), 'names-and-event');
  }
  // 3. Without a good headline: the description, the address's words, the selection, the nearby text.
  if (!strongHeadline) {
    if (headline) add(keywords(headline), 'headline-keywords');
    if (description) add(keywords(description), 'description');
    if (req.slug && !req.shortened) add(keywords(req.slug), 'address-words');
    if (req.selection) add(keywords(firstSentence(req.selection)), 'selection');
    if (req.context) add(keywords(req.context.text), 'nearby-text');
  }
  const initialCount = strongHeadline ? Math.min(all.length, people.length ? 3 : 2) : Math.min(all.length, 3);

  // Expansion: other wordings, searched more broadly.
  for (const a of alt) add(keywords(a), 'alternative-headline', { news: false });
  if (description) add(keywords(description), 'description', { news: false });
  if (req.slug && !req.shortened) add(keywords(req.slug), 'address-words', { news: false });
  if (req.selection) add(keywords(firstSentence(req.selection)), 'selection', { news: false });
  if (req.context) add(keywords(req.context.text), 'nearby-text', { news: false });

  const initial = all.slice(0, initialCount);
  return {
    initial,
    expansion: all.slice(initialCount, initialCount + 2),
    main: initial[0]?.text ?? '',
  };
}
