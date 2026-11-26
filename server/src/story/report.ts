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
 */
import type { AiReport } from './analyse.js';
import type { Claim, InvestigationConfidence, MatchStatus, ReportNote, ReportSource, SourceKind, StoryReport, StoryRequest } from './contract.js';
import { capMatch, type LinkProfile, type Scored } from './match.js';
import { canonicalKey, type Grouping } from './sources.js';
import { clip, daysBetween } from './text.js';

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
      if (text && sources.length) out.push({ text, sources });
      if (out.length >= max) break;
    }
    return out;
  };
  const whatHappened = factual(ai.what_happened, 3);
  const seenLabels = new Set<string>();
  const details = ai.details
    .map((d) => ({ label: d.label, text: cleanText(d.text), sources: cite(d.sources) }))
    .filter((d): d is Claim & { label: typeof d.label } => Boolean(d.text) && d.sources.length > 0 && !seenLabels.has(d.label) && Boolean(seenLabels.add(d.label)))
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

  const subject = cleanText(ai.subject) ?? req.headline?.text;
  const written = whatHappened.length > 0 || facts.length > 0;
  return {
    ...base,
    status: written ? 'report' : 'report-failed',
    ...(subject ? { subject: clip(subject, 140) } : {}),
    match,
    confidence: written ? confidence : 'insufficient',
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
