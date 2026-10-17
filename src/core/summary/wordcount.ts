/**
 * The one word-count rule for summaries. Everything that checks a summary's
 * length uses this, so "20 words" means the same thing everywhere.
 *
 * - Words are separated by whitespace (any kind, including non-breaking spaces).
 * - A hyphenated word is one word: "energy-support", "well-known".
 * - A number is one word, with its symbols: "£3.5bn", "2026", "12%", "1,000".
 * - An abbreviation is one word: "U.K.", "NHS", "e.g.".
 * - Punctuation on its own is not a word: "-", "—", "&", "/", "…".
 * - An em dash, or an en dash between words, separates them: "rose—sharply" is
 *   two words. An en dash between numbers doesn't: "3–2" is one.
 * - Scripts written without spaces (Chinese, Japanese, Thai, Lao, Khmer,
 *   Myanmar): each word the browser's word segmenter finds counts as one.
 */

const NO_SPACE_SCRIPTS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** The words of a text, by the rule above. Scripts without spaces come back as segmented words. */
export function words(text: string): string[] {
  const out: string[] = [];
  const spaced = text.replace(/—/g, ' ').replace(/(?<!\p{N})–|–(?!\p{N})/gu, ' ');
  for (const token of spaced.split(/\s+/)) {
    if (!token || !WORD_CHAR.test(token)) continue;
    if (NO_SPACE_SCRIPTS.test(token)) out.push(...segment(token));
    else out.push(token);
  }
  return out;
}

export function countWords(text: string): number {
  return words(text).length;
}

function segment(token: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const found = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(token)]
      .filter((s) => s.isWordLike)
      .map((s) => s.segment);
    if (found.length) return found;
  }
  // No segmenter: about two characters a word is a fair guess for these scripts.
  const chars = [...token.replace(/[^\p{L}\p{N}]/gu, '')];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += 2) out.push(chars.slice(i, i + 2).join(''));
  return out.length ? out : [token];
}
