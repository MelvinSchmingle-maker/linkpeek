/**
 * Does a search result look like the same story as the link? A first,
 * rule-based pass, before the AI reads anything:
 *
 * - words: how many of the link's meaningful words the result shares;
 * - names: how many of the link's people and places it mentions;
 * - date: whether it was published near the link's date (or near the other
 *   best results, when the link has no date).
 *
 * Results with almost nothing in common are set aside without being sent to
 * the AI. The same scores later cap what the AI may say: a result can't be a
 * "strong match" if it shares almost no words with the link, names none of
 * the link's people, or dates from another time. So a similar-sounding older
 * story can't be presented as this one.
 */
import type { MatchStatus, StoryRequest } from './contract.js';
import type { SearchHit } from './providers/types.js';
import { coverage, daysBetween, names, termSet } from './text.js';

/** Below this, a result isn't worth the AI's time. */
export const MIN_CANDIDATE_SCORE = 0.12;
/** Below this, a result can never be a match at all. */
export const MIN_MATCH_SCORE = 0.15;
/** Results scoring this or more count as "found something" when deciding whether to search again. */
export const GOOD_SCORE = 0.35;
/** A result this many days before the link's date is about something earlier. */
const EARLIER_DAYS = 30;
/** Or this many days after it. */
const LATER_DAYS = 120;

export interface LinkProfile {
  terms: Set<string>;
  names: string[];
  date?: string;
}

export interface Scored {
  hit: SearchHit;
  score: number;
  wordShare: number;
  namesFound: number;
  /** How many of the link's multi-word names ("Jamie Rivers", "Grand Meridian Hotel") it mentions: usually people and organisations. */
  specificFound: number;
  /** The result dates from a different time than the link. */
  dateMismatch: boolean;
}

export function linkProfile(req: StoryRequest): LinkProfile {
  const main = [req.headline?.text, ...(req.altHeadlines ?? []).map((a) => a.text), req.description?.text, req.slug, req.selection]
    .filter(Boolean)
    .join(' ');
  // Nearby text is noisy: only its names count, not its words, unless there's nothing else.
  const wordsFrom = main || req.context?.text || '';
  const nameText = [req.headline?.text, ...(req.altHeadlines ?? []).map((a) => a.text), req.description?.text, req.context?.text, req.selection, ...(req.keywords ?? [])]
    .filter(Boolean)
    .join('. ');
  return {
    terms: termSet(`${wordsFrom} ${(req.keywords ?? []).join(' ')}`),
    names: names(nameText),
    ...(req.date ? { date: req.date } : {}),
  };
}

function hitText(h: SearchHit): string {
  return [h.title, h.description ?? '', ...h.passages].join(' ');
}

export function scoreHits(profile: LinkProfile, hits: SearchHit[]): Scored[] {
  const scored = hits.map((hit) => {
    const text = hitText(hit);
    const lower = text.toLowerCase();
    const wordShare = coverage(profile.terms, termSet(text));
    const found = profile.names.filter((n) => lower.includes(n.toLowerCase()));
    const namesFound = found.length;
    const specificFound = found.filter((n) => n.includes(' ')).length;
    const nameShare = profile.names.length ? namesFound / profile.names.length : undefined;
    const score = nameShare === undefined ? wordShare : 0.6 * wordShare + 0.4 * nameShare;
    return { hit, score, wordShare, namesFound, specificFound, dateMismatch: false };
  });
  // When the link has no date, the best results' dates stand in for it.
  const reference = profile.date ?? clusterDate(scored);
  if (reference) {
    for (const s of scored) {
      const d = s.hit.published ? daysBetween(reference, s.hit.published) : undefined;
      s.dateMismatch = d !== undefined && (d < -EARLIER_DAYS || d > LATER_DAYS);
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** The middle date of the three best-scoring dated results, if at least two have dates. */
function clusterDate(scored: Scored[]): string | undefined {
  const dates = [...scored]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score >= GOOD_SCORE && s.hit.published)
    .slice(0, 3)
    .map((s) => s.hit.published!)
    .sort();
  return dates.length >= 2 ? dates[Math.floor(dates.length / 2)] : undefined;
}

/** What the rules allow, whatever the AI says. Never raises the AI's verdict. */
export function capMatch(ai: MatchStatus, s: Scored, profile: LinkProfile): MatchStatus {
  if (ai === 'none' || s.score < MIN_MATCH_SCORE) return 'none';
  if (ai === 'strong') {
    if (s.dateMismatch) return 'possible';
    if (profile.names.length && s.namesFound === 0) return 'possible';
    // The link names someone specific: a result that doesn't mention them isn't clearly the same story.
    if (profile.names.some((n) => n.includes(' ')) && s.specificFound === 0) return 'possible';
    if (s.wordShare < 0.2 && s.namesFound === 0) return 'possible';
  }
  return ai;
}
