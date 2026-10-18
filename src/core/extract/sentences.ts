/** Picking sentences and short previews out of article text. */
import { wordCount } from '../detect/classify';

const MAX_SENTENCE_WORDS = 45;
const MIN_SENTENCE_WORDS = 6;

/** Splits text into sentences (the browser's own sentence rules where available). */
export function sentences(text: string): string[] {
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
  const all = sentences(text).map(afterAbstract);
  const pick =
    all.find(
      (s) => wordCount(s) >= MIN_SENTENCE_WORDS && !/^(by|updated|published|posted|last updated)\b/i.test(s) && !NOTICE.test(s),
    ) ??
    all.find((s) => !NOTICE.test(s)) ??
    all[0] ??
    '';
  return limitWords(pick, MAX_SENTENCE_WORDS);
}

/**
 * A paper's author block can run straight into its abstract, with no sentence
 * break between them. Only in a block with email addresses (an author line) is
 * the text after "Abstract" the opening; a news sentence with the word is left alone.
 */
function afterAbstract(sentence: string): string {
  if (!EMAIL.test(sentence)) return sentence;
  const m = sentence.match(/\bAbstract\b[.:\s—-]*/);
  return m && m.index !== undefined ? sentence.slice(m.index + m[0].length) : sentence;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/**
 * Licence and permission notices, and author lines with email addresses, which
 * papers print before the abstract (arXiv prints a reuse permission and the
 * authors on the first page). They are not the article's opening.
 */
const NOTICE =
  /permission to (reproduce|use|copy|republish)|hereby grants permission|all rights reserved|creative commons|licensed under|terms of (use|service)|[\w.+-]+@[\w-]+\.[\w.-]+/i;

/** At most n words, cut at a word boundary, with "…" when something was cut. */
export function limitWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length > n) return `${words.slice(0, n).join(' ').replace(/[,;:\s]+$/, '')}…`;
  const joined = words.join(' ');
  // Scripts without spaces (Chinese, Japanese, Thai) count as one "word" here: cap by length too.
  const maxChars = n * 7;
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}…` : joined;
}
