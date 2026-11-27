/**
 * Does each claim's own evidence hold up? Checked claim by claim, and source
 * by source: one source's text is never used to support a claim that cites
 * another.
 *
 * For every claim the AI gives the sources it rests on and, for each, a short
 * passage copied word for word from that source. A claim survives only if:
 *
 * 1. **Its passages are really there.** Each quote must appear in the text of
 *    the source it's attributed to: the same words in the same order, allowing
 *    only differences of case, accents, spacing and quotation-mark or dash
 *    style; "..." may join parts that each appear, in order. A quote that
 *    isn't found, that's attributed to a source that isn't a match, or that
 *    shares no meaningful word with the claim, is discarded. A source with no
 *    surviving quote is not cited. A claim with none left is dropped.
 * 2. **Its specifics are in the sources it cites.** Every name and number it
 *    states must appear in those sources (with their own site and agency
 *    names); not in some other result.
 * 3. **Its dates are established.** A date must be written in a cited
 *    source's text, or follow exactly from a weekday or "yesterday" in that
 *    text and the source's publication date. Being near a publication date is
 *    not enough, and an "Updated ..." stamp is never an event date
 *    (hygiene.ts removes those).
 * 4. **Its main event is what the sources say.** If it says someone died, was
 *    arrested, charged, injured, resigned, that a company collapsed or
 *    something was stolen, a cited source must say so too, and not only in a
 *    negative ("has not been arrested").
 * 5. **Its passages don't say the opposite.** A passage that negates a word
 *    the claim states ("tests found no asbestos" for "asbestos was found"),
 *    or states what the claim negates, is not support: that source isn't
 *    cited, and the claim is flagged (weak, never confirmed), or dropped if
 *    nothing else supports it. This is lexical: it catches a negation near a
 *    shared word, not every way of contradicting a claim.
 *
 * A quote existing doesn't prove it supports the claim. So a claim that passes
 * but whose quotes share few of its words, or don't show its numbers, is
 * marked weak: shown, never counted as confirmed. Meaning is not judged here;
 * these are mechanical checks that make every claim auditable.
 */
import type { SearchHit } from './providers/types.js';
import { names, terms, words } from './text.js';

/** One quoted passage, as the AI gives it: `source` is the source's id in the prompt. */
export interface Quote {
  source: number;
  quote: string;
}

export const MIN_QUOTE_WORDS = 4;
export const MAX_QUOTE_CHARS = 400;
/** Below this share of a claim's meaningful words in its own quotes, the claim is weak. */
export const WEAK_OVERLAP = 0.3;

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|\\.)?(?:\\s+of)?\\s+${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
/**
 * Month names in French, Spanish, German and Italian (those the same as in
 * English are already covered), for international reporting in those
 * languages: "24 novembre 2026", "24 de noviembre de 2026", "24. Dezember".
 */
const FOREIGN_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  januar: 0, februar: 1, marz: 2, maerz: 2, juni: 5, juli: 6, oktober: 9, dezember: 11,
  gennaio: 0, febbraio: 1, aprile: 3, maggio: 4, giugno: 5, luglio: 6, settembre: 8, ottobre: 9, dicembre: 11,
};
const FOREIGN_DAY_FIRST = new RegExp(`(?<![\\p{L}\\p{N}])(\\d{1,2})(?:er|\\.)?\\s+(?:de\\s+)?(${Object.keys(FOREIGN_MONTHS).join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?(?![\\p{L}])`, 'giu');
const MONTH_FIRST = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
const ISO_DATE = /\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** The same, Sunday first, in French, Spanish, German and Italian, without accents (texts are compared without them). */
const FOREIGN_WEEKDAYS = [
  ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'],
  ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'],
];
const NOT_NAMES = new Set([...Object.keys(MONTH_INDEX), ...WEEKDAYS]);

/** A word without accents and with one kind of apostrophe, as the word lists below are written. */
export function plain(w: string): string {
  return w.normalize('NFKD').replace(/\p{M}+/gu, '').replace(/’/g, "'");
}

/**
 * Words that, just before an event word, turn it into its opposite or a rumour. With a few in French,
 * Spanish, German and Italian ("n'a pas été arrêté", "no fue detenido", "nicht festgenommen"). Words
 * that mean something else in another of these languages are left out ("mai": "never" in Italian, May in French).
 */
const NEGATORS = new Set([
  'not', 'no', 'never', 'without', 'denied', 'denies', 'deny', 'denying', 'nor', 'neither', 'false', 'hoax', 'rumour', 'rumours',
  'rumor', 'rumors', 'rumoured', 'rumored', "isn't", "wasn't", "hasn't", "haven't", "hadn't", "didn't", "doesn't", "won't",
  "can't", 'cannot', "aren't", "weren't", 'unfounded', 'baseless',
  'ne', "n'a", "n'ont", "n'est", "n'etait", "n'avait", "n'y", 'pas', 'aucun', 'aucune', 'jamais', 'sans', 'dementi', 'dement',
  'nadie', 'ningun', 'ninguno', 'ninguna', 'ni', 'nunca', 'sin', 'desmiente', 'desmintio',
  'nicht', 'kein', 'keine', 'keinen', 'keiner', 'niemand', 'nie', 'ohne', 'dementiert',
  'non', 'nessuno', 'nessuna', 'senza', 'smentisce', 'smentito',
].map(plain));
const isNegator = (w: string) => NEGATORS.has(plain(w));
/** Words that make a statement an allegation rather than an established fact. */
export const ALLEGATION = new Set([
  'accused', 'accuses', 'accusing', 'accusation', 'accusations', 'alleged', 'allegedly', 'allegation', 'allegations', 'suspected',
  'suspect', 'suspects', 'claims', 'claimed', 'denies', 'denied', 'deny', 'charged', 'reportedly', 'purportedly', 'unconfirmed', 'unproven',
  'presume', 'presumee', 'soupconne', 'soupconnee', 'accuse', 'accusee', 'supuesto', 'supuesta', 'presunto', 'presunta', 'acusado', 'acusada',
  'mutmasslich', 'mutmaßlich', 'angeblich', 'beschuldigt', 'verdachtigt', 'accusato', 'accusata', 'sospettato', 'sospettata',
].map(plain));
export const isAllegation = (w: string) => ALLEGATION.has(plain(w));

/**
 * The events a claim or headline can get wrong in a way that misleads, by the
 * words that state them. Kept apart from matching's word stems on purpose:
 * this decides what a sentence asserts, not how close two texts are.
 */
const EVENT_WORDS: Record<string, string> = {};
const EVENTS: Record<string, string[]> = {
  death: ['die', 'dies', 'died', 'dead', 'death', 'deaths', 'dying'],
  kill: ['kill', 'kills', 'killed', 'killing', 'killings'],
  murder: ['murder', 'murders', 'murdered', 'murdering'],
  arrest: ['arrest', 'arrests', 'arrested', 'arresting'],
  charge: ['charged', 'charges'],
  convict: ['convicted', 'conviction', 'convictions', 'guilty'],
  jail: ['jailed', 'imprisoned', 'imprisonment'],
  sentence: ['sentenced'],
  resign: ['resign', 'resigns', 'resigned', 'resignation', 'quits'],
  injury: ['injured', 'injuries', 'injures', 'hurt', 'wounded'],
  hospital: ['hospital', 'hospitalised', 'hospitalized', 'hospitalisation', 'hospitalization'],
  collapse: ['collapse', 'collapses', 'collapsed'],
  bankrupt: ['bankrupt', 'bankruptcy', 'insolvent', 'insolvency'],
  cure: ['cure', 'cures', 'cured'],
  steal: ['steal', 'steals', 'stole', 'stolen', 'stealing', 'theft', 'thefts'],
  fire: ['fire', 'fires', 'blaze', 'blazes'],
  crash: ['crash', 'crashes', 'crashed'],
};
/**
 * The same events in French, Spanish, German and Italian, so reporting in those languages can support an
 * English claim about the event. Words with another common meaning are left out ("brand", German for fire;
 * "tot", German for dead).
 */
const FOREIGN_EVENTS: Record<string, string[]> = {
  death: ['mort', 'morte', 'morts', 'meurt', 'deces', 'decede', 'decedee', 'muere', 'murio', 'muerto', 'muerta', 'fallece', 'fallecio', 'fallecido', 'fallecida', 'stirbt', 'starb', 'gestorben', 'tod', 'toten', 'muore', 'morto', 'morta', 'deceduto', 'deceduta'],
  kill: ['tue', 'tuee', 'tues', 'mato', 'matado', 'getotet', 'ucciso', 'uccisa', 'uccisi'],
  arrest: ['arrete', 'arretee', 'arretes', 'interpelle', 'interpellee', 'interpelles', 'arrestation', 'detenido', 'detenida', 'detenidos', 'arrestado', 'arrestada', 'detencion', 'festgenommen', 'verhaftet', 'festnahme', 'verhaftung', 'arrestato', 'arrestata', 'arrestati'],
  resign: ['demission', 'demissionne', 'dimision', 'dimite', 'dimitio', 'rucktritt', 'dimissioni', 'dimesso', 'dimessa'],
  injury: ['blesse', 'blessee', 'blesses', 'blessees', 'blessure', 'blessures', 'herido', 'herida', 'heridos', 'heridas', 'verletzt', 'verletzte', 'verletzten', 'ferito', 'ferita', 'feriti', 'ferite'],
  hospital: ['hopital', 'hospitalise', 'hospitalisee', 'hospitalizado', 'hospitalizada', 'krankenhaus', 'klinik', 'ospedale', 'ricoverato', 'ricoverata'],
  collapse: ['effondrement', 'effondre', 'effondree', 'derrumbe', 'colapso', 'einsturz', 'eingesturzt', 'crollo', 'crollato', 'crollata'],
  steal: ['vol', 'vole', 'voles', 'volee', 'cambriolage', 'robo', 'robado', 'robada', 'robados', 'hurto', 'diebstahl', 'gestohlen', 'raub', 'furto', 'rubato', 'rubati', 'rapina'],
  fire: ['incendie', 'incendies', 'feu', 'incendio', 'incendios', 'feuer', 'grossbrand', 'rogo'],
};
for (const [stem, list] of [...Object.entries(EVENTS), ...Object.entries(FOREIGN_EVENTS)]) for (const w of list) EVENT_WORDS[plain(w)] = stem;
/** The event a word states, if any. */
const eventOf = (w: string): string | undefined => EVENT_WORDS[plain(w)];
/** What a source must say for a claimed event to be supported: dying is supported by being killed. */
const SUPPORTED_BY: Record<string, string[]> = { death: ['death', 'kill', 'murder'], kill: ['kill', 'murder'], jail: ['jail', 'sentence'], sentence: ['sentence', 'jail'] };

/**
 * Words that report the same thing, for deciding whether a quote is about the
 * claim at all ("an investigation is under way" is about "opened an
 * inquiry"). Only for that: it never makes a quote count as found.
 */
const SAME_THING: Record<string, string> = {
  investigation: 'inquiry', investigations: 'inquiry', investigating: 'inquiry', investigated: 'inquiry', probe: 'inquiry', inquest: 'inquiry', enquiry: 'inquiry',
  detained: 'arrest', blaze: 'fire', heist: 'steal', robbery: 'steal', theft: 'steal', stole: 'steal', stolen: 'steal', stealing: 'steal', thieves: 'steal',
  dead: 'death', died: 'death', dies: 'death', killed: 'death', body: 'death', hurt: 'injury', injured: 'injury', wounded: 'injury',
};
function aboutTerms(text: string): Set<string> {
  const out = new Set(terms(text));
  for (const w of words(text)) {
    if (SAME_THING[w]) out.add(SAME_THING[w]!);
    // The event itself, in any of the languages above: "injured" and "blessé" are about the same thing.
    const e = eventOf(w);
    if (e) out.add(`event:${e}`);
  }
  for (const t of [...out]) if (SAME_THING[t]) out.add(SAME_THING[t]!);
  return out;
}

/** Lower case, no accents, one kind of quotation mark and dash, single spaces. */
export function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A source's text as the checks read it. Passages are kept apart, so a quote can't run from one into the next. */
export function sourceText(hit: SearchHit): string {
  return [hit.title, hit.description ?? '', ...hit.passages].filter(Boolean).join(' ¶ ');
}

const EDGE = /^[\s"'.,;:!?()[\]-]+|[\s"'.,;:!?()[\]-]+$/g;

/** Is this quote in this text, word for word (see the top of this file for what may differ)? */
export function quoteFound(quote: string, text: string): boolean {
  if (!quote || quote.length > MAX_QUOTE_CHARS || quote.includes('¶')) return false;
  const parts = quote
    .split(/\s*(?:\.{3}|…)\s*/)
    .map((p) => norm(p).replace(EDGE, ''))
    .filter(Boolean);
  if (!parts.length || parts.some((p) => p.split(' ').length < 2)) return false;
  if (parts.reduce((n, p) => n + p.split(' ').length, 0) < MIN_QUOTE_WORDS) return false;
  const t = norm(text);
  let from = 0;
  for (const p of parts) {
    const at = t.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

export interface WrittenDate {
  day: number;
  /** 0 to 11. */
  month: number;
  year?: number;
}

/** Dates written out in a text: "21 April 2025", "April 21, 2025", "Oct. 19", "21st of April", "2025-04-21". */
export function datesWritten(text: string): (WrittenDate & { raw: string })[] {
  const out: (WrittenDate & { raw: string })[] = [];
  const push = (raw: string, day: number, monthWord: string | number, year?: string) => {
    const month = typeof monthWord === 'number' ? monthWord : MONTH_INDEX[monthWord.toLowerCase().replace(/\.$/, '')];
    if (month === undefined || day < 1 || day > 31) return;
    out.push({ raw, day, month, ...(year ? { year: Number(year) } : {}) });
  };
  for (const m of text.matchAll(DAY_FIRST)) push(m[0], Number(m[1]), m[2]!, m[3]);
  for (const m of text.matchAll(MONTH_FIRST)) push(m[0], Number(m[2]), m[1]!, m[3]);
  for (const m of text.matchAll(ISO_DATE)) push(m[0], Number(m[3]), Number(m[2]) - 1, m[1]);
  for (const m of plain(text).matchAll(FOREIGN_DAY_FIRST)) push(m[0], Number(m[1]), FOREIGN_MONTHS[m[2]!.toLowerCase()]!, m[3]);
  return out;
}

function isoOf(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Dates that follow exactly from a text and its publication date: a weekday
 * ("on Monday", "Easter Monday") is the last such day on or before
 * publication; "yesterday" is the day before; "today", "this morning",
 * "tonight" the day itself; "last night" and "overnight" either.
 */
export function datesDerived(text: string, published: string | undefined): string[] {
  if (!published) return [];
  const p = Date.parse(`${published.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(p)) return [];
  const t = text.toLowerCase();
  const out = new Set<string>();
  const back = (days: number) => out.add(isoOf(p - days * 86_400_000));
  const weekday = new Date(p).getUTCDay();
  for (const m of t.matchAll(/\b(last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    const diff = (weekday - WEEKDAYS.indexOf(m[2]!) + 7) % 7;
    back(diff);
    if (m[1]) back(diff + 7);
  }
  if (/\byesterday\b/.test(t)) back(1);
  if (/\b(today|tonight|this (morning|afternoon|evening)|earlier today)\b/.test(t)) back(0);
  if (/\b(last night|overnight)\b/.test(t)) {
    back(0);
    back(1);
  }
  // The same in French, Spanish, German and Italian ("mardi soir", "ayer", "gestern"). French "hier" is left
  // out: it is "here" in German.
  const f = norm(text);
  const has = (re: string) => new RegExp(`(?<![\\p{L}'])(?:${re})(?![\\p{L}])`, 'u').test(f);
  for (const week of FOREIGN_WEEKDAYS) week.forEach((day, i) => has(day) && back((weekday - i + 7) % 7));
  if (has("ayer|gestern|ieri|hier (?:soir|matin|apres-midi)")) back(1);
  if (has("aujourd'hui|hoy|heute|oggi")) back(0);
  if (has('anoche|cette nuit|stanotte|heute nacht|letzte nacht')) {
    back(0);
    back(1);
  }
  return [...out];
}

/** Is this date established by one of these sources (written in its text, or derived as above)? */
export function dateEstablished(d: WrittenDate, hits: SearchHit[]): boolean {
  for (const h of hits) {
    const text = sourceText(h);
    const pubYear = h.published ? Number(h.published.slice(0, 4)) : undefined;
    for (const w of datesWritten(text)) {
      if (w.day !== d.day || w.month !== d.month) continue;
      const year = w.year ?? pubYear;
      if (d.year === undefined || year === d.year) return true;
    }
    for (const iso of datesDerived(text, h.published)) {
      const [y, m, day] = iso.split('-').map(Number) as [number, number, number];
      if (m - 1 === d.month && day === d.day && (d.year === undefined || y === d.year)) return true;
    }
  }
  return false;
}

/** The events a text asserts (not negated) and the ones it only denies or calls rumours. */
export function eventsIn(text: string): { asserted: Set<string>; negated: Set<string> } {
  const ws = words(text);
  const asserted = new Set<string>();
  const negated = new Set<string>();
  ws.forEach((w, i) => {
    const stem = eventOf(w);
    if (!stem) return;
    const before = ws.slice(Math.max(0, i - 4), i);
    (before.some(isNegator) ? negated : asserted).add(stem);
  });
  return { asserted, negated };
}

/** The asserted events in `claim` that none of these texts assert. */
export function unsupportedEvents(claim: string, texts: string[]): string[] {
  const said = new Set(texts.flatMap((t) => [...eventsIn(t).asserted]));
  return [...eventsIn(claim).asserted].filter((e) => !(SUPPORTED_BY[e] ?? [e]).some((s) => said.has(s)));
}

/** Every sentence in these texts that mentions this event also calls it an allegation or denies it. */
export function onlyAlleged(event: string, texts: string[]): boolean {
  const sentences = texts.flatMap((t) => t.split(/(?<=[.!?¶])\s+/));
  const about = sentences.filter((s) => words(s).some((w) => eventOf(w) === event));
  return about.length > 0 && about.every((s) => words(s).some(isAllegation));
}

function fold(s: string): string {
  return norm(s);
}

function wordSet(text: string): Set<string> {
  return new Set(fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function digitSet(text: string): Set<string> {
  return new Set((text.match(/\d+/g) ?? []).flatMap((d) => [d, String(Number(d))]));
}

/**
 * The names, numbers and dates in a sentence that these sources don't
 * establish. `extra`: the sources' own site and agency names. `linkNames`:
 * names the link itself gives, checked wherever they appear in the sentence.
 */
export function unsupportedSpecifics(sentence: string, hits: SearchHit[], extra: string[] = [], linkNames: string[] = [], { allowTitleCase = true }: { allowTitleCase?: boolean } = {}): string[] {
  const out: string[] = [];
  const text = [...hits.map(sourceText), ...extra].join(' ');
  const ws = wordSet(text);
  const ds = digitSet(text);
  // Dates first, by the strict rule; then they're out of the way of the number check.
  let rest = sentence;
  for (const d of datesWritten(sentence)) {
    if (!dateEstablished(d, hits)) out.push(d.raw);
    rest = rest.replace(d.raw, ' ');
  }
  for (const n of rest.match(/\d+/g) ?? []) if (!ds.has(n) && !ds.has(String(Number(n)))) out.push(n);
  const said = wordSet(rest);
  // A sentence the AI wrote: capitals mean names. A headline in Title Case: they don't (allowTitleCase false).
  const nameWords = [...names(rest, { allowTitleCase }), ...linkNames].flatMap((n) => fold(n).split(/[^\p{L}\p{N}]+/u));
  for (const w of new Set(nameWords)) if (w && said.has(w) && !NOT_NAMES.has(w) && !/^\d+$/.test(w) && !ws.has(w)) out.push(w);
  return out;
}

export type DropReason = 'no-evidence' | 'unsupported-specifics' | 'unsupported-date' | 'unsupported-event' | 'contradicted';

/** A word as the contradiction check compares it: "closed", "closes" and "close" are one word. */
function base(w: string): string {
  return w.length > 4 ? w.replace(/(ing|ed|es|s|e)$/, '') : w;
}

/**
 * Each meaningful word of a text, and whether it is stated (+) or negated (-):
 * negated when "no", "not", "denied" and the like come at most three words
 * before it in the same clause ("tests found no asbestos"). "Not only" isn't
 * a negation. Numbers are left to the number checks.
 */
export function polarity(text: string): Map<string, Set<'+' | '-'>> {
  const out = new Map<string, Set<'+' | '-'>>();
  for (const clause of text.split(/[.;:!?,¶()]+|\b(?:but|while|whereas|although|though|however)\b/i)) {
    const ws = words(clause);
    ws.forEach((w, i) => {
      if (isNegator(w) || /^\d+$/.test(w) || !terms(w).length) return;
      const before = ws.slice(Math.max(0, i - 3), i);
      const negated = before.some((b, k) => isNegator(b) && !(b === 'not' && before[k + 1] === 'only'));
      const key = base(terms(w)[0]!);
      if (!out.has(key)) out.set(key, new Set());
      out.get(key)!.add(negated ? '-' : '+');
    });
  }
  return out;
}

/**
 * Does this passage say the opposite of the claim? It does when a word the
 * claim states appears in the passage only negated ("asbestos was found"
 * against "tests found no asbestos"), or the claim negates a word the passage
 * only states ("no one was injured" against "seven workers were injured").
 * Lexical: it catches a negation near a shared word, not every way of saying
 * the opposite ("remains in office" against "resigned").
 */
export function contradicts(claim: string, passage: string): string[] {
  const c = polarity(claim);
  const p = polarity(passage);
  const out: string[] = [];
  for (const [w, signs] of c) {
    const other = p.get(w);
    if (!other || signs.size !== 1 || other.size !== 1) continue;
    if ([...signs][0] !== [...other][0]) out.push(w);
  }
  return out;
}

export interface ClaimCheck {
  ok: boolean;
  reason?: DropReason;
  /** What was unsupported. */
  missing: string[];
  /** Indexes (into `hits`) of the sources with a valid quote: the claim's citations. */
  cited: number[];
  /** The valid quotes, by source index. */
  quotes: { i: number; quote: string }[];
  /** Passed, but its own quotes share few of its words or don't show its specifics: never counted as confirmed. */
  weak: boolean;
  /** Indexes of cited sources whose quote says the opposite of the claim: not counted as support. */
  contradicted: number[];
}

export interface ClaimContext {
  hits: SearchHit[];
  /** Indexes of the sources that are matches; quotes from any other are discarded. */
  kept: Set<number>;
  /** Each source's own names (site, credited agency), by index. */
  extras: string[][];
  linkNames: string[];
}

/**
 * Checks one claim against its own evidence, as described at the top of this file. `quotes` use prompt ids
 * (index + 1). `opposites: false` skips the contradiction check, for "What remains unclear?", whose points
 * set one source's version against another's.
 */
export function checkClaim(text: string, quotes: Quote[], ctx: ClaimContext, { opposites = true }: { opposites?: boolean } = {}): ClaimCheck {
  const claimTerms = new Set(terms(text));
  const claimAbout = aboutTerms(text);
  const found: { i: number; quote: string }[] = [];
  for (const q of quotes) {
    const i = q.source - 1;
    const hit = ctx.hits[i];
    if (!hit || !ctx.kept.has(i) || typeof q.quote !== 'string') continue;
    if (!quoteFound(q.quote, sourceText(hit))) continue;
    // A real passage about something else isn't evidence for this claim.
    if (![...aboutTerms(q.quote)].some((t) => claimAbout.has(t))) continue;
    if (!found.some((v) => v.i === i && v.quote === q.quote)) found.push({ i, quote: q.quote.trim() });
  }
  // A real passage that says the opposite isn't evidence for the claim either; the claim is flagged.
  const against = opposites ? found.filter((v) => contradicts(text, v.quote).length > 0) : [];
  const valid = found.filter((v) => !against.includes(v));
  const contradicted = [...new Set(against.map((v) => v.i))].sort((a, b) => a - b);
  const cited = [...new Set(valid.map((v) => v.i))].sort((a, b) => a - b);
  const fail = (reason: DropReason, missing: string[] = []): ClaimCheck => ({ ok: false, reason, missing, cited, quotes: valid, weak: false, contradicted });
  if (!cited.length) return fail(contradicted.length ? 'contradicted' : 'no-evidence');

  const citedHits = cited.map((i) => ctx.hits[i]!);
  const extra = cited.flatMap((i) => ctx.extras[i] ?? []);
  const missing = unsupportedSpecifics(text, citedHits, extra, ctx.linkNames);
  if (missing.length) return fail(datesWritten(text).some((d) => missing.includes(d.raw)) ? 'unsupported-date' : 'unsupported-specifics', missing);
  const events = unsupportedEvents(text, citedHits.map(sourceText));
  if (events.length) return fail('unsupported-event', events);

  // Weak: the quotes themselves don't carry the claim: too few of its words, or not its numbers. (Names may be
  // elsewhere in the cited source: a quote rarely repeats every name, and requiring that would make almost
  // every claim weak.)
  const quoted = valid.map((v) => v.quote).join(' ');
  const quotedTerms = new Set(terms(quoted));
  const quotedEvents = new Set(words(quoted).map(eventOf).filter(Boolean));
  // A claim word counts as carried by the quotes when it's there, or states the same event in another language.
  const eventByTerm = new Map(words(text).flatMap((w) => (terms(w).length && eventOf(w) ? [[terms(w)[0]!, eventOf(w)!] as const] : [])));
  const carried = (t: string) => quotedTerms.has(t) || (eventByTerm.has(t) && quotedEvents.has(eventByTerm.get(t)));
  const overlap = claimTerms.size ? [...claimTerms].filter(carried).length / claimTerms.size : 1;
  const quotedDigits = digitSet(quoted);
  const numbersOutside = (withoutDates(text).match(/\d+/g) ?? []).some((n) => !quotedDigits.has(n) && !quotedDigits.has(String(Number(n))));
  return { ok: true, missing: [], cited, quotes: valid, weak: overlap < WEAK_OVERLAP || numbersOutside || contradicted.length > 0, contradicted };
}

/** The sentence with its written dates taken out (dates are judged by dateEstablished, not as numbers). */
function withoutDates(text: string): string {
  let t = text;
  for (const d of datesWritten(text)) t = t.replace(d.raw, ' ');
  return t;
}
