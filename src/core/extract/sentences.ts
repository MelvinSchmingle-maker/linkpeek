/** Picking sentences and short previews out of article text. */
import { wordCount } from '../detect/classify';

const MAX_SENTENCE_WORDS = 45;
const MIN_SENTENCE_WORDS = 6;

function sentences(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    return [...seg.segment(text)].map((s) => s.segment.trim()).filter(Boolean);
  }
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * The article's first real sentence: skips short fragments like bylines,
 * datelines and "Updated 3 hours ago". Over-long sentences are cut at a word
 * boundary and marked with "…" so nobody mistakes them for the whole thing.
 */
export function firstSentence(text: string): string {
  const all = sentences(text);
  const pick = all.find((s) => wordCount(s) >= MIN_SENTENCE_WORDS && !/^(by|updated|published|posted|last updated)\b/i.test(s)) ?? all[0] ?? '';
  return limitWords(pick, MAX_SENTENCE_WORDS);
}

/** At most n words, cut at a word boundary, with "…" when something was cut. */
export function limitWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length > n) return `${words.slice(0, n).join(' ').replace(/[,;:\s]+$/, '')}…`;
  const joined = words.join(' ');
  // Scripts without spaces (Chinese, Japanese, Thai) count as one "word" here: cap by length too.
  const maxChars = n * 7;
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}…` : joined;
}
