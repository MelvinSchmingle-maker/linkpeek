/**
 * Summaries that would waste the reader's time are rejected, so the provider
 * can try something else: filler openers ("This article discusses..."),
 * the headline repeated back, questions, and fragments too short to say
 * anything.
 */
import { countWords } from './wordcount';

export type QualityProblem = 'filler-opener' | 'repeats-headline' | 'question' | 'too-short';

/** Fewer words than this can't say what an article reports. */
export const MIN_SUMMARY_WORDS = 5;

const FILLER =
  /^(?:(?:this|the) (?:article|piece|story|post|report|blog post|essay|page|video|guide|explainer) (?:discusses|explores|examines|looks at|describes|explains|covers|is about|talks about|reports on|details|highlights|outlines|tells)\b|in (?:this|the following|today's) (?:article|piece|story|post|report|video|guide)\b|the (?:author|writer|journalist|reporter)s? (?:explores?|discuss(?:es)?|examines?|argues?|explains?|describes?|looks? at|reflects? on)\b|here(?:'s| is) (?:what|why|how|everything)\b|(?:read|find out|learn|discover) (?:more|about|how|why|what)\b|(?:click|tap) )/i;

export function qualityProblem(summary: string, headline: string): QualityProblem | undefined {
  const s = summary.trim();
  if (FILLER.test(s.replace(/^["'“‘]/, ''))) return 'filler-opener';
  if (/\?["'”’)]*$/.test(s)) return 'question';
  if (countWords(s) < MIN_SUMMARY_WORDS) return 'too-short';
  if (repeatsHeadline(s, headline)) return 'repeats-headline';
  return undefined;
}

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The headline word for word, or the headline with a word or two either side. */
function repeatsHeadline(summary: string, headline: string): boolean {
  const s = norm(summary);
  const h = norm(headline);
  if (!h || countWords(h) < 3) return false;
  if (s === h) return true;
  return s.includes(h) && countWords(s) - countWords(h) <= 2;
}
