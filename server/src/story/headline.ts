/**
 * Headline accuracy: does the link's headline say what the matched reporting
 * establishes? Four verdicts:
 *
 * - accurate: the reporting supports what the headline says;
 * - partly accurate: its main claim is supported, a detail isn't;
 * - misleading: it gives a materially different impression (someone "dies"
 *   when the reports say they're in hospital, "arrested" when they say
 *   questioned, an allegation stated as fact, a "collapse" that is reported
 *   as difficulties);
 * - unverified: not enough to judge.
 *
 * Claude proposes the verdict with a reason and quoted passages. The rules
 * here can only make it more cautious, never harsher or kinder than the
 * evidence allows:
 *
 * - No headline, a vague link, or no strong match from a source that can
 *   corroborate (a news agency, a news organisation or an official source):
 *   unverified. A headline is never judged against social media or opinion.
 * - "Accurate" needs a real quoted passage from such a source, and every
 *   event, name and number the headline states found in those sources (an
 *   event only denied, or only alleged when the headline states it as fact,
 *   doesn't count). Otherwise unverified.
 * - "Misleading" needs a real quoted passage and a discrepancy the rules can
 *   see: an event, name or number in the headline that the sources don't
 *   support, an allegation stated as fact, or something the sources mention
 *   only to negate it. Dramatic wording on its own is never enough: without
 *   such a discrepancy, it's unverified. Nor is a disagreement between the
 *   sources (some state what the headline says, some negate it): that rules
 *   out "accurate" but doesn't show the headline misleads.
 * - "Partly accurate" needs a real quoted passage.
 *
 * This complements the clickbait check (src/core/headline), which judges
 * wording; this judges what the headline claims against the evidence.
 */
import type { HeadlineCheck, HeadlineVerdict } from './contract.js';
import { eventsIn, isAllegation, onlyAlleged, polarity, quoteFound, sourceText, unsupportedEvents, unsupportedSpecifics, type Quote } from './evidence.js';
import type { SearchHit } from './providers/types.js';
import { clip, words } from './text.js';

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
}

const RULE_REASON = {
  noEvidence: "There isn't enough matching reporting to judge the headline.",
  notShown: "The reports found don't clearly support everything the headline says.",
};

/** What the rules can see wrong with a headline against these sources. Empty when nothing. */
export function discrepancies(headline: string, texts: string[], hits: SearchHit[], extras: string[]): string[] {
  const out: string[] = [];
  for (const e of unsupportedEvents(headline, texts)) out.push(`event:${e}`);
  for (const s of unsupportedSpecifics(headline, hits, extras, [], { allowTitleCase: false })) out.push(`specific:${s}`);
  // An allegation stated as fact: the headline asserts it plainly, the reports only as an allegation or a denial.
  const qualified = words(headline).some(isAllegation);
  if (!qualified) for (const e of eventsIn(headline).asserted) if (onlyAlleged(e, texts)) out.push(`alleged:${e}`);
  // Something the headline states that the sources mention only to negate ("asbestos found" against "no asbestos
  // was found"); or that some negate and others state: contested, so not accurate, but not shown to mislead either.
  const said = texts.map(polarity);
  for (const [w, signs] of polarity(headline)) {
    if (signs.size !== 1 || !signs.has('+')) continue;
    const mentions = said.map((p) => p.get(w)).filter((x): x is Set<'+' | '-'> => Boolean(x));
    const denied = mentions.filter((m) => m.size === 1 && m.has('-')).length;
    if (mentions.length && denied === mentions.length) out.push(`negated:${w}`);
    else if (denied) out.push(`contested:${w}`);
  }
  return out;
}

export function assessHeadline(input: HeadlineInput): HeadlineCheck | undefined {
  const headline = input.headline?.trim();
  if (!headline) return undefined;
  const unverified = (reason: string): HeadlineCheck => ({ headline, verdict: 'unverified', reason, evidence: [] });
  if (input.vague || !input.eligible.length) return unverified(RULE_REASON.noEvidence);

  const eligibleHits = input.eligible.map((i) => input.hits[i]!);
  const texts = eligibleHits.map(sourceText);
  const extras = input.eligible.flatMap((i) => input.extras[i] ?? []);
  const gaps = discrepancies(headline, texts, eligibleHits, extras);

  const ai = input.ai;
  // Only real passages from eligible sources count as the headline's evidence.
  const evidence = (ai?.evidence ?? [])
    .filter((q) => input.eligible.includes(q.source - 1) && quoteFound(q.quote, sourceText(input.hits[q.source - 1]!)))
    .map((q) => ({ source: input.number.get(q.source)!, quote: clip(q.quote.trim(), 300) }))
    .filter((q) => q.source !== undefined)
    .slice(0, 3);
  // The reason may not add names or numbers the sources don't have either.
  const reason = ai ? input.clean(ai.reason) : undefined;
  const reasonOk = reason && !unsupportedSpecifics(reason, eligibleHits, extras).length ? reason : undefined;

  if (!ai || ai.verdict === 'unverified') return { headline, verdict: 'unverified', reason: reasonOk ?? RULE_REASON.noEvidence, evidence };
  if (!evidence.length) return unverified(RULE_REASON.noEvidence);
  if (ai.verdict === 'accurate') return gaps.length ? unverified(RULE_REASON.notShown) : { headline, verdict: 'accurate', reason: reasonOk ?? '', evidence };
  // Sources disagreeing about what the headline says isn't a discrepancy the headline is responsible for.
  const shown = gaps.filter((g) => !g.startsWith('contested:'));
  if (ai.verdict === 'misleading') return shown.length ? { headline, verdict: 'misleading', reason: reasonOk ?? RULE_REASON.notShown, evidence } : unverified(RULE_REASON.notShown);
  return { headline, verdict: 'partly-accurate', reason: reasonOk ?? RULE_REASON.notShown, evidence };
}
