/**
 * Turns the AI's reply into the report the extension shows, applying the
 * rules the AI can't overrule:
 *
 * - A source is a match only if the AI says so AND the rule-based checks
 *   allow it (match.ts). Sources that aren't matches are removed, with every
 *   claim that relied only on them.
 * - Every sentence in "What happened", "Key details" and the facts must cite
 *   at least one remaining source, or it's dropped. "What remains unclear"
 *   may cite none.
 * - "Confirmed" is decided here, not by the AI: a fact is confirmed only when
 *   strong matches from at least two independent groups (syndicated copies
 *   count once) state it, or a primary source (police, a court, a
 *   government) does. Otherwise it's listed as reported by one source.
 * - The AI's confidence can be lowered, never raised: "strong evidence"
 *   needs strong matches from two independent groups, a confirmed fact, and
 *   more than snippets to go on.
 * - Sentences with "yesterday", "today" and the like are dropped: on a card
 *   read later they'd be wrong. Links and markup are removed from AI text.
 * - Nothing specific may be added: a sentence (or the subject) that states a
 *   number, a name or a date that none of the kept sources contains is
 *   dropped (grounded()). A date worked out from a source's publication date,
 *   as the prompt asks, counts as supported. This is what stops an AI that
 *   invents a story ("the mayor of Zarnwick resigned...") from getting its
 *   invention onto the card, even as a "possible" match. Wording is not
 *   checked: paraphrase is normal, and would make the rule drop good claims.
 */
import type { AiReport } from './analyse.js';
import type { Claim, InvestigationConfidence, MatchStatus, ReportNote, ReportSource, SourceKind, StoryReport, StoryRequest } from './contract.js';
import { capMatch, type LinkProfile, type Scored } from './match.js';
import type { SearchHit } from './providers/types.js';
import { canonicalKey, type Grouping } from './sources.js';
import { clip, daysBetween, names } from './text.js';

const RELATIVE_DATE = /\b(yesterday|today|tonight|tomorrow|last night|this (morning|afternoon|evening))\b/i;
const MAX_SENTENCE = 320;
/** A story whose newest source is this recent may still be developing. */
const FRESH_DAYS = 2;

export interface FinaliseInput {
  req: StoryRequest;
  profile: LinkProfile;
  candidates: Scored[];
  grouping: Grouping;
  kinds: SourceKind[];
  publishers: string[];
  ai: AiReport;
  /** Results set aside before the AI saw them. */
  setAsideEarly: number;
  /** Some set-aside results were from a different time than the link. */
  olderSetAside: boolean;
  /** No result came with more than its headline and snippet. */
  snippetsOnly: boolean;
  searchedFor: string;
  now: Date;
  /** Filled in: how many sentences (and subjects) were dropped for stating what no kept source says. */
  stats?: { ungrounded: number };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NOT_NAMES = new Set([...MONTHS, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const MONTH = MONTHS.join('|');
const DATE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})(?:,?\\s+(\\d{4}))?\\b|\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
/** A date this many days either side of a kept source's publication date may have been worked out from it. */
const WORKED_OUT_DAYS = 7;

/** Lower case without accents, so "Eugénie" matches "Eugenie". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

function digitRuns(s: string): string[] {
  return (s.match(/\d+/g) ?? []).flatMap((d) => [d, String(Number(d))]);
}

/** What the kept sources say, as the words and numbers a claim's specifics are checked against. */
export interface Evidence {
  words: Set<string>;
  digits: Set<string>;
  /** Publication dates, as days since 1970. */
  days: number[];
}

export function evidenceOf(hits: SearchHit[], extra: string[] = []): Evidence {
  const text = fold([...hits.flatMap((h) => [h.title, h.description ?? '', h.author ?? '', ...h.passages]), ...extra].join(' \n '));
  const digits = new Set(digitRuns(text));
  const days: number[] = [];
  for (const h of hits) {
    if (!h.published) continue;
    for (const part of h.published.split('-')) for (const d of digitRuns(part)) digits.add(d);
    const t = Date.parse(h.published.length === 7 ? `${h.published}-15` : h.published);
    if (!Number.isNaN(t)) days.push(Math.round(t / 86_400_000));
  }
  return { words: new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)), digits, days };
}

/**
 * The numbers, names and dates in a sentence that the kept sources don't
 * contain: what the AI added. Empty when everything specific is supported.
 * `linkNames`: the names the link itself gives. They're checked wherever they
 * appear, even first in a sentence, because echoing the link's own names is
 * exactly how an invented report would look ("Zarnwick's mayor resigned").
 */
export function ungrounded(sentence: string, ev: Evidence, linkNames: string[] = []): string[] {
  const out: string[] = [];
  // Dates first: in the sources' text, or within a week of a publication date (worked out from it).
  const rest = sentence.replace(DATE, (whole, d1, m1, y1, m2, d2, y2) => {
    const day = Number(d1 ?? d2);
    const month = MONTHS.indexOf(String(m1 ?? m2).toLowerCase());
    const year = y1 ?? y2;
    const inText = ev.words.has(MONTHS[month]!) && ev.digits.has(String(day)) && (!year || ev.digits.has(year));
    const near = ev.days.some((p) => {
      const years = year ? [Number(year)] : [new Date(p * 86_400_000).getUTCFullYear()];
      return years.some((y) => Math.abs(Math.round(Date.UTC(y, month, day) / 86_400_000) - p) <= WORKED_OUT_DAYS);
    });
    if (!inText && !near) out.push(whole);
    return ' ';
  });
  for (const d of rest.match(/\d+/g) ?? []) if (!ev.digits.has(d) && !ev.digits.has(String(Number(d)))) out.push(d);
  const said = new Set(fold(rest).split(/[^\p{L}\p{N}]+/u));
  const words = [...names(rest, { allowTitleCase: true }), ...linkNames].flatMap((n) => fold(n).split(/[^\p{L}\p{N}]+/u));
  for (const w of new Set(words)) if (w && said.has(w) && !NOT_NAMES.has(w) && !/^\d+$/.test(w) && !ev.words.has(w)) out.push(w);
  return out;
}

function cleanText(s: string): string | undefined {
  const t = clip(s.replace(/https?:\/\/\S+/g, '').replace(/[*_`#<>]/g, '').replace(/\s+/g, ' '), MAX_SENTENCE);
  if (!t || RELATIVE_DATE.test(t)) return undefined;
  return t;
}

export function finalise(input: FinaliseInput): StoryReport {
  const { req, profile, candidates, grouping, kinds, publishers, ai, now } = input;
  const today = now.toISOString().slice(0, 10);

  // 1. Which sources are matches, after the rules.
  const status: MatchStatus[] = candidates.map((c, i) => {
    const said = ai.matches.find((m) => m.source === i + 1)?.status ?? 'none';
    return capMatch(said, c, profile);
  });
  const kept = candidates.map((_, i) => i).filter((i) => status[i] !== 'none');
  const number = new Map(kept.map((i, k) => [i + 1, k + 1]));
  // Everything the kept sources say (their sites and credited agencies too, so "the Associated Press said" is supported).
  const evidence = evidenceOf(
    kept.map((i) => candidates[i]!.hit),
    kept.flatMap((i) => [publishers[i] ?? '', grouping.via[i] ?? '']),
  );
  const stats = input.stats ?? { ungrounded: 0 };
  const supported = (text: string): boolean => {
    if (!ungrounded(text, evidence, profile.names).length) return true;
    stats.ungrounded++;
    return false;
  };
  const strongIdx = new Set(kept.filter((i) => status[i] === 'strong'));
  const rejectedOlder = candidates.some((c, i) => status[i] === 'none' && c.dateMismatch) || input.olderSetAside;
  const setAside = input.setAsideEarly + (candidates.length - kept.length);

  const base = {
    setAside,
    searchedFor: input.searchedFor,
    checkedAt: now.toISOString(),
  };
  if (!kept.length) {
    return {
      ...base,
      status: 'no-match',
      match: 'none',
      confidence: 'insufficient',
      whatHappened: [],
      details: [],
      confirmed: [],
      reported: [],
      unclear: [],
      sources: [],
      notes: rejectedOlder ? ['older-story'] : [],
    };
  }

  // 2. Claims, with sources renumbered and unmatched ones removed.
  const cite = (ids: number[]) => [...new Set(ids.map((id) => number.get(id)).filter((n): n is number => n !== undefined))].sort((a, b) => a - b);
  const factual = (list: { text: string; sources: number[] }[], max: number): Claim[] => {
    const out: Claim[] = [];
    for (const c of list) {
      const text = cleanText(c.text);
      const sources = cite(c.sources);
      if (text && sources.length && supported(text)) out.push({ text, sources });
      if (out.length >= max) break;
    }
    return out;
  };
  const whatHappened = factual(ai.what_happened, 3);
  const seenLabels = new Set<string>();
  const details = ai.details
    .map((d) => ({ label: d.label, text: cleanText(d.text), sources: cite(d.sources) }))
    .filter((d): d is Claim & { label: typeof d.label } => Boolean(d.text) && d.sources.length > 0 && !seenLabels.has(d.label) && supported(d.text!) && Boolean(seenLabels.add(d.label)))
    .slice(0, 5);
  const facts = factual(ai.facts, 6);
  const unclear = ai.unclear
    .map((c) => ({ text: cleanText(c.text), sources: cite(c.sources) }))
    .filter((c): c is Claim => Boolean(c.text))
    .slice(0, 4);

  // 3. Confirmed or only reported: decided by independent groups.
  const indexOf = (n: number) => kept[n - 1]!;
  const confirmed: Claim[] = [];
  const reported: Claim[] = [];
  for (const f of facts) {
    const strong = f.sources.map(indexOf).filter((i) => strongIdx.has(i));
    const groups = new Set(strong.map((i) => grouping.group[i]));
    if (groups.size >= 2 || strong.some((i) => kinds[i] === 'primary')) confirmed.push(f);
    else reported.push(f);
  }

  // 4. Overall match and confidence. Lowered by the rules, never raised.
  const match: MatchStatus = strongIdx.size ? 'strong' : 'possible';
  const strongGroups = new Set([...strongIdx].map((i) => grouping.group[i]));
  const keptGroups = new Set(kept.map((i) => grouping.group[i]));
  const primaryStrong = [...strongIdx].some((i) => kinds[i] === 'primary');
  let confidence: InvestigationConfidence = ai.confidence;
  if ((ai.conflicting || confidence === 'conflicting') && kept.length >= 2) confidence = 'conflicting';
  else if (confidence === 'conflicting') confidence = 'partial';
  if (confidence === 'strong') {
    const enough = match === 'strong' && (strongGroups.size >= 2 || primaryStrong) && confirmed.length > 0 && !input.snippetsOnly;
    if (!enough) confidence = 'partial';
  }

  // 5. Notes.
  const notes: ReportNote[] = [];
  // A link with no name and no date can't be pinned to one story (match.ts caps it at "possible"):
  // say so first, and don't put a name forward as its subject.
  const vague = !profile.names.length && !profile.date;
  if (vague) notes.push('vague-link');
  if (keptGroups.size === 1) notes.push('single-source');
  if (kept.some((i) => grouping.copyOf[i] !== undefined)) notes.push('syndicated');
  const newest = kept.map((i) => candidates[i]!.hit.published).filter((d): d is string => Boolean(d)).sort().pop();
  const fresh = newest !== undefined && (daysBetween(newest, today) ?? Infinity) <= FRESH_DAYS;
  if (ai.developing || fresh) notes.push('developing');
  if (input.snippetsOnly) notes.push('snippets-only');
  if (rejectedOlder) notes.push('older-story');

  const sources: ReportSource[] = kept.map((i, k) => {
    const h = candidates[i]!.hit;
    const original = grouping.copyOf[i];
    const copyOf = original !== undefined ? number.get(original + 1) : undefined;
    return {
      n: k + 1,
      title: clip(h.title, 200),
      publisher: publishers[i] ?? '',
      url: h.url,
      ...(h.published ? { published: h.published } : {}),
      kind: kinds[i]!,
      match: status[i] as 'strong' | 'possible',
      ...(copyOf !== undefined ? { copyOf } : {}),
      ...(grouping.via[i] ? { via: grouping.via[i] } : {}),
      ...(canonicalKey(h.url) === canonicalKey(req.url) ? { original: true } : {}),
    };
  });

  // The AI's subject must not add a name or number either; with none, the link's own headline stands in.
  const aiSubject = cleanText(ai.subject);
  const subject = vague ? undefined : aiSubject ? (supported(aiSubject) ? aiSubject : undefined) : req.headline?.text;
  const written = whatHappened.length > 0 || facts.length > 0;
  if (!written) {
    // The AI's report stated things no source says: its matching can't be trusted either. Nothing is shown.
    if (stats.ungrounded > 0) {
      return { ...base, setAside: input.setAsideEarly + candidates.length, status: 'no-match', match: 'none', confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [], sources: [], notes: rejectedOlder ? ['older-story'] : [] };
    }
    // Nothing usable was written: the closest sources are listed as possible matches, with no claims at all.
    return { ...base, status: 'report-failed', match, confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [], sources, notes };
  }
  return {
    ...base,
    status: 'report',
    ...(subject ? { subject: clip(subject, 140) } : {}),
    match,
    confidence,
    whatHappened,
    details,
    confirmed,
    reported,
    unclear,
    sources,
    notes,
  };
}

/** No results at all. */
export function noResults(searchedFor: string, now: Date): StoryReport {
  return emptyReport('no-results', 0, [], searchedFor, now);
}

/** Results, but none close enough to send to the AI. */
export function noMatch(setAside: number, older: boolean, searchedFor: string, now: Date): StoryReport {
  return emptyReport('no-match', setAside, older ? ['older-story'] : [], searchedFor, now);
}

function emptyReport(status: 'no-results' | 'no-match', setAside: number, notes: ReportNote[], searchedFor: string, now: Date): StoryReport {
  return {
    status,
    match: 'none',
    confidence: 'insufficient',
    whatHappened: [],
    details: [],
    confirmed: [],
    reported: [],
    unclear: [],
    sources: [],
    setAside,
    notes,
    searchedFor,
    checkedAt: now.toISOString(),
  };
}

/**
 * The AI couldn't write a report (down, refused, timed out). The closest
 * results are listed as possible matches only, with no claims, so the reader
 * can look for themselves. Never shown as a finished investigation.
 */
export function reportFailed(
  req: StoryRequest,
  candidates: Scored[],
  grouping: Grouping,
  kinds: SourceKind[],
  publishers: string[],
  setAsideEarly: number,
  searchedFor: string,
  now: Date,
  goodScore: number,
): StoryReport {
  const close = candidates.map((c, i) => ({ c, i })).filter(({ c }) => c.score >= goodScore && !c.dateMismatch).slice(0, 3);
  const sources: ReportSource[] = close.map(({ c, i }, k) => ({
    n: k + 1,
    title: clip(c.hit.title, 200),
    publisher: publishers[i] ?? '',
    url: c.hit.url,
    ...(c.hit.published ? { published: c.hit.published } : {}),
    kind: kinds[i]!,
    match: 'possible',
    ...(grouping.via[i] ? { via: grouping.via[i] } : {}),
    ...(canonicalKey(c.hit.url) === canonicalKey(req.url) ? { original: true } : {}),
  }));
  return {
    ...emptyReport('no-match', setAsideEarly + candidates.length - close.length, [], searchedFor, now),
    status: 'report-failed',
    match: sources.length ? 'possible' : 'none',
    sources,
  };
}
