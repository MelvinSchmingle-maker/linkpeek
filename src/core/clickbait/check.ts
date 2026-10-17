/**
 * The headline check: tick, cross or neutral, with one reason. It's pure, so
 * the rules can be tested without a browser.
 *
 * - Cross ("fail"): a specific pattern with enough evidence. The reason names it.
 * - Tick ("pass"): only with the full article, and only when a figure in the
 *   headline also appears in the article. The reason says which figure.
 * - Neutral ("unknown"): everything else. It's the default, and with the full
 *   article it carries no reason: "No headline verdict" is the whole message.
 *
 * Who can be crossed on what:
 * - Without the full article, only a strong withheld-fact pattern can cross.
 *   Overstated claims, figures and dates need the article to check.
 * - A plainer headline (rewrite) appears only with the full article and only
 *   on a cross. It's shown in the card, never in place of the headline.
 *
 * A cross means the headline is written to bait a click or says more than the
 * article does. It does not mean the story is false, and a tick does not mean
 * the story is true.
 */
import { countWords } from '../summary/wordcount';
import { trimAtClause } from '../summary/enforce';
import type { ContentFacts, EvidenceLevel, Figure, HeadlineCheck } from '../types';
import { extractFigures, figureMatches, LIMIT_DESCRIPTION, type ReadFigure } from './content';
import { headlineSignals } from './rules';

/** The rewrite's length limit. Shorter than a summary on purpose. */
export const REWRITE_WORDS = 15;

/** An article this old, with no later update, can't be presented as happening now. */
const STALE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Words that state a result more strongly than a study usually can. */
const CERTAIN = /\b(cures?|cured|proves?|proven|kills?|killed|destroys?|guarantees?|reverses?|eliminates?)\b|\bstops? (?:flu|cancer|covid|disease|the virus|ageing|aging)\b/i;

/** Words that already hedge a claim. A hedged headline isn't overstated. */
const HEDGED = /\b(may|might|could|can|possibly|potentially|suggests?|linked|helps?|tied|early|preliminary)\b/i;

/** Words that present a story as current. */
const RECENT = /\b(today|tonight|this morning|this afternoon|this evening|just in|breaking|happening now|right now)\b/i;

/** Reason texts. Fixed wording, so nothing from a page reaches the card unchecked. */
export const REASON = {
  withheld: 'The headline holds back its main point to make you click.',
  overstated: (term: string, limit: string) => `The headline says "${term}", but the article describes ${limit}.`,
  figure: (raw: string) => `The headline gives ${raw}, but none of the article's figures match it.`,
  stale: (date: string) => `The headline presents this as happening now, but the article is dated ${date}.`,
  pass: (raw: string) => `The headline's figure, ${raw}, appears in the article.`,
  vagueNoArticle: 'The headline appears vague. The article could not be retrieved, so the content comparison is unavailable.',
  vaguePartial: 'The headline appears vague. The article could not be read in full, so the content comparison is unavailable.',
};

export interface HeadlineInput {
  headline: string;
  evidence: EvidenceLevel;
  /** From the full article, when there is one. */
  facts?: ContentFacts;
  /** Dates from the page, as the page gave them. */
  published?: string;
  modified?: string;
  /** The article's 20-word summary. Becomes the rewrite, cut to 15 words. */
  summary?: string;
  /** Today, in milliseconds. Defaults to now. */
  now?: number;
}

export function checkHeadline(input: HeadlineInput): HeadlineCheck {
  const signals = headlineSignals(input.headline);
  const withheld = signals.some((s) => s.strength === 'strong');

  if (input.evidence !== 'full') {
    if (withheld) return fail(REASON.withheld);
    if (signals.length > 0) {
      return { verdict: 'unknown', reason: input.evidence === 'partial' ? REASON.vaguePartial : REASON.vagueNoArticle };
    }
    return { verdict: 'unknown' };
  }

  // Full evidence, but facts can be missing for a result remembered from before they were kept.
  const facts: ContentFacts = input.facts ?? { limits: [], figures: [] };
  const headlineFigures = extractFigures(input.headline);

  if (withheld) return failWithRewrite(REASON.withheld, input, { revealsWithheld: true });

  const overstated = overstatedReason(input.headline, facts);
  if (overstated) return failWithRewrite(overstated, input);

  const figure = figureMismatch(headlineFigures, facts.figures);
  if (figure) return failWithRewrite(figure, input);

  const stale = staleReason(input);
  if (stale) return failWithRewrite(stale, input);

  const matched = headlineFigures.find((h) => facts.figures.some((f) => figureMatches(h, f)));
  if (matched) return { verdict: 'pass', reason: REASON.pass(matched.raw) };

  return { verdict: 'unknown' };
}

function fail(reason: string): HeadlineCheck {
  return { verdict: 'fail', reason };
}

function failWithRewrite(reason: string, input: HeadlineInput, extra: { revealsWithheld?: boolean } = {}): HeadlineCheck {
  const rewrite = rewriteFrom(input.summary, input.headline);
  if (!rewrite) return fail(reason);
  return { verdict: 'fail', reason, rewrite, ...(extra.revealsWithheld ? { revealsWithheld: true } : {}) };
}

/** A plainer headline from the article: the summary, cut to 15 words, never the headline again. */
export function rewriteFrom(summary: string | undefined, headline: string): string | undefined {
  if (!summary?.trim()) return undefined;
  const text = countWords(summary) <= REWRITE_WORDS ? summary.replace(/\s+/g, ' ').trim() : trimAtClause(summary, REWRITE_WORDS);
  if (!text || text.toLowerCase() === headline.trim().toLowerCase()) return undefined;
  return text;
}

/** A certain-sounding claim, when the article states a limit on its study. */
function overstatedReason(headline: string, facts: ContentFacts): string | undefined {
  const term = CERTAIN.exec(headline)?.[0];
  const limit = facts.limits[0];
  if (!term || !limit || HEDGED.test(headline)) return undefined;
  return REASON.overstated(term.toLowerCase(), LIMIT_DESCRIPTION[limit]);
}

/**
 * A figure in the headline that the article doesn't contain. Only judged when
 * the article has at least three figures of the same kind, so a short article
 * with one or two numbers can't cross on a figure.
 */
function figureMismatch(headlineFigures: ReadFigure[], articleFigures: Figure[]): string | undefined {
  for (const h of headlineFigures) {
    const same = articleFigures.filter((f) => f.unit === h.unit);
    if (same.length < 3) continue;
    if (same.some((f) => figureMatches(h, f))) continue;
    return REASON.figure(h.raw);
  }
  return undefined;
}

/** "Breaking" or "happening now" on an article that is old and hasn't been updated. */
function staleReason(input: HeadlineInput): string | undefined {
  if (!RECENT.test(input.headline)) return undefined;
  const now = input.now ?? Date.now();
  const times = [input.published, input.modified].map(parseDate).filter((t): t is number => t !== undefined);
  if (times.length === 0) return undefined;
  if (now - Math.max(...times) < STALE_DAYS * DAY_MS) return undefined;
  const shown = parseDate(input.published) ?? Math.min(...times);
  return REASON.stale(new Date(shown).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
}
