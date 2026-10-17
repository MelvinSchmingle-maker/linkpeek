/**
 * The hard limit: a summary is 20 words or fewer, or it isn't shown.
 *
 * Under the limit, it passes as it is. Over it, the provider may be asked once
 * to shorten it. If that's still over (or there's no way to ask), it is cut at
 * the last clause boundary (a comma, semicolon, "and" or "but") that leaves a
 * complete sentence; failing that, just before a dependent clause ("after...",
 * "which...", "with..."). It is never cut mid-phrase and never gets "...". If
 * nothing works, the result is a failure, and the card shows something else.
 */
import { countWords } from './wordcount';

export const MAX_SUMMARY_WORDS = 20;

/** A cut that leaves fewer words than this isn't a sentence worth showing. */
const MIN_CLAUSE_WORDS = 6;

export type EnforceResult =
  | { ok: true; text: string; wordCount: number; how: 'as-is' | 'shortened' | 'trimmed' }
  | { ok: false; reason: 'empty' | 'over-limit' };

export interface EnforceOptions {
  max?: number;
  /** Ask the provider to shorten its own text. Called at most once. */
  shorten?: (text: string, max: number) => Promise<string | undefined>;
}

export async function enforceLimit(text: string, { max = MAX_SUMMARY_WORDS, shorten }: EnforceOptions = {}): Promise<EnforceResult> {
  let candidate = tidy(text);
  if (!candidate) return { ok: false, reason: 'empty' };
  if (countWords(candidate) <= max) return { ok: true, text: candidate, wordCount: countWords(candidate), how: 'as-is' };

  if (shorten) {
    let shorter = '';
    try {
      shorter = tidy((await shorten(candidate, max)) ?? '');
    } catch {
      // The provider couldn't shorten it. Fall through to trimming the original.
    }
    if (shorter && countWords(shorter) <= max) return { ok: true, text: shorter, wordCount: countWords(shorter), how: 'shortened' };
    // Trim whichever version is shorter: a shortened attempt that's still a
    // little over is usually closer to fitting.
    if (shorter && countWords(shorter) < countWords(candidate)) candidate = shorter;
  }

  const cut = trimAtClause(candidate, max);
  if (cut) return { ok: true, text: cut, wordCount: countWords(cut), how: 'trimmed' };
  return { ok: false, reason: 'over-limit' };
}

/** Whitespace collapsed, ends trimmed. Nothing else is changed. */
function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Words a sentence can't end on: cutting after one of these leaves a fragment. */
const DANGLING = new Set(
  (
    'a an the of to in on at for with by from into onto over under about as than that which who whom whose where when while ' +
    'because if though although unless until after before since and but or nor so yet its their his her our your my this these ' +
    'those is are was were be been being has have had will would can could should may might must not no very more most such'
  ).split(' '),
);

/**
 * Openers that make the first part of a sentence a lead-in, not a sentence
 * ("After the vote on Tuesday, ..."). Plain prepositions ("In March the
 * council...") are left out: those sentences are usually complete.
 */
const LEAD_IN = /^(after|before|when|whenever|while|whilst|if|although|though|because|since|despite|following|according|as|during|without|until|unless|once)\b/i;

/** A comma or semicolon (not the one inside "1,000"), "and" or "but". */
const CLAUSE_BOUNDARY = /[,;](?=\s)|\s(?=(?:and|but)\s)/gi;
/**
 * Just before a word that starts a dependent clause or a trailing detail
 * ("...for a year | after an inspection found corrosion"): what comes
 * before is usually a whole sentence.
 */
const DEPENDENT_START =
  /\s(?=(?:after|before|when|while|whilst|because|as|since|until|unless|although|though|with|without|following|despite|amid|which|who|whose|where|that|in a|over a|from a)\s)/gi;
/** Words that start a clause. An "and" or a comma after one of these is inside that clause ("as energy and packaging costs rose"). */
const CLAUSE_WORD = /\b(?:as|because|after|before|when|while|whilst|since|until|if|although|though|which|who|whom|whose|that|between|both|whether)\b/i;
/** Verbs that report: cutting before their "that" leaves them without an object ("The study suggests."). */
const REPORTING =
  /\b(?:say|says|said|suggest|suggests|suggested|find|finds|found|show|shows|showed|shown|claim|claims|claimed|believe|believes|believed|think|thinks|thought|mean|means|meant|argue|argues|argued|warn|warns|warned|report|reports|reported|announce|announces|announced|confirm|confirms|confirmed|admit|admits|admitted|add|adds|added|insist|insists|insisted|reveal|reveals|revealed|know|knew|hope|hopes|hoped|expect|expects|expected|fear|fears|feared|agree|agrees|agreed|rule|rules|ruled|decide|decides|decided|accept|accepts|accepted|deny|denies|denied|so|such|now|clear|sure|likely|possible)$/i;
const PREPOSITION = /^(?:at|in|on|for|to|by|with|of|from|over|into|about)$/i;
/** Words that start a lead-in rather than a subject. */
const OPENER =
  /^(?:in|on|at|by|for|from|with|without|after|before|during|since|until|under|over|despite|following|according|as|when|while|if|although|though|because|once|yesterday|today|tonight|now|however|meanwhile|last|this|next|earlier|later|separately|overall|instead|still|also|finally|first|then)\b/i;

interface Cut {
  at: number;
  kind: 'clause' | 'dependent';
}

/**
 * Cuts text at a clause boundary so that what's left is a complete sentence
 * of at most `max` words, ending with a full stop. Of the cuts that work, the
 * one that keeps the most words wins. Returns undefined if none works.
 */
export function trimAtClause(text: string, max = MAX_SUMMARY_WORDS): string | undefined {
  const cuts: Cut[] = [
    ...[...text.matchAll(CLAUSE_BOUNDARY)].map((m) => ({ at: m.index, kind: 'clause' as const })),
    ...[...text.matchAll(DEPENDENT_START)].map((m) => ({ at: m.index, kind: 'dependent' as const })),
  ];
  let best: { prefix: string; words: number } | undefined;
  for (const cut of cuts) {
    const prefix = text.slice(0, cut.at).trim().replace(/[,;:]+$/, '');
    const n = countWords(prefix);
    if (n > max || n < MIN_CLAUSE_WORDS || (best && n <= best.words)) continue;
    if (!looksComplete(prefix) || endsOnShortFragment(prefix)) continue;
    if (cut.kind === 'clause' && splitsAClause(prefix, text.slice(cut.at))) continue;
    if (cut.kind === 'dependent' && /^\s*that\s/i.test(text.slice(cut.at)) && !thatCutWorks(prefix)) continue;
    best = { prefix, words: n };
  }
  if (!best) return undefined;
  return /[.!?]$/.test(best.prefix) ? best.prefix : `${best.prefix}.`;
}

/** The last stretch after a comma, e.g. "packaging" in "energy, packaging". The comma in "1,000" doesn't count. */
function lastSegment(prefix: string): string {
  const marks = [...prefix.matchAll(/[,;]\s/g)];
  const last = marks[marks.length - 1];
  return (last ? prefix.slice(last.index + 1) : prefix).trim();
}

/** A comma-separated stretch of three words or fewer at the end is a list item or a fragment ("roads, bridges", "reading, two years"). */
function endsOnShortFragment(prefix: string): boolean {
  return /[,;]\s/.test(prefix) && countWords(lastSegment(prefix)) <= 3;
}

/**
 * A comma or "and" in the middle of something: a clause that hasn't finished
 * ("as energy | and packaging costs rose"), a range ("between 2022 | and
 * 2024", "4 | and 11 November"), or a list ("roads, bridges | and schools").
 */
function splitsAClause(prefix: string, rest: string): boolean {
  const tail = lastSegment(prefix);
  if (CLAUSE_WORD.test(tail) && !/^(?:which|who|whose|where|that|as|after|when|while|because|since|although|though)\b/i.test(tail)) return true;
  const before = prefix.match(/(\S+)$/)?.[1] ?? '';
  const after = rest.replace(/^[,;]?\s*(?:and|but)?\s*/i, '').match(/^(\S+)/)?.[1] ?? '';
  return /^\p{N}/u.test(before) && /^\p{N}/u.test(after);
}

/** "...charges over community grants | that prosecutors say..." works; "suggests | that..." and "at prices | that..." don't. */
function thatCutWorks(prefix: string): boolean {
  const ws = prefix.split(/\s+/);
  const last = ws[ws.length - 1] ?? '';
  const secondLast = ws[ws.length - 2] ?? '';
  // "...so often | that nobody could say": "so" and "such" need their "that".
  if (ws.slice(-3).some((w) => /^(?:so|such)$/i.test(w))) return false;
  return !REPORTING.test(last) && !PREPOSITION.test(secondLast);
}

function looksComplete(prefix: string): boolean {
  const last = (prefix.match(/[\p{L}\p{N}'’]+$/u)?.[0] ?? '').toLowerCase();
  if (!last || DANGLING.has(last)) return false;
  // Quotes and brackets must be closed.
  if ((prefix.match(/"/g) ?? []).length % 2 !== 0) return false;
  if ((prefix.match(/“/g) ?? []).length !== (prefix.match(/”/g) ?? []).length) return false;
  if ((prefix.match(/\(/g) ?? []).length !== (prefix.match(/\)/g) ?? []).length) return false;
  // "After the vote on Tuesday" alone is a lead-in, not a sentence.
  if (LEAD_IN.test(prefix) && !/[,;]/.test(prefix)) return false;
  // "The Granary, which opened in September", "Valley Foods, the maker of
  // ready meals", "The terrier, also called the mill dog": a short subject
  // and an aside, with no main verb yet. A short lead-in ("In 2021, I...",
  // "Yesterday, the council...") is different: the main clause follows it.
  const parts = prefix.split(/[,;]\s/);
  if (parts.length === 2 && countWords(parts[0]!) <= 5 && !OPENER.test(parts[0]!) && !/^(?:i|he|she|it|we|they|you)\b/i.test(parts[1]!)) {
    return false;
  }
  return true;
}
