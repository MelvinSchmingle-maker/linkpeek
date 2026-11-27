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
  /** Every meaningful word the link's clues give. */
  terms: Set<string>;
  /** The words that say what the story is: the headline (or its other wordings and the selection). Shares are measured on these. */
  coreTerms: Set<string>;
  /** Every name in the clues. */
  names: string[];
  /**
   * Names in the headline, its other wordings or the selection: who or what
   * the story is about. Only these are required of a strong match. A detail
   * named only in the teaser ("Apollo Gallery") can raise a result's score
   * but not sink it: live testing found good reports whose extracts left it out.
   */
  keyNames: string[];
  date?: string;
}

export interface Scored {
  hit: SearchHit;
  score: number;
  wordShare: number;
  namesFound: number;
  /** How many of the link's key names (from the headline, its other wordings or the selection) it mentions. */
  keyFound: number;
  /** How many of the link's multi-word key names ("Jamie Rivers", "Grand Meridian Hotel") it mentions: usually people and organisations. */
  specificFound: number;
  /** The result dates from a different time than the link. */
  dateMismatch: boolean;
}

export function linkProfile(req: StoryRequest): LinkProfile {
  const core = [req.headline?.text, ...(req.altHeadlines ?? []).map((a) => a.text), req.selection].filter(Boolean).join(' ');
  const main = [core, req.description?.text, req.slug].filter(Boolean).join(' ');
  // Nearby text is noisy: only its names count, not its words, unless there's nothing else.
  const wordsFrom = main || req.context?.text || '';
  const nameText = [req.headline?.text, ...(req.altHeadlines ?? []).map((a) => a.text), req.description?.text, req.context?.text, req.selection, ...(req.keywords ?? [])]
    .filter(Boolean)
    .join('. ');
  const coreTerms = termSet(core);
  return {
    terms: termSet(`${wordsFrom} ${(req.keywords ?? []).join(' ')}`),
    // Without a headline of at least three words, every clue counts.
    coreTerms: coreTerms.size >= 3 ? coreTerms : termSet(`${wordsFrom} ${(req.keywords ?? []).join(' ')}`),
    names: names(nameText),
    keyNames: names([req.headline?.text, ...(req.altHeadlines ?? []).map((a) => a.text), req.selection].filter(Boolean).join('. ')),
    ...(req.date ? { date: req.date } : {}),
  };
}

function hitText(h: SearchHit): string {
  return [h.title, h.description ?? '', ...h.passages].join(' ');
}

/** For a link with no date: matching reporting from this recently means the link is most likely about that. */
const RECENT_DAYS = 30;

/**
 * `today` ("YYYY-MM-DD"): for a link with no date, if any close result is
 * from the last month, the newest close results set the reference date, so
 * this week's story about someone isn't set aside for an older one that
 * happens to match the wording better (D73). Without recent coverage, the
 * best results' dates set it, as before.
 */
export function scoreHits(profile: LinkProfile, hits: SearchHit[], today?: string): Scored[] {
  const scored = hits.map((hit) => {
    const text = hitText(hit);
    const lower = text.toLowerCase();
    const wordShare = coverage(profile.coreTerms, termSet(text));
    const has = (n: string) => lower.includes(n.toLowerCase());
    const namesFound = profile.names.filter(has).length;
    const keyFound = profile.keyNames.filter(has);
    const specificFound = keyFound.filter((n) => n.includes(' ')).length;
    const others = profile.names.filter((n) => !profile.keyNames.includes(n));
    let score = wordShare;
    // Names in the headline count fully, for and against.
    if (profile.keyNames.length) score = 0.6 * wordShare + 0.4 * (keyFound.length / profile.keyNames.length);
    // Names only in the teaser or nearby text can only help.
    else if (others.length) score = Math.max(wordShare, 0.6 * wordShare + 0.4 * (others.filter(has).length / others.length));
    return { hit, score, wordShare, namesFound, keyFound: keyFound.length, specificFound, dateMismatch: false };
  });
  // When the link has no date, recent close coverage stands in for it, or else the best results' dates.
  const reference = profile.date ?? recentDate(scored, today) ?? clusterDate(scored);
  if (reference) {
    for (const s of scored) {
      const d = s.hit.published ? daysBetween(reference, s.hit.published) : undefined;
      s.dateMismatch = d !== undefined && (d < -EARLIER_DAYS || d > LATER_DAYS);
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}

/** The newest close result's date, if it is from the last RECENT_DAYS. */
function recentDate(scored: Scored[], today: string | undefined): string | undefined {
  if (!today) return undefined;
  const recent = scored
    .filter((s) => s.score >= GOOD_SCORE && s.hit.published)
    .map((s) => s.hit.published!)
    .filter((d) => {
      const age = daysBetween(d, today);
      return age !== undefined && age >= -1 && age <= RECENT_DAYS;
    })
    .sort();
  return recent.pop();
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
    // A link that gives no name and no date can't be pinned to one story: "Pop star found dead in hotel room"
    // fits many (live testing returned Whitney Houston's death in 2012). At best a possible match.
    if (!profile.names.length && !profile.date) return 'possible';
    // The link says who or what the story is about, and the result mentions none of it. Only the headline's
    // names count here: a detail named only in the teaser ("Apollo Gallery") is often missing from good
    // reports' extracts (seen live with the Louvre card, where it capped France 24, AP and Reuters).
    if (profile.keyNames.length && s.keyFound === 0) return 'possible';
    // The headline names someone specific: a result that doesn't mention them isn't clearly the same story.
    if (profile.keyNames.some((n) => n.includes(' ')) && s.specificFound === 0) return 'possible';
    if (s.wordShare < 0.2 && s.namesFound === 0) return 'possible';
  }
  return ai;
}
