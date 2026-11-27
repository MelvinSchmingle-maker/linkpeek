/**
 * Search queries from what the extension found about a link.
 *
 * One well-built search runs first: the headline (or, without one, the best
 * description of the story) plus the names that pin it down. The other
 * queries here are only used when that first search doesn't find enough
 * (investigate.ts decides), each aimed at what was missing: the named person,
 * the right date, or other outlets. Near-duplicates are dropped, so no search
 * is paid for twice.
 */
import type { StoryRequest } from './contract.js';
import { clip, jaccard, names, termSet, terms, words } from './text.js';

export type QueryPurpose =
  /** The first search: everything that identifies the story, in one query. */
  | 'best'
  | 'exact-headline'
  | 'headline-keywords'
  | 'names-and-event'
  | 'names-event-date'
  | 'alternative-headline'
  | 'description'
  | 'address-words'
  | 'nearby-text'
  | 'selection'
  /** The first search again, aimed at sites not already found. */
  | 'other-outlets'
  /** The first search again, without the news-only filter. */
  | 'broader';

export interface SearchQuery {
  text: string;
  purpose: QueryPurpose;
  /** Search for this exact wording, where the provider supports it. */
  exact?: boolean;
  /** Prefer news results. Broader follow-ups search everything, so official sources can turn up. */
  news: boolean;
}

export interface QueryPlan {
  /** The one search that runs first. Undefined when there is nothing to search for. */
  first?: SearchQuery;
  /** Other searches, used only when the first finds too little. Each purpose at most once. */
  followUps: SearchQuery[];
  /** Shown to the user as "Searched for". */
  main: string;
}

const MAX_QUERY_CHARS = 200;
const MAX_KEYWORDS = 9;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function firstSentence(text: string): string {
  return (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();
}

/** The most useful words of a text, in their original order, stopwords dropped. */
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

/** "November 2026" from "2026-11-24" or "2026-11". */
function monthYear(date: string | undefined): string | undefined {
  const m = date?.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : undefined;
}

/**
 * `exactPhrases`: whether the provider honours exact-wording searches (Brave
 * does). Exa and Tavily search by meaning, so for them a headline and its key
 * words are the same search; the first search is then the headline in plain
 * words plus the names that pin the story down.
 */
export function buildQueries(req: StoryRequest, { exactPhrases = true }: { exactPhrases?: boolean } = {}): QueryPlan {
  const all: SearchQuery[] = [];
  const add = (text: string | undefined, purpose: QueryPurpose, opts: { exact?: boolean; news?: boolean } = {}): SearchQuery | undefined => {
    const t = clip((text ?? '').replace(/["“”]/g, ''), MAX_QUERY_CHARS).replace(/…$/, '');
    if (terms(t).length < 2) return undefined;
    const exact = Boolean(opts.exact && exactPhrases);
    const q: SearchQuery = { text: t, purpose, news: opts.news ?? true, ...(exact ? { exact: true } : {}) };
    // With exact wording, the exact query and its keyword version are different searches.
    // Otherwise every query must differ in its words (or in being news-only).
    const same = (o: SearchQuery) => o.news === q.news && (!exactPhrases || Boolean(o.exact) === exact) && jaccard(termSet(o.text), termSet(q.text)) >= 0.8;
    if (all.some(same)) return undefined;
    all.push(q);
    return q;
  };

  const headline = req.headline?.text;
  const strongHeadline = headline && req.headline?.confidence !== 'low' ? headline : undefined;
  const alt = req.altHeadlines?.map((a) => a.text) ?? [];
  const description = req.description ? firstSentence(req.description.text) : undefined;
  const selection = req.selection ? firstSentence(req.selection) : undefined;
  const slug = req.slug && !req.shortened ? req.slug : undefined;
  const everything = [headline, ...alt, req.description?.text, req.context?.text, req.selection, ...(req.keywords ?? [])].filter(Boolean).join('. ');
  const people = names(everything);
  const event = keywords([strongHeadline ?? headline ?? '', description ?? '', slug ?? ''].join(' '), 5);

  // 1. The first search: the story's best description, plus names it doesn't already mention.
  const base = strongHeadline ?? alt[0] ?? description ?? selection ?? headline ?? slug ?? (req.context ? keywords(req.context.text) : undefined);
  let first: SearchQuery | undefined;
  if (base) {
    const missing = people.filter((n) => !base.toLowerCase().includes(n.toLowerCase())).slice(0, 3);
    const n = words(base).length;
    if (exactPhrases && strongHeadline && n >= 4 && n <= 14) first = add(strongHeadline, 'best', { exact: true });
    else first = add(exactPhrases ? keywords(`${base} ${missing.join(' ')}`, 12) : `${base} ${missing.join(' ')}`.trim(), 'best');
  }

  // 2. Follow-ups, only used when the first search finds too little.
  if (strongHeadline) add(keywords(strongHeadline), 'headline-keywords');
  if (people.length) {
    add(keywords(`${people.slice(0, 3).join(' ')} ${event}`), 'names-and-event');
    const when = monthYear(req.date);
    if (when) add(`${keywords(`${people.slice(0, 3).join(' ')} ${event}`, 7)} ${when}`, 'names-event-date');
  }
  for (const a of alt) add(keywords(a), 'alternative-headline');
  if (description) add(keywords(description), 'description');
  if (slug) add(keywords(slug), 'address-words');
  if (selection) add(keywords(selection), 'selection');
  if (req.context) add(keywords(req.context.text), 'nearby-text');
  if (first) {
    // Same words as the first search, as different searches: other sites, or not news only.
    all.push({ ...first, purpose: 'other-outlets' });
    all.push({ ...first, purpose: 'broader', news: false });
  }

  const seen = new Set<QueryPurpose>(['best']);
  const followUps = all.filter((q) => q !== first && !seen.has(q.purpose) && Boolean(seen.add(q.purpose)));
  return { ...(first ? { first } : {}), followUps, main: first?.text ?? '' };
}
