/**
 * Headline accuracy: does the link's headline say what the matched reporting
 * establishes? Four verdicts (D74, tightened in D76):
 *
 * - accurate: the reporting establishes what the headline claims;
 * - partly accurate: its main event is supported, but a specific secondary
 *   detail is shown to be wrong (the reports give a different number, or
 *   deny it), or isn't in an article LinkPeek read in full;
 * - misleading: the reporting positively shows a material discrepancy: the
 *   reports deny it, describe a different outcome ("dies" when they say
 *   hospital, "arrested" when they say questioned, "collapses" when they say
 *   financial difficulty, "cures" when they say an early trial), give a
 *   different number, or only allege what the headline states as fact;
 * - unverified: not enough to judge.
 *
 * Claude proposes the verdict with a reason and quoted passages. The rules
 * here can only make it more cautious, and each verdict needs an
 * identifiable basis (HeadlineBasis) the rules found themselves:
 *
 * - No headline, a vague link, or no strong match from a source that can
 *   corroborate (a news agency, a news organisation or an official source):
 *   unverified. A headline is never judged against social media or opinion,
 *   nor against headlines: only the reports' own text counts (another
 *   outlet's headline, or the linked article's own, proves nothing).
 * - Every verdict but unverified needs a real quoted passage from that text.
 * - Accurate needs every event, name and number in the headline found in the
 *   reports, with none they deny, dispute or only allege.
 * - Misleading needs positive evidence, as above. Something simply missing
 *   from the reports is never enough: a short search excerpt leaves most of
 *   an article out. Dramatic wording is never enough either.
 * - Partly accurate needs the main event supported and an identified detail:
 *   contradicted, or missing from every report when at least one was read in
 *   full. Missing only from excerpts, it's unverified. A supporting passage
 *   alone is not enough.
 * - Reports that disagree about what the headline says rule out accurate and
 *   misleading alike: unverified.
 *
 * This complements the clickbait check (src/core/headline), which judges
 * wording; this judges what the headline claims against the evidence.
 */
import type { EvidenceDepth, HeadlineBasis, HeadlineCheck, HeadlineVerdict } from './contract.js';
import { eventsIn, isAllegation, onlyAlleged, polarity, quoteFound, unsupportedEvents, unsupportedSpecifics, type Quote } from './evidence.js';
import type { SearchHit } from './providers/types.js';
import { clip, terms, words } from './text.js';

export interface AiHeadline {
  verdict: HeadlineVerdict;
  reason: string;
  evidence: Quote[];
}

export interface HeadlineInput {
  /** The headline as the link gave it, if it gave one. */
  headline?: string;
  ai?: AiHeadline;
  vague: boolean;
  hits: SearchHit[];
  /** Indexes of strong matches from sources that can corroborate (agency, news organisation, official). */
  eligible: number[];
  /** Prompt id (index + 1) to report number. */
  number: Map<number, number>;
  extras: string[][];
  /** Cleans AI text the way report.ts does (links, markup, relative dates). */
  clean: (s: string) => string | undefined;
  /** How much of each article LinkPeek has, by index (D75). Without it, everything counts as an excerpt. */
  depths?: EvidenceDepth[];
}

export const RULE_REASON = {
  noEvidence: "There isn't enough matching reporting to judge the headline.",
  noPassage: "There isn't a passage from the reports' own text to judge the headline against.",
  notShown: "The reports found don't clearly support everything the headline says.",
  noDiscrepancy: "The reports found don't show what's wrong with the headline.",
  excerptsOnly: 'The search extracts are too short to check every detail of the headline: it may be further down the articles.',
  disputed: 'The reports disagree about what the headline says.',
  mainNotShown: "The reports found don't establish the headline's main claim.",
};

/** Outcomes reported instead of a headline's event: positive evidence that the event didn't happen as stated. */
const INSTEAD: Record<string, RegExp> = {
  death: /\b(hospital|hospitali[sz]ed|injured|critical condition|stable condition|recovering|survived|alive|treated for)\b/i,
  kill: /\b(injured|wounded|hurt|hospital|survived)\b/i,
  arrest: /\b(questioned|questioning|interviewed|helping (police|officers)|released without charge|voluntary interview)\b/i,
  charge: /\b(questioned|released without charge|released on bail|under investigation|no decision on charges)\b/i,
  convict: /\b(on trial|acquitted|cleared|awaiting trial|denies the charges)\b/i,
  jail: /\b(suspended sentence|fined|community order|acquitted|bail)\b/i,
  resign: /\b(remains in (post|office)|will stay on|refused to resign|has been suspended)\b/i,
  collapse: /\b(financial difficult(y|ies)|struggling|seeking (new )?invest(ment|ors)|rescue (deal|talks)|losses|cost[- ]cutting)\b/i,
  bankrupt: /\b(financial difficult(y|ies)|struggling|seeking (new )?invest(ment|ors)|rescue (deal|talks)|losses)\b/i,
  cure: /\b(trial|study|symptoms|early results|small group of patients)\b/i,
};

const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
};
const NUMBER = new RegExp(`(?<![\\p{L}\\p{N}])(\\d[\\d,.]*\\d|\\d|${Object.keys(NUMBER_WORDS).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/** Each number in a text with the words just before and after it ("aged 41", "seven injured"), as digits. */
function numbersWithContext(text: string): { n: string; near: string[] }[] {
  const out: { n: string; near: string[] }[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const raw = m[1]!.toLowerCase();
    const n = NUMBER_WORDS[raw] ?? raw.replace(/[,.](?=\d{3}\b)/g, '');
    const before = words(text.slice(Math.max(0, m.index! - 30), m.index!)).slice(-1);
    const after = words(text.slice(m.index! + m[0].length, m.index! + m[0].length + 30)).slice(0, 1);
    out.push({ n, near: [...before, ...after].flatMap((w) => terms(w)) });
  }
  return out;
}

export interface HeadlineFindings {
  /** Shown wrong by the reports themselves: a denial, a different outcome, a different number. */
  contradicted: string[];
  /** Stated as fact, only alleged in the reports. */
  alleged: string[];
  /** The reports disagree. */
  disputed: string[];
  /** The headline's events no report states (and none contradicts). */
  missingEvents: string[];
  /** Its names and numbers no report has (and none contradicts). */
  missingDetails: string[];
  /** The headline's main event, or with no event word most of its words, is in the reports. */
  mainSupported: boolean;
}

/**
 * What the reports' own text (never headlines) shows about a headline: what
 * they contradict, only allege or dispute, and what's simply missing.
 */
export function findings(headline: string, texts: string[], bodies: SearchHit[], extras: string[]): HeadlineFindings {
  const f: HeadlineFindings = { contradicted: [], alleged: [], disputed: [], missingEvents: [], missingDetails: [], mainSupported: false };
  const all = texts.join(' ¶ ');
  const asserted = eventsIn(headline).asserted;
  const unsupported = new Set(unsupportedEvents(headline, texts));
  const qualified = words(headline).some(isAllegation);
  for (const e of asserted) {
    if (!qualified && onlyAlleged(e, texts)) f.alleged.push(e);
    if (!unsupported.has(e)) continue;
    const denied = texts.some((t) => eventsIn(t).negated.has(e));
    if (denied || (INSTEAD[e] && INSTEAD[e]!.test(all))) f.contradicted.push(e);
    else f.missingEvents.push(e);
  }

  // Words the headline states that the reports mention only to deny, or that some deny and others state.
  const said = texts.map(polarity);
  for (const [w, signs] of polarity(headline)) {
    if (signs.size !== 1 || !signs.has('+')) continue;
    const mentions = said.map((p) => p.get(w)).filter((x): x is Set<'+' | '-'> => Boolean(x));
    const denied = mentions.filter((m) => m.size === 1 && m.has('-')).length;
    if (mentions.length && denied === mentions.length) f.contradicted.push(w);
    else if (denied) f.disputed.push(w);
  }

  // Numbers: one the reports give differently next to the same word is contradicted; one they don't have is missing.
  const theirs = numbersWithContext(all);
  const have = new Set(theirs.map((x) => x.n));
  for (const { n, near } of numbersWithContext(headline)) {
    if (have.has(n)) continue;
    if (theirs.some((x) => x.n !== n && x.near.some((w) => near.includes(w)))) f.contradicted.push(n);
    else f.missingDetails.push(n);
  }
  // Names the reports don't have.
  for (const s of unsupportedSpecifics(headline, bodies, extras, [], { allowTitleCase: false })) if (!/^\d/.test(s) && !f.missingDetails.includes(s)) f.missingDetails.push(s);

  const eventsOk = [...asserted].every((e) => !unsupported.has(e)) && !f.alleged.length;
  if (asserted.size) f.mainSupported = eventsOk && !f.contradicted.some((c) => asserted.has(c));
  else {
    const core = [...new Set(terms(headline).filter((t) => !/^\d/.test(t)))];
    const reported = new Set(terms(all));
    f.mainSupported = core.length > 0 && core.filter((t) => reported.has(t)).length / core.length >= 0.6 && !f.contradicted.some((c) => core.includes(c));
  }
  return f;
}

/** The reports' own text, without their headlines: a headline isn't evidence for a headline. */
function body(hit: SearchHit): string {
  return [hit.description ?? '', ...hit.passages, ...(hit.text ?? [])].filter(Boolean).join(' ¶ ');
}

export function assessHeadline(input: HeadlineInput): HeadlineCheck | undefined {
  const headline = input.headline?.trim();
  if (!headline) return undefined;
  const verdict = (v: HeadlineVerdict, reason: string, evidence: HeadlineCheck['evidence'], basis: HeadlineBasis): HeadlineCheck => ({ headline, verdict: v, reason, evidence, basis });
  const unverified = (reason: string, basis: HeadlineBasis = { kind: 'insufficient' }, evidence: HeadlineCheck['evidence'] = []) => verdict('unverified', reason, evidence, basis);
  if (input.vague || !input.eligible.length) return unverified(RULE_REASON.noEvidence);

  const texts = input.eligible.map((i) => body(input.hits[i]!)).filter(Boolean);
  if (!texts.length) return unverified(RULE_REASON.noEvidence);
  const bodies = input.eligible.map((i) => ({ ...input.hits[i]!, title: '' }));
  const extras = input.eligible.flatMap((i) => input.extras[i] ?? []);
  const f = findings(headline, texts, bodies, extras);
  // Something missing means something only when an article was read in full, not from an excerpt.
  const readInFull = input.eligible.some((i) => input.depths?.[i] === 'full');

  const ai = input.ai;
  // Only real passages from the reports' own text count as the headline's evidence.
  const evidence = (ai?.evidence ?? [])
    .filter((q) => input.eligible.includes(q.source - 1) && quoteFound(q.quote, body(input.hits[q.source - 1]!)))
    .map((q) => ({ source: input.number.get(q.source)!, quote: clip(q.quote.trim(), 300) }))
    .filter((q) => q.source !== undefined)
    .slice(0, 3);
  // The reason may not add names or numbers the sources don't have either.
  const reason = ai ? input.clean(ai.reason) : undefined;
  const reasonOk = reason && !unsupportedSpecifics(reason, bodies, extras).length ? reason : undefined;

  if (!ai || ai.verdict === 'unverified') return unverified(reasonOk ?? RULE_REASON.noEvidence, { kind: 'insufficient' }, evidence);
  if (!evidence.length) return unverified(RULE_REASON.noPassage);

  const positive: HeadlineBasis | undefined = f.contradicted.length ? { kind: 'contradicted', terms: f.contradicted } : f.alleged.length ? { kind: 'alleged', terms: f.alleged } : undefined;
  const disputed: HeadlineBasis | undefined = f.disputed.length ? { kind: 'disputed', terms: f.disputed } : undefined;
  const missing = [...f.missingEvents, ...f.missingDetails];

  if (ai.verdict === 'accurate') {
    if (positive) return unverified(RULE_REASON.notShown, positive, evidence);
    if (disputed) return unverified(RULE_REASON.disputed, disputed, evidence);
    if (missing.length || !f.mainSupported) return unverified(readInFull ? RULE_REASON.notShown : RULE_REASON.excerptsOnly, { kind: readInFull ? 'unsupported' : 'insufficient', terms: missing }, evidence);
    return verdict('accurate', reasonOk ?? '', evidence, { kind: 'supported' });
  }
  if (ai.verdict === 'misleading') {
    // Positive evidence only: a detail that's merely missing never makes a headline misleading.
    if (positive) return verdict('misleading', reasonOk ?? RULE_REASON.notShown, evidence, positive);
    if (disputed) return unverified(RULE_REASON.disputed, disputed, evidence);
    return unverified(missing.length && !readInFull ? RULE_REASON.excerptsOnly : RULE_REASON.noDiscrepancy, { kind: 'insufficient', ...(missing.length ? { terms: missing } : {}) }, evidence);
  }
  // Partly accurate: the main event supported, and a detail identified as wrong or, read in full, unsupported.
  if (!f.mainSupported) return unverified(RULE_REASON.mainNotShown, positive ?? { kind: 'insufficient', ...(missing.length ? { terms: missing } : {}) }, evidence);
  if (positive) return verdict('partly-accurate', reasonOk ?? RULE_REASON.notShown, evidence, positive);
  if (disputed) return unverified(RULE_REASON.disputed, disputed, evidence);
  if (f.missingDetails.length && readInFull) return verdict('partly-accurate', reasonOk ?? RULE_REASON.notShown, evidence, { kind: 'unsupported', terms: f.missingDetails });
  return unverified(f.missingDetails.length ? RULE_REASON.excerptsOnly : RULE_REASON.noDiscrepancy, { kind: 'insufficient', ...(f.missingDetails.length ? { terms: f.missingDetails } : {}) }, evidence);
}
