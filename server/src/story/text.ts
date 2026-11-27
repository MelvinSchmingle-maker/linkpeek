/** Word handling for Story Search on the server: queries, matching and duplicate detection. */

const STOPWORDS = new Set(
  (
    'a an the and or but if of to in on at by for from with without into onto over under about after before ' +
    'as is are was were be been being has have had do does did will would can could should may might must ' +
    'this that these those it its they them their there here we you your our i me my he she him her his ' +
    'not no so than then too very just also more most new news latest live update updates says said say ' +
    'what who why how when where which while all any some up down out off read full story article report ' +
    'video watch breaking exclusive'
  ).split(' '),
);

/** A few event words written in several ways, so "dead", "died" and "death" match each other. */
const SAME_EVENT: Record<string, string> = {
  dead: 'death', died: 'death', dies: 'death', dying: 'death', deaths: 'death', killed: 'kill', kills: 'kill',
  killing: 'kill', murdered: 'murder', murders: 'murder', arrested: 'arrest', arrests: 'arrest', charged: 'charge',
  charges: 'charge', resigned: 'resign', resigns: 'resign', resignation: 'resign', elected: 'elect', wins: 'win',
  won: 'win', winning: 'win', injured: 'injury', injuries: 'injury', hurt: 'injury', fire: 'fire', blaze: 'fire',
  singer: 'musician', popstar: 'musician', rapper: 'musician', superstar: 'star', crashed: 'crash', crashes: 'crash',
  sued: 'sue', sues: 'sue', lawsuit: 'sue', jailed: 'jail', sentenced: 'sentence', banned: 'ban', bans: 'ban',
};

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .map((w) => w.replace(/^['’]+|['’]+$/g, '').replace(/['’]s$/, ''))
    .filter(Boolean);
}

/** A rough stem: "hotels" and "hotel" match. Short words are left alone. */
function stem(w: string): string {
  if (SAME_EVENT[w]) return SAME_EVENT[w]!;
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Meaningful words, stemmed. */
export function terms(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w) && (w.length >= 3 || /^\d+$/.test(w)))
    .map(stem);
}

export function termSet(text: string): Set<string> {
  return new Set(terms(text));
}

/**
 * Names: runs of capitalised words ("Jamie Rivers", "Grand Meridian Hotel",
 * "Paris", "BBC"). The first word of a sentence counts only as part of a
 * longer run. Lowercase text (an address slug) has none, and neither does a
 * headline in Title Case, where every word is capitalised and names can't be
 * told apart.
 */
export function names(text: string, { allowTitleCase = false }: { allowTitleCase?: boolean } = {}): string[] {
  const out = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?:;])\s+|\n+/)) {
    const tokens = sentence.split(/\s+/).map((raw) => ({ raw, w: raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/['’]s$/, '') }));
    const letters = tokens.filter((t) => /^\p{L}/u.test(t.w));
    const capped = letters.filter((t) => isCapitalised(t.w));
    // A headline in Title Case says nothing about which words are names. (Short sentences the AI wrote, like
    // "Mayor Pieter Holm of Zarnwick.", are checked with allowTitleCase: there, capitals do mean names.)
    if (!allowTitleCase && letters.length >= 4 && capped.length / letters.length >= 0.7) continue;
    let run: string[] = [];
    let runStart = 0;
    const flush = () => {
      const meaningful = run.filter((w) => !STOPWORDS.has(w.toLowerCase()));
      if (meaningful.length >= 2 || (meaningful.length === 1 && runStart > 0 && meaningful[0]!.length >= 3)) out.add(meaningful.join(' '));
      run = [];
    };
    tokens.forEach(({ raw, w }, i) => {
      if (isCapitalised(w)) {
        if (!run.length) runStart = i;
        run.push(w);
      } else if (run.length) {
        flush();
      }
      if (run.length && /[.!?:;,)]$/.test(raw)) flush();
    });
    if (run.length) flush();
  }
  return [...out].slice(0, 12);
}

function isCapitalised(w: string): boolean {
  return /^\p{Lu}[\p{Ll}'’-]+(\p{Lu}[\p{Ll}]+)?$/u.test(w) || /^\p{Lu}{2,5}$/u.test(w);
}

/** Five-word shingles, for spotting copied text. */
export function shingles(text: string, size = 5): Set<string> {
  const ws = words(text);
  const out = new Set<string>();
  for (let i = 0; i + size <= ws.length; i++) out.add(ws.slice(i, i + size).join(' '));
  return out;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
}

/** Share of a's items that are in b. */
export function coverage<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Days between two dates given as "YYYY-MM-DD" or "YYYY-MM" (the 15th for a month). */
export function daysBetween(a: string, b: string): number | undefined {
  const t = (s: string) => Date.parse(/^\d{4}-\d{2}$/.test(s) ? `${s}-15` : s.slice(0, 10));
  const x = t(a);
  const y = t(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
  return Math.round((y - x) / 86_400_000);
}

export function isoDay(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m = v.match(/^((?:19|20)\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
}
