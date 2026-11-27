/**
 * Report-quality checks for Story Search reports.
 *
 * Eleven checks per report, each pass, fail, "review" (a person should look)
 * or n/a. They test the structure strictly and the facts as far as a program
 * can: whether each cited source has a passage of its own that really is in
 * that source, whether a claim's words and numbers appear in the sources it
 * cites, whether a date could only have come from an article's publication
 * date, whether "confirmed" rests on independent news or agency reports (or
 * an official source), and whether the headline verdict is the expected one.
 * A passage being in a source doesn't show it supports the claim. A program
 * can't tell whether a claim is true, so every factual claim is also listed
 * for a person to check against its sources, and factual accuracy is never
 * marked as passed on the strength of well-formed output alone.
 */
import type { ReportSource, StoryReport } from '../../../server/src/story/contract';
import type { SearchHit } from '../../../server/src/story/providers/types';
import { publisherName, sourceKind } from '../../../server/src/story/sources';
import { terms } from '../../../server/src/story/text';

export type CheckStatus = 'pass' | 'fail' | 'review' | 'n/a';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

/** What a case expects. Patterns are tested against the report's own text. */
export interface Expectation {
  /** Allowed outcomes: a report status, or "insufficient" when nothing was sent, or "error:<code>". */
  outcome: string[];
  match?: StoryReport['match'][];
  confidence?: StoryReport['confidence'][];
  subject?: { must?: RegExp[]; mustNot?: RegExp[]; absent?: boolean };
  names?: RegExp[];
  eventDate?: RegExp[];
  locations?: RegExp[];
  facts?: RegExp[];
  /** Must not appear in any factual sentence: the wrong story, invented causes, wrong years. */
  forbidden?: RegExp[];
  /** Must not appear under "What remains unclear?": a rumoured suspect, an allegation no source makes. */
  unclearForbidden?: RegExp[];
  /** Each pair must not both appear in the factual sections (two versions stated as fact). */
  contradictions?: [RegExp, RegExp][];
  /** Disputed values: each must appear under "What remains unclear?" and none in "What is confirmed?". */
  disputed?: RegExp[];
  notes?: StoryReport['notes'];
  forbiddenNotes?: StoryReport['notes'];
  /** Sections that must be empty. */
  empty?: ('whatHappened' | 'details' | 'confirmed' | 'reported')[];
  minSources?: number;
  /** At least one source from these sites. */
  hostsAnyOf?: string[];
  /** Results at these addresses (a part of the address is enough) may be listed only as possible matches, and never cited. */
  notStrong?: string[];
  /** The headline verdict expected (headline accuracy, D74), or that there is none. */
  headline?: ('accurate' | 'partly-accurate' | 'misleading' | 'unverified')[] | 'absent';
  /** Facts that must be under "What is confirmed?" (pattern), and ones that must not be. */
  confirmedMust?: RegExp[];
  confirmedNever?: boolean;
  /** May be reported, never under "What is confirmed?" (rests on one independent source). */
  notConfirmed?: RegExp[];
  /** Which search services must have answered. */
  providersUsed?: string[];
}

export interface ReviewClaim {
  section: string;
  text: string;
  sources: { n: number; publisher: string; url: string; published?: string }[];
  /** Share of the claim's meaningful words found in its cited sources (0 to 1). */
  support: number;
  flags: string[];
  /** The cited passage that best matches, shortened, for the reviewer. */
  evidence?: string;
}

export interface Validation {
  checks: Check[];
  review: ReviewClaim[];
  /** No check failed. Facts still need a person: see review. */
  passed: boolean;
}

const RELATIVE = /\b(yesterday|today|tonight|tomorrow|last night|this (morning|afternoon|evening))\b/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hitText(h: SearchHit | undefined): string {
  return h ? [h.title, h.description ?? '', ...h.passages].join(' ') : '';
}

/** For checking quotes independently of the backend: case, accents, spacing and quote styles don't matter. */
function plainText(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[‘’`´]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function quoteIn(quote: string, hit: SearchHit | undefined): boolean {
  if (!hit) return false;
  const parts = [hit.title, hit.description ?? '', ...hit.passages].map(plainText);
  const pieces = quote.split(/\s*(?:\.{3}|…)\s*/).map((p) => plainText(p).replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, '')).filter(Boolean);
  return parts.some((t) => {
    let from = 0;
    for (const p of pieces) {
      const at = t.indexOf(p, from);
      if (at < 0) return false;
      from = at + p.length;
    }
    return pieces.length > 0;
  });
}

function check(id: string, label: string, status: CheckStatus, detail: string): Check {
  return { id, label, status, detail };
}

function missing(patterns: RegExp[] | undefined, text: string): RegExp[] {
  return (patterns ?? []).filter((p) => !p.test(text));
}

/** Independent groups among cited sources: a repeat belongs to the source it repeats; an agency's copies to the agency. */
function groupOf(s: ReportSource, all: ReportSource[]): string {
  if (s.copyOf !== undefined) {
    const original = all.find((o) => o.n === s.copyOf);
    if (original) return groupOf(original, all);
  }
  if (s.via) return `via:${s.via}`;
  return `n:${s.n}`;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DATE_RE = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/gi;

/**
 * The numbers a sentence states, as digit runs ("1,300" is 1 and 300, "9:45" is 9 and 45), with full
 * dates left out: the date check judges those, against both the text and the publication dates.
 */
function numbersIn(text: string): string[] {
  return text.replace(DATE_RE, ' ').match(/\d+/g) ?? [];
}

function digitSet(text: string): Set<string> {
  return new Set((text.match(/\d+/g) ?? []).flatMap((d) => [d, String(Number(d))]));
}

/** "21 April 2025" / "April 21, 2025" in a sentence, as YYYY-MM-DD. */
function datesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const day = Number(m[1] ?? m[5]);
    const month = MONTHS.indexOf((m[2] ?? m[4] ?? '').toLowerCase()) + 1;
    const year = m[3] ?? m[6];
    if (day && month) out.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return out;
}

export function validateReport(input: {
  outcome: string;
  report?: StoryReport;
  retrieved: SearchHit[];
  providersUsed: string[];
  expect: Expectation;
  /** The AI's words are being judged (live or recorded Claude); false for written stand-in replies. */
  aiWritten: boolean;
}): Validation {
  const { outcome, report: r, retrieved, expect: e } = input;
  const checks: Check[] = [];
  const review: ReviewClaim[] = [];
  const byUrl = new Map(retrieved.map((h) => [h.url, h]));

  // 1. The right story.
  const okOutcome = e.outcome.includes(outcome);
  const okMatch = !r || !e.match || e.match.includes(r.match);
  const subjectProblems: string[] = [];
  if (r && e.subject?.absent && r.subject) subjectProblems.push(`subject should be absent, got "${r.subject}"`);
  for (const p of missing(e.subject?.must, r?.subject ?? '')) subjectProblems.push(`subject lacks ${p}`);
  for (const p of e.subject?.mustNot ?? []) if (p.test(r?.subject ?? '')) subjectProblems.push(`subject has ${p}`);
  checks.push(
    check(
      'story',
      'Correct identification of the story',
      okOutcome && okMatch && !subjectProblems.length ? 'pass' : 'fail',
      [`outcome ${outcome} (expected ${e.outcome.join(' or ')})`, r ? `match ${r.match}${e.match ? ` (expected ${e.match.join(' or ')})` : ''}` : '', ...subjectProblems].filter(Boolean).join('; '),
    ),
  );

  if (!r) {
    for (const [id, label] of [
      ['names', 'Correct names'],
      ['dates', 'Correct event dates'],
      ['locations', 'Correct locations'],
      ['facts', 'Relevant facts'],
      ['assumptions', 'No unsupported assumptions'],
      ['contradictions', 'No contradictory claims'],
      ['citations', 'Proper source references'],
      ['confidence', 'Appropriate confidence'],
      ['writing', 'Clear, readable writing'],
      ['headline', 'Headline accuracy'],
    ] as const) {
      checks.push(check(id, label, 'n/a', 'no report'));
    }
    return { checks, review, passed: checks.every((c) => c.status !== 'fail') };
  }

  const factual = [
    ...r.whatHappened.map((c) => ({ section: 'What happened?', ...c })),
    ...r.details.map((c) => ({ section: `Key details (${c.label})`, text: c.text, sources: c.sources })),
    ...r.confirmed.map((c) => ({ section: 'What is confirmed?', ...c })),
    ...r.reported.map((c) => ({ section: 'Reported by one source', ...c })),
  ];
  const factualText = factual.map((c) => c.text).join(' ');
  const allText = [r.subject ?? '', factualText, ...r.unclear.map((c) => c.text)].join(' ');
  const retrievedText = retrieved.map(hitText).join(' ');
  const retrievedDigits = digitSet(retrievedText);

  const listCheck = (id: string, label: string, patterns: RegExp[] | undefined, text: string) => {
    if (!patterns?.length) return checks.push(check(id, label, 'n/a', 'nothing expected'));
    const miss = missing(patterns, text);
    checks.push(check(id, label, miss.length ? 'fail' : 'pass', miss.length ? `missing ${miss.join(', ')}` : `found ${patterns.join(', ')}`));
  };

  // 2, 4, 5. Names, places, facts.
  listCheck('names', 'Correct names', e.names, allText);

  // 3. Dates: the expected event date; dates that only match a publication date (event or publication?); dates from nowhere.
  const dateFlags: string[] = [];
  const invented: string[] = [];
  for (const c of factual) {
    const cited = c.sources.map((n) => r.sources.find((s) => s.n === n)).filter((s): s is ReportSource => Boolean(s));
    for (const d of datesIn(c.text)) {
      const [y, m, day] = d.split('-');
      const inText = cited.some((s) => {
        const t = hitText(byUrl.get(s.url));
        return t.includes(y!) && new RegExp(`\\b${Number(day)}\\b`).test(t) && new RegExp(MONTHS[Number(m) - 1]!, 'i').test(t);
      });
      if (inText) continue;
      // The prompt allows working a date out from a publication date ("on Monday" in a report published that day).
      const near = cited.some((s) => s.published && Math.abs(Date.parse(s.published) - Date.parse(d)) <= 7 * 86_400_000);
      if (cited.some((s) => s.published === d)) dateFlags.push(`"${d}" in "${c.text.slice(0, 60)}…" matches a source's publication date but not its text: check it's the event date`);
      else if (near) dateFlags.push(`"${d}" in "${c.text.slice(0, 60)}…" isn't in the cited text; it is within a week of a cited publication date (worked out?)`);
      else invented.push(`"${d}" in "${c.text.slice(0, 60)}…" is in no cited source's text or publication date`);
    }
  }
  const dateMiss = missing(e.eventDate, factualText);
  checks.push(
    check(
      'dates',
      'Correct event dates',
      dateMiss.length || invented.length ? 'fail' : dateFlags.length ? 'review' : e.eventDate?.length ? 'pass' : 'n/a',
      [dateMiss.length ? `missing ${dateMiss.join(', ')}` : e.eventDate?.length ? `found ${e.eventDate.join(', ')}` : 'no date expected', ...invented, ...dateFlags].join('; '),
    ),
  );
  listCheck('locations', 'Correct locations', e.locations, allText);
  listCheck('facts', 'Relevant facts', e.facts, factualText);

  // 6. Unsupported assumptions: forbidden statements, and numbers no retrieved source contains.
  const forbiddenHits = [
    ...(e.forbidden ?? []).filter((p) => p.test(factualText)),
    ...(e.unclearForbidden ?? []).filter((p) => p.test(r.unclear.map((c) => c.text).join(' '))).map((p) => new RegExp(`${p.source} (under "What remains unclear?")`, p.flags)),
  ];
  const inventedNumbers: string[] = [];
  for (const c of factual) for (const n of numbersIn(c.text)) if (!retrievedDigits.has(n) && !retrievedDigits.has(String(Number(n)))) inventedNumbers.push(`${n} (in "${c.text.slice(0, 50)}…")`);
  checks.push(
    check(
      'assumptions',
      'No unsupported assumptions',
      forbiddenHits.length || inventedNumbers.length ? 'fail' : 'pass',
      forbiddenHits.length || inventedNumbers.length
        ? [...forbiddenHits.map((p) => `states ${p}`), ...inventedNumbers.map((n) => `number not in any retrieved source: ${n}`)].join('; ')
        : 'no forbidden statements; every number appears in a retrieved source',
    ),
  );

  // 7. Contradictions, and disputed values kept out of "confirmed".
  const contradictions = (e.contradictions ?? []).filter(([a, b]) => a.test(factualText) && b.test(factualText));
  const unclearText = r.unclear.map((c) => c.text).join(' ');
  const confirmedText = r.confirmed.map((c) => c.text).join(' ');
  const disputedProblems = [
    ...(e.disputed ?? []).filter((p) => !p.test(unclearText)).map((p) => `${p} not under "What remains unclear?"`),
    ...(e.disputed ?? []).filter((p) => p.test(confirmedText)).map((p) => `${p} stated as confirmed`),
  ];
  checks.push(
    check(
      'contradictions',
      'No contradictory claims',
      contradictions.length || disputedProblems.length ? 'fail' : 'pass',
      contradictions.length || disputedProblems.length
        ? [...contradictions.map(([a, b]) => `both ${a} and ${b} stated as fact`), ...disputedProblems].join('; ')
        : e.disputed?.length
          ? 'disputed values only under "What remains unclear?"'
          : 'none found',
    ),
  );

  // 8. Source references: structure checked strictly, support estimated.
  const citeProblems: string[] = [];
  const allClaims = [...r.whatHappened, ...r.details, ...r.confirmed, ...r.reported, ...r.unclear];
  for (const c of factual) {
    if (!c.sources.length) citeProblems.push(`"${c.text.slice(0, 50)}…" cites nothing`);
    for (const n of c.sources) if (!r.sources.some((s) => s.n === n)) citeProblems.push(`"${c.text.slice(0, 50)}…" cites [${n}], which isn't listed`);
  }
  // Every citation proves itself: each cited source has a passage of its own, and it really is in that source.
  let quotes = 0;
  for (const c of allClaims) {
    const ev = (c as { evidence?: { source: number; quote: string }[] }).evidence ?? [];
    for (const n of c.sources) if (!ev.some((q) => q.source === n)) citeProblems.push(`"${c.text.slice(0, 50)}…" cites [${n}] without a passage from it`);
    for (const q of ev) {
      quotes++;
      const src = r.sources.find((s) => s.n === q.source);
      if (!src || !quoteIn(q.quote, byUrl.get(src.url))) citeProblems.push(`passage "${q.quote.slice(0, 50)}…" is not in source [${q.source}]`);
    }
  }
  for (const s of r.sources) {
    if (!byUrl.has(s.url)) citeProblems.push(`source ${s.n} (${s.url}) wasn't among the retrieved results`);
    const expected = publisherName(s.url, byUrl.get(s.url)?.publisher);
    if (s.publisher !== expected) citeProblems.push(`source ${s.n} publisher "${s.publisher}", expected "${expected}" for ${hostOf(s.url)}`);
    const kind = sourceKind(s.url, byUrl.get(s.url)?.title ?? s.title);
    if (kind !== s.kind) citeProblems.push(`source ${s.n} kind "${s.kind}", expected "${kind}"`);
  }
  for (const c of r.confirmed) {
    const cited = c.sources.map((n) => r.sources.find((s) => s.n === n)).filter((s): s is ReportSource => Boolean(s) && s!.match === 'strong');
    // Only news and agency reports corroborate (social posts, opinion and unknown sites never do), each group once.
    const groups = new Set(cited.filter((s) => s.kind === 'news' || s.kind === 'agency').map((s) => groupOf(s, r.sources)));
    if (groups.size < 2 && !cited.some((s) => s.kind === 'primary')) citeProblems.push(`"${c.text.slice(0, 50)}…" is under "confirmed" without two independent news or agency reports or an official source`);
    if ((c as { weak?: boolean }).weak) citeProblems.push(`"${c.text.slice(0, 50)}…" is under "confirmed" but its passages are weak`);
  }
  if (e.minSources !== undefined && r.sources.length < e.minSources) citeProblems.push(`${r.sources.length} sources, expected at least ${e.minSources}`);
  if (e.hostsAnyOf?.length && !r.sources.some((s) => e.hostsAnyOf!.some((h) => hostOf(s.url).endsWith(h)))) citeProblems.push(`no source from ${e.hostsAnyOf.join(', ')}`);
  for (const s of r.sources) {
    if (!(e.notStrong ?? []).some((u) => s.url.includes(u))) continue;
    if (s.match === 'strong') citeProblems.push(`source ${s.n} (${s.url}) is a strong match; expected possible at most`);
    if (allClaims.some((c) => c.sources.includes(s.n))) citeProblems.push(`source ${s.n} (${s.url}) is cited; it shouldn't support anything`);
  }

  let lowSupport = 0;
  for (const c of factual) {
    const cited = c.sources.map((n) => r.sources.find((s) => s.n === n)).filter((s): s is ReportSource => Boolean(s));
    const citedText = cited.map((s) => hitText(byUrl.get(s.url))).join(' ');
    const claimTerms = [...new Set(terms(c.text))];
    const citedTerms = new Set(terms(citedText));
    const support = claimTerms.length ? claimTerms.filter((t) => citedTerms.has(t)).length / claimTerms.length : 1;
    const flags: string[] = [];
    if (support < 0.5) {
      flags.push('fewer than half its words appear in the cited sources');
      lowSupport++;
    }
    const citedDigits = digitSet(citedText);
    for (const n of numbersIn(c.text)) if (!citedDigits.has(n) && !citedDigits.has(String(Number(n)))) flags.push(`number ${n} isn't in the cited sources' text`);
    let evidence: string | undefined;
    let best = -1;
    for (const s of cited) {
      for (const p of [byUrl.get(s.url)?.title ?? '', ...(byUrl.get(s.url)?.passages ?? [])]) {
        const pt = new Set(terms(p));
        const score = claimTerms.filter((t) => pt.has(t)).length;
        if (score > best) {
          best = score;
          evidence = `[${s.n}] ${p.slice(0, 220)}${p.length > 220 ? '…' : ''}`;
        }
      }
    }
    review.push({
      section: c.section,
      text: c.text,
      sources: cited.map((s) => ({ n: s.n, publisher: s.publisher, url: s.url, ...(s.published ? { published: s.published } : {}) })),
      support: Math.round(support * 100) / 100,
      flags,
      ...(evidence ? { evidence } : {}),
    });
  }
  const providerProblems = e.providersUsed && JSON.stringify([...input.providersUsed].sort()) !== JSON.stringify([...e.providersUsed].sort()) ? [`answered by ${input.providersUsed.join(', ') || 'none'}, expected ${e.providersUsed.join(', ')}`] : [];
  checks.push(
    check(
      'citations',
      'Proper source references',
      citeProblems.length || providerProblems.length ? 'fail' : lowSupport ? 'review' : 'pass',
      [...citeProblems, ...providerProblems, lowSupport ? `${lowSupport} claim(s) with weak word support: see the review list` : '', !citeProblems.length && !providerProblems.length ? `${factual.length} factual claim(s), every one cites a listed source with a passage of its own (${quotes} passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources` : '']
        .filter(Boolean)
        .join('; '),
    ),
  );

  // 9. Confidence, and the notes that go with it.
  const noteProblems = [
    ...(e.notes ?? []).filter((n) => !r.notes.includes(n)).map((n) => `note "${n}" missing`),
    ...(e.forbiddenNotes ?? []).filter((n) => r.notes.includes(n)).map((n) => `note "${n}" shouldn't be there`),
  ];
  const okConfidence = !e.confidence || e.confidence.includes(r.confidence);
  const emptyProblems = (e.empty ?? []).filter((k) => r[k].length > 0).map((k) => `${k} should be empty, has ${r[k].length}`);
  checks.push(
    check(
      'confidence',
      'Appropriate confidence',
      okConfidence && !noteProblems.length && !emptyProblems.length ? 'pass' : 'fail',
      [`confidence ${r.confidence}${e.confidence ? ` (expected ${e.confidence.join(' or ')})` : ''}`, `notes: ${r.notes.join(', ') || 'none'}`, ...noteProblems, ...emptyProblems].join('; '),
    ),
  );

  // 10. Writing.
  const writing: string[] = [];
  const sentences = [...factual.map((c) => c.text), ...r.unclear.map((c) => c.text)];
  for (const s of sentences) {
    if (/https?:\/\/|[*#`]|<\/?[a-z]/i.test(s)) writing.push(`markup or a link in "${s.slice(0, 40)}…"`);
    if (RELATIVE.test(s)) writing.push(`relative date in "${s.slice(0, 40)}…"`);
    const words = s.split(/\s+/).filter(Boolean).length;
    if (words > 45) writing.push(`${words}-word sentence: "${s.slice(0, 40)}…"`);
  }
  if (r.subject && r.subject.split(/\s+/).length > 16) writing.push(`subject is ${r.subject.split(/\s+/).length} words`);
  if (r.whatHappened.length > 3) writing.push(`${r.whatHappened.length} sentences under "What happened?"`);
  checks.push(check('writing', 'Clear, readable writing', writing.length ? 'fail' : 'pass', writing.length ? writing.join('; ') : `${sentences.length} sentence(s): no markup, links or relative dates, none over 45 words`));

  // 11. Headline accuracy.
  const h = r.headline;
  if (e.headline === undefined) checks.push(check('headline', 'Headline accuracy', 'n/a', h ? `${h.verdict}: ${h.reason}` : 'no headline check'));
  else if (e.headline === 'absent') checks.push(check('headline', 'Headline accuracy', h ? 'fail' : 'pass', h ? `expected none, got ${h.verdict}` : 'none, as expected'));
  else {
    const okVerdict = Boolean(h && e.headline.includes(h.verdict));
    const badQuote = h?.evidence.find((q) => !quoteIn(q.quote, byUrl.get(r.sources.find((s) => s.n === q.source)?.url ?? '')));
    checks.push(
      check(
        'headline',
        'Headline accuracy',
        okVerdict && !badQuote ? 'pass' : 'fail',
        [h ? `${h.verdict} (expected ${e.headline.join(' or ')})${h.reason ? `: ${h.reason}` : ''}` : `none (expected ${e.headline.join(' or ')})`, badQuote ? `passage "${badQuote.quote.slice(0, 40)}…" not in its source` : ''].filter(Boolean).join('; '),
      ),
    );
  }
  // Confirmed facts expected, or none at all: part of "Appropriate confidence".
  const conf = checks.find((x) => x.id === 'confidence')!;
  for (const p of e.confirmedMust ?? []) {
    if (p.test(confirmedText)) continue;
    conf.status = 'fail';
    conf.detail += `; ${p} not under "What is confirmed?"`;
  }
  if (e.confirmedNever && r.confirmed.length) {
    conf.status = 'fail';
    conf.detail += `; ${r.confirmed.length} fact(s) under "What is confirmed?", expected none`;
  }
  for (const p of e.notConfirmed ?? []) {
    if (!p.test(confirmedText)) continue;
    conf.status = 'fail';
    conf.detail += `; ${p} under "What is confirmed?", expected only reported`;
  }

  // Facts written by Claude always need a person; stand-in replies don't (they were written for the test).
  if (input.aiWritten && factual.length) {
    const c = checks.find((x) => x.id === 'facts');
    if (c && c.status === 'pass') c.detail += '; accuracy of each claim still needs a person (see the review list)';
  }
  return { checks, review, passed: checks.every((c) => c.status !== 'fail') };
}
