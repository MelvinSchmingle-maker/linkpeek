/**
 * Stage 2 of the headline check: what the article says, reduced to facts the
 * check can compare with the headline. Pure: no DOM, no network.
 *
 * What's kept is deliberately small: which study limits the article states
 * (from a fixed list of labels) and the money and percentage figures in it, as
 * plain numbers. Nothing here keeps the article's own words, so these facts
 * can be remembered with a result.
 *
 * Figures are matched on digits ("18%", "£1.2bn", "20p") and on number words
 * before "per cent" or "percent" ("three per cent"). Other number words are
 * not read, so a figure written only in words is missed. That's the safe side:
 * a missed figure can only make a cross less likely.
 */
import type { ContentFacts, Figure, StudyLimit } from '../types';

/** The most figures kept per article. More than this is a data table, not a story. */
const MAX_FIGURES = 60;

/** How each study limit reads in a reason. Fixed text: nothing from the article. */
export const LIMIT_DESCRIPTION: Record<StudyLimit, string> = {
  animal: 'a study in animals',
  lab: 'lab tests',
  small: 'a small study',
  early: 'early results',
  observational: 'an observational study',
  further: 'results that still need more testing',
};

/** Checked in this order: the first one the article states is the one given in a reason. */
export const LIMIT_ORDER: StudyLimit[] = ['animal', 'lab', 'small', 'early', 'observational', 'further'];

const LIMIT_PATTERNS: Record<StudyLimit, RegExp> = {
  animal: /\bin (?:mice|rats|monkeys|pigs|dogs|zebrafish|fruit flies|worms)\b|\bon (?:mice|rats)\b/i,
  lab: /\bin (?:the )?lab(?:oratory)?\b|\blaborator(?:y|ies) tests?\b|\blab tests?\b|\bin vitro\b|\bcell cultures?\b|\bpetri dish/i,
  small: /\bsmall (?:study|trial|sample|group|pilot)\b|\bpilot (?:study|trial)\b|\bsample was small\b/i,
  early:
    /\bpreliminary\b|\bearly[- ]stage\b|\bearly results?\b|\bnot (?:yet )?(?:been )?tested in (?:humans|people)\b|\b(?:testing in humans|human trials?) (?:has|have) not (?:yet )?started\b/i,
  observational: /\bobservational\b|\bcannot show cause\b|\bcan(?:not|'t) prove cause\b/i,
  further:
    /\b(?:more|further|larger|bigger) (?:research|work|studies|study|trials|testing|evidence)\b|\bneed(?:s|ed)? (?:confirming|repeating|replicating|confirmation)\b|\btrials? (?:are|is) (?:still )?needed\b/i,
};

const SCALES: Record<string, number> = { bn: 1e9, billion: 1e9, m: 1e6, million: 1e6, k: 1e3, thousand: 1e3 };

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MONEY_SYMBOL = /([£$€])\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(bn|billion|m|million|k|thousand)\b)?/gi;
const MONEY_WORDS = /\b(\d[\d,]*(?:\.\d+)?)\s?(bn|billion|m|million|k|thousand)?\s(?:pounds|dollars|euros)\b/gi;
const PENCE = /\b(\d+(?:\.\d+)?)p\b/gi;
const PERCENT_DIGITS = /\b(\d[\d,]*(?:\.\d+)?)\s?(?:%|per ?cent\b|percent\b)/gi;
const PERCENT_WORDS =
  /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](?:one|two|three|four|five|six|seven|eight|nine)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s(?:per ?cent|percent)\b/gi;

/** A figure with the text it came from, for a reason shown to the user. */
export interface ReadFigure extends Figure {
  raw: string;
}

/** Every money and percentage figure in a text, in the order they appear. */
export function extractFigures(text: string): ReadFigure[] {
  const found: ReadFigure[] = [];
  for (const m of text.matchAll(MONEY_SYMBOL)) {
    found.push({ unit: 'money', value: scaled(m[2] ?? '', m[3]), raw: m[0] });
  }
  for (const m of text.matchAll(MONEY_WORDS)) {
    found.push({ unit: 'money', value: scaled(m[1] ?? '', m[2]), raw: m[0] });
  }
  for (const m of text.matchAll(PENCE)) {
    found.push({ unit: 'money', value: Number(m[1] ?? '') / 100, raw: m[0] });
  }
  for (const m of text.matchAll(PERCENT_DIGITS)) {
    found.push({ unit: 'percent', value: Number((m[1] ?? '').replace(/,/g, '')), raw: m[0] });
  }
  for (const m of text.matchAll(PERCENT_WORDS)) {
    const value = wordNumber(m[1] ?? '');
    if (value !== undefined) found.push({ unit: 'percent', value, raw: m[0] });
  }
  return found.filter((f) => Number.isFinite(f.value));
}

/** The article's study limits and figures, for a later headline check. */
export function contentFacts(paragraphs: string[]): ContentFacts {
  const text = paragraphs.join(' ');
  const limits = LIMIT_ORDER.filter((limit) => LIMIT_PATTERNS[limit].test(text));
  const seen = new Set<string>();
  const figures: Figure[] = [];
  for (const { unit, value } of extractFigures(text)) {
    const key = `${unit}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    figures.push({ unit, value });
    if (figures.length === MAX_FIGURES) break;
  }
  return { limits, figures };
}

/**
 * Whether two figures are the same amount. Percentages must agree to within
 * half a point. Money within 0.5%, so £1.2bn and £1,200m match.
 */
export function figureMatches(a: Figure, b: Figure): boolean {
  if (a.unit !== b.unit) return false;
  if (a.unit === 'percent') return Math.abs(a.value - b.value) < 0.5;
  return Math.abs(a.value - b.value) <= Math.max(0.005 * Math.abs(a.value), 0.001);
}

function scaled(number: string, scale: string | undefined): number {
  const base = Number(number.replace(/,/g, ''));
  return scale ? base * (SCALES[scale.toLowerCase()] ?? 1) : base;
}

/** "three" -> 3, "twenty-five" -> 25. */
function wordNumber(phrase: string): number | undefined {
  const parts = phrase.toLowerCase().split(/[- ]/);
  let total = 0;
  for (const part of parts) {
    const value = WORD_NUMBERS[part];
    if (value === undefined) return undefined;
    total += value;
  }
  return total;
}
