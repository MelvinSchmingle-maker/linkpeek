/** Word helpers for Story Search: what counts as a meaningful word, and redaction of personal details. */

const STOPWORDS = new Set(
  (
    'a an the and or but if of to in on at by for from with without into onto over under about after before ' +
    'as is are was were be been being has have had do does did will would can could should may might must ' +
    'this that these those it its it’s they them their there here we you your our i me my he she him her his ' +
    'not no so than then too very just also more most new news latest live update updates says said say ' +
    'what who why how when where which while all any some up down out off one two three'
  ).split(' '),
);

/** Link text that says nothing about the story. */
const GENERIC_WORDS = new Set(
  (
    'read more full story article here click tap continue reading see view learn find out details link this ' +
    'watch video listen open now go the it to on about latest report page post info information next ' +
    'previous back source via ›› » › → … ... >> > photos gallery'
  ).split(' '),
);

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .map((w) => w.replace(/^['’]+|['’]+$/g, ''))
    .filter(Boolean);
}

/** Words that carry meaning: no stopwords, at least 3 letters (or a number). */
export function contentWords(text: string): string[] {
  return words(text).filter((w) => !STOPWORDS.has(w) && (w.length >= 3 || /^\d+$/.test(w)));
}

/** "Read more", "Click here", "»" and the like. */
export function isGenericText(text: string): boolean {
  const ws = words(text);
  return ws.length === 0 || ws.every((w) => GENERIC_WORDS.has(w));
}

/** Enough words to read as a headline, and not generic. */
export function isDescriptive(text: string): boolean {
  return !isGenericText(text) && contentWords(text).length >= 3;
}

/** Share of a's content words that also appear in b (0 to 1). */
export function overlap(a: string, b: string): number {
  const aw = new Set(contentWords(a));
  if (!aw.size) return 0;
  const bw = new Set(contentWords(b));
  let n = 0;
  for (const w of aw) if (bw.has(w)) n++;
  return n / aw.size;
}

/**
 * Removes details about a person that never belong in a search: email
 * addresses and phone-number-like digit runs. Page text near a link can hold
 * them (a comment, a signature), and Story Search doesn't need them.
 */
export function redact(text: string): string {
  return text
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, '[email]')
    .replace(/(?<![\p{L}\p{N}])\+?\d[\d ().-]{7,}\d(?![\p{L}\p{N}])/gu, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number]' : m));
}

/** Whitespace collapsed, capped at a word boundary. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}
