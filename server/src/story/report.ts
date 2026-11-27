/**
 * Turns the AI's reply into the report the extension shows, applying the
 * rules the AI can't overrule:
 *
 * - A source is a match only if the AI says so AND the rule-based checks
 *   allow it (match.ts). Sources that aren't matches are removed, with every
 *   claim that relied only on them.
 * - **Every claim carries its own evidence** (evidence.ts): for each source it
 *   cites, a passage copied from that source, which must really be there.
 *   Its names, numbers, dates and main event must be in the sources it
 *   cites, not in some other result. A citation without a real passage is
 *   removed; a claim left with none is dropped. A claim whose own passages
 *   don't carry it is marked weak and never counted as confirmed.
 * - **Dates**: an event date must be written in a cited source, or follow
 *   exactly from a weekday or "yesterday" in it and its publication date. A
 *   publication or update date is never taken as the event's (D71).
 * - **"Confirmed" is decided here, not by the AI**: stated by strong matches
 *   from two independent groups of news agencies or recognised news
 *   organisations (syndicated copies count once), or, for what an official
 *   body itself announced, by that official source. Opinion, social media
 *   and unrecognised sites never confirm anything (D70). Everything else is
 *   "reported, not confirmed".
 * - **"What remains unclear?"** may say what's missing without a source, but
 *   anything specific there (a name, a number, a date, an allegation) needs
 *   the same evidence as a fact, so it can't bring in a suspect or a rumour
 *   the sources never mention. A disagreement must quote both sides (D72).
 * - The AI's confidence can be lowered, never raised: "strong evidence"
 *   needs strong matches with independent corroboration (sources.ts,
 *   wellSupported), a confirmed fact, and more than snippets to go on;
 *   "conflicting" needs a quoted disagreement.
 * - **Headline accuracy** is checked against the evidence (headline.ts).
 * - Sentences with "yesterday", "today" and the like are dropped: on a card
 *   read later they'd be wrong. Links and markup are removed from AI text.
 * - A link with no name and no date gets no written report at all, only the
 *   closest results as possible matches, each with its date (D68).
 * - If everything the AI wrote is dropped for stating what no source says,
 *   its matching isn't trusted either: no reliable match (D65).
 */
import type { AiClaim, AiReport } from './analyse.js';
import type { Claim, Evidence, InvestigationConfidence, MatchStatus, ReportNote, ReportSource, SourceKind, StoryReport, StoryRequest } from './contract.js';
import { checkClaim, datesWritten, isAllegation, unsupportedSpecifics, type ClaimCheck, type ClaimContext } from './evidence.js';
import { assessHeadline } from './headline.js';
import { capMatch, type LinkProfile, type Scored } from './match.js';
import { ATTRIBUTED, canonicalKey, corroborates, corroboratingGroups, wellSupported, type Grouping } from './sources.js';
import { clip, daysBetween, words } from './text.js';

const RELATIVE_DATE = /\b(yesterday|today|tonight|tomorrow|last night|this (morning|afternoon|evening))\b/i;
const MAX_SENTENCE = 320;
/** A story whose newest source is this recent may still be developing. */
const FRESH_DAYS = 2;
/** "No source reviewed reports...", "isn't established": saying what's missing. */
const ABSENCE = /\b(no|none of the|not one of the)\b[^.]{0,60}\b(sources?|reports?|results?)\b|\bsources?( reviewed)? (do not|don't|did not|didn't|does not|doesn't)\b|\b(is not|isn't|was not|wasn't|are not|aren't|not|has not been|have not been|hasn't been|haven't been)( yet)? (established|confirmed|known|reported|clear|given|stated|said)\b/i;
/** Saying that sources disagree... */
const DISAGREE = /\b(while|whereas|but|however|differ|differs|disagree|disagrees|contradict|contradicts|conflicting|another source|other sources?|one source)\b|\bsays?\b[^;]*;[^;]*\bsays?\b/i;
/** ...about what particular sources say. */
const SOME_SOURCES = /\b(one|another|other|some|two|both) (sources?|reports?|outlets?)\b/i;
const NO_DATE = "The sources reviewed don't establish when this happened.";

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
  /** Results left out because their publisher withdrew them (hygiene.ts). */
  withdrawn?: number;
  searchedFor: string;
  now: Date;
  /** Filled in: sentences dropped for stating what their sources don't say, for having no real evidence, and kept but weak. */
  stats?: Stats;
}

export interface Stats {
  ungrounded: number;
  unverified: number;
  weak: number;
  /** Claims a cited source's own passage contradicts (dropped, or kept as weak). */
  contradicted: number;
}

function cleanText(s: string): string | undefined {
  const t = clip(s.replace(/https?:\/\/\S+/g, '').replace(/[*_`#<>]/g, '').replace(/\s+/g, ' '), MAX_SENTENCE);
  if (!t || RELATIVE_DATE.test(t)) return undefined;
  return t;
}

/**
 * "Source 2 says..." means the prompt's source 2, which may be numbered
 * differently on the card: name it by its site instead. (These numbers are
 * citations, not facts, so they aren't checked as numbers either.)
 */
function nameSources(text: string, publishers: string[]): string {
  const pub = (n: string) => publishers[Number(n) - 1];
  return text
    .replace(/\b([Ss])ources (\d+) and (\d+)\b/g, (whole, _s, a: string, b: string) => (pub(a) && pub(b) ? `${pub(a)} and ${pub(b)}` : whole))
    .replace(/\b([Ss])ource (\d+)\b/g, (whole, _s, n: string) => pub(n) ?? whole);
}

/** A checked claim, with its citations renumbered for the report. */
type Checked = Claim & { cited: number[] };

export function finalise(input: FinaliseInput): StoryReport {
  const { req, profile, candidates, grouping, kinds, publishers, ai, now } = input;
  const today = now.toISOString().slice(0, 10);
  const hits = candidates.map((c) => c.hit);

  // 1. Which sources are matches, after the rules.
  const status: MatchStatus[] = candidates.map((c, i) => {
    const said = ai.matches.find((m) => m.source === i + 1)?.status ?? 'none';
    return capMatch(said, c, profile);
  });
  const kept = candidates.map((_, i) => i).filter((i) => status[i] !== 'none');
  const number = new Map(kept.map((i, k) => [i + 1, k + 1]));
  const strongIdx = new Set(kept.filter((i) => status[i] === 'strong'));
  // Matches whose dates don't fit this story can't be evidence for it (see ctx below). When they're all there is,
  // nothing was found about this story: an older (or much later) one was left out.
  const fitting = kept.filter((i) => !candidates[i]!.dateMismatch);
  const rejectedOlder = candidates.some((c, i) => (status[i] === 'none' || !fitting.includes(i)) && c.dateMismatch) || input.olderSetAside;
  const setAside = input.setAsideEarly + (candidates.length - kept.length);
  const stats = input.stats ?? { ungrounded: 0, unverified: 0, weak: 0, contradicted: 0 };
  const extras = candidates.map((_, i) => [publishers[i] ?? '', grouping.via[i] ?? ''].filter(Boolean));
  // A result whose date doesn't fit this story (an older story about the same person) may be listed as a possible
  // match, but nothing it says is evidence for this one: its details must not be mixed in.
  const ctx: ClaimContext = { hits, kept: new Set(fitting), extras, linkNames: profile.names };
  /** An allegation needs a passage that makes it ("is accused of", "suspected"), not one that only names the person. */
  const allegationShown = (text: string, r: ClaimCheck) => !words(text).some(isAllegation) || r.quotes.some((q) => words(q.quote).some(isAllegation));

  const base = {
    setAside,
    searchedFor: input.searchedFor,
    checkedAt: now.toISOString(),
  };
  const withdrawnNote: ReportNote[] = input.withdrawn ? ['withdrawn'] : [];
  if (!fitting.length) {
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
      notes: [...(rejectedOlder ? (['older-story'] as const) : []), ...withdrawnNote],
    };
  }

  // 2. Claims, each checked against its own evidence, with citations renumbered.
  const toClaim = (text: string, r: ClaimCheck): Checked => {
    // One passage per cited source, the first that checked out: enough to show where the claim comes from.
    const evidence: Evidence[] = r.cited.map((i) => ({ source: number.get(i + 1)!, quote: clip(r.quotes.find((q) => q.i === i)!.quote, 300) })).sort((a, b) => a.source - b.source);
    return { text, sources: r.cited.map((i) => number.get(i + 1)!).sort((a, b) => a - b), evidence, ...(r.weak ? { weak: true } : {}), cited: r.cited };
  };
  const clean = (raw: string) => cleanText(nameSources(raw, publishers));
  const verify = (c: AiClaim): Checked | undefined => {
    const text = clean(c.text);
    if (!text) return undefined;
    const r = checkClaim(text, c.evidence ?? [], ctx);
    if (r.contradicted.length) stats.contradicted++;
    if (!r.ok) {
      if (r.reason === 'no-evidence') stats.unverified++;
      else if (r.reason !== 'contradicted') stats.ungrounded++;
      return undefined;
    }
    if (!allegationShown(text, r)) {
      stats.unverified++;
      return undefined;
    }
    if (r.weak) stats.weak++;
    return toClaim(text, r);
  };
  const factual = (list: AiClaim[], max: number): Checked[] => {
    const out: Checked[] = [];
    for (const c of list) {
      const v = verify(c);
      if (v) out.push(v);
      if (out.length >= max) break;
    }
    return out;
  };
  const whatHappened = factual(ai.what_happened, 3);
  const seenLabels = new Set<string>();
  const details: (Checked & { label: AiReport['details'][number]['label'] })[] = [];
  for (const d of ai.details) {
    if (seenLabels.has(d.label) || details.length >= 5) continue;
    const v = verify(d);
    if (!v) continue;
    seenLabels.add(d.label);
    details.push({ label: d.label, ...v });
  }
  const facts = factual(ai.facts, 6);

  // 3. "What remains unclear?": what's missing may be said plainly; anything specific needs evidence like a fact.
  const unclear: Checked[] = [];
  let quotedDisagreement = false;
  for (const c of ai.unclear) {
    if (unclear.length >= 4) break;
    const text = clean(c.text);
    if (!text) continue;
    const absence = ABSENCE.test(text);
    // Saying the link's own claim isn't in the sources ("no source reports a resignation in Zarnwick") may use the link's names.
    const specifics = unsupportedSpecifics(text, [], [], absence ? [] : profile.names).filter((w) => !(absence && profile.names.some((n) => n.toLowerCase().split(/\s+/).includes(w))));
    const alleges = words(text).some(isAllegation);
    // A disagreement names who says what: two of the sites, or "one source ... another".
    const named = kept.filter((i) => (publishers[i] ?? '').length > 2 && text.toLowerCase().includes(publishers[i]!.toLowerCase())).length;
    const disagreement = DISAGREE.test(text) && (named >= 2 || SOME_SOURCES.test(text));
    if (!specifics.length && !alleges && !disagreement) {
      unclear.push({ text, sources: [], cited: [] });
      continue;
    }
    // Both sides of a disagreement are quoted here, so a passage saying the opposite is expected.
    const r = checkClaim(text, c.evidence ?? [], { ...ctx, linkNames: absence ? [] : profile.names }, { opposites: false });
    // An unclear point questions an event rather than stating it, so a missing event word isn't held against it.
    const ok = (r.ok || (r.reason === 'unsupported-event' && r.cited.length > 0)) && (!alleges || (!r.weak && allegationShown(text, r)));
    if (!ok || (disagreement && new Set(r.cited.map((i) => grouping.group[i])).size < 2)) {
      if (r.reason === 'no-evidence' || !r.cited.length) stats.unverified++;
      else stats.ungrounded++;
      continue;
    }
    if (disagreement) quotedDisagreement = true;
    unclear.push(toClaim(text, { ...r, ok: true }));
  }

  // 4. Confirmed or only reported: decided by independent corroboration among strong matches.
  const confirmed: Checked[] = [];
  const reported: Checked[] = [];
  for (const f of facts) {
    const strong = f.cited.filter((i) => strongIdx.has(i));
    const corroborated = corroboratingGroups(strong, grouping, kinds) >= 2;
    // An official body can establish what it itself announced, not every detail of an event.
    const announced = strong.some((i) => kinds[i] === 'primary') && ATTRIBUTED.test(f.text);
    (!f.weak && (corroborated || announced) ? confirmed : reported).push(f);
  }

  // 5. Overall match and confidence. Lowered by the rules, never raised.
  const match: MatchStatus = strongIdx.size ? 'strong' : 'possible';
  const keptGroups = new Set(kept.map((i) => grouping.group[i]));
  let confidence: InvestigationConfidence = ai.confidence;
  if ((ai.conflicting || confidence === 'conflicting') && quotedDisagreement) confidence = 'conflicting';
  else if (confidence === 'conflicting') confidence = 'partial';
  if (confidence === 'strong') {
    // A source contradicting part of the report rules out strong evidence.
    const enough = match === 'strong' && wellSupported([...strongIdx], grouping, kinds) && confirmed.length > 0 && !input.snippetsOnly && !stats.contradicted;
    if (!enough) confidence = 'partial';
  }

  // 6. Notes.
  const notes: ReportNote[] = [];
  // A link with no name and no date can't be pinned to one story (match.ts caps it at "possible"):
  // say so first, and don't put a name forward as its subject.
  const vague = !profile.names.length && !profile.date;
  if (vague) notes.push('vague-link');
  if (keptGroups.size === 1) notes.push('single-source');
  if (!kept.some((i) => corroborates(kinds[i]!) || kinds[i] === 'primary')) notes.push('no-established-sources');
  if (kept.some((i) => grouping.copyOf[i] !== undefined)) notes.push('syndicated');
  const newest = kept.map((i) => candidates[i]!.hit.published).filter((d): d is string => Boolean(d)).sort().pop();
  const fresh = newest !== undefined && (daysBetween(newest, today) ?? Infinity) <= FRESH_DAYS;
  if (ai.developing || fresh) notes.push('developing');
  if (input.snippetsOnly) notes.push('snippets-only');
  if (rejectedOlder) notes.push('older-story');
  notes.push(...withdrawnNote);

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
      ...(h.updated ? { updated: h.updated } : {}),
      kind: kinds[i]!,
      match: status[i] as 'strong' | 'possible',
      ...(copyOf !== undefined ? { copyOf } : {}),
      ...(grouping.via[i] ? { via: grouping.via[i] } : {}),
      ...(h.corrected ? { corrected: true } : {}),
      ...(canonicalKey(h.url) === canonicalKey(req.url) ? { original: true } : {}),
    };
  });

  if (vague) {
    // A link with no name and no date can't be pinned to one story: live, "Pop star found dead in hotel room"
    // found deaths from 1997, 2012 and 2024. Write about none of them: a "What happened?" about one would put
    // a person forward and could read as current news. List what was found instead, each with its date.
    return {
      ...base,
      status: 'report',
      match: 'possible',
      confidence: 'insufficient',
      whatHappened: [],
      details: [],
      confirmed: [],
      reported: [],
      unclear: [],
      sources: sources.map((s) => ({ ...s, match: 'possible' as const })),
      // "Older story left out" and "developing" are judged against a story; here there isn't one.
      notes: notes.filter((n) => n !== 'older-story' && n !== 'developing'),
    };
  }

  // The AI's subject must not add a name or number either; with none, the link's own headline stands in.
  const keptHits = kept.map((i) => hits[i]!);
  const keptExtras = kept.flatMap((i) => extras[i] ?? []);
  const aiSubject = clean(ai.subject);
  let subject: string | undefined = req.headline?.text;
  if (aiSubject) {
    if (unsupportedSpecifics(aiSubject, keptHits, keptExtras, profile.names).length) {
      stats.ungrounded++;
      subject = undefined;
    } else subject = aiSubject;
  }
  const written = whatHappened.length > 0 || facts.length > 0;
  if (!written) {
    // The AI's report stated things no source says: its matching can't be trusted either. Nothing is shown.
    if (stats.ungrounded > 0) {
      return { ...base, setAside: input.setAsideEarly + candidates.length, status: 'no-match', match: 'none', confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [], sources: [], notes: [...(rejectedOlder ? (['older-story'] as const) : []), ...withdrawnNote] };
    }
    // Nothing usable was written: the closest sources are listed as possible matches, with no claims at all.
    return { ...base, status: 'report-failed', match, confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [], sources, notes };
  }

  // When nothing written gives the event's date, say so rather than leave it to be guessed from publication dates.
  const dated = [...whatHappened, ...details, ...facts].some((c) => datesWritten(c.text).length > 0 || /\b(on|last) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(c.text));
  if (!dated && !unclear.some((c) => /\b(when|date|day)\b/i.test(c.text)) && unclear.length < 4) unclear.push({ text: NO_DATE, sources: [], cited: [] });

  // 7. Headline accuracy, against strong matches from sources that can corroborate or are official.
  const eligible = [...strongIdx].filter((i) => corroborates(kinds[i]!) || kinds[i] === 'primary');
  const headlineText = req.headline && req.headline.confidence !== 'low' ? req.headline.text : undefined;
  const headline = assessHeadline({ headline: headlineText, ai: ai.headline, vague, hits, eligible, number, extras, clean });

  const strip = <T extends Checked>(c: T): Omit<T, 'cited'> => {
    const rest: Omit<T, 'cited'> & { cited?: number[] } = { ...c };
    delete rest.cited;
    return rest;
  };
  // With no news agency, news organisation or official source among the matches (only social posts, opinion or
  // unknown sites), nothing is stated as what happened: every sentence is only reported (D70). Two posts saying
  // someone has died must not read as a death that happened.
  const established = !notes.includes('no-established-sources');
  const onlyReported = established ? reported : [...whatHappened.filter((w) => !reported.some((r) => r.text === w.text)), ...reported].slice(0, 6);
  return {
    ...base,
    status: 'report',
    ...(subject ? { subject: clip(subject, 140) } : {}),
    match,
    confidence,
    whatHappened: established ? whatHappened.map(strip) : [],
    details: established ? details.map(strip) : [],
    confirmed: confirmed.map(strip),
    reported: onlyReported.map(strip),
    unclear: unclear.map(strip),
    sources,
    notes,
    ...(headline ? { headline } : {}),
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
