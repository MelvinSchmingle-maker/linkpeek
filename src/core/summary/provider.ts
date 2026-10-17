/**
 * The slot every summary engine plugs into. The rest of LinkPeek only ever
 * sees a Summary (20 words or fewer, checked) or no summary at all.
 */
import type { EvidenceLevel, Summary, SummaryProviderName } from '../types';

export interface SummaryInput {
  evidence: EvidenceLevel;
  /** The link's own text, used to reject a summary that just repeats it. */
  headline: string;
  url: string;
  /**
   * Article paragraphs in reading order, starting at the opening. Only for
   * "full" evidence: a paywalled or partial page never gets here with body text.
   */
  paragraphs?: string[];
  /** What a preview is made from: the page's own description, or a short excerpt. Only for "partial". */
  previewText?: string;
  /** The page's language (BCP 47, e.g. "en-GB"), if it says. */
  language?: string;
}

export type SummaryOutcome =
  | { ok: true; summary: Summary }
  | { ok: false; provider: SummaryProviderName; reason: 'insufficient' | 'unavailable' | 'over-limit' | 'filtered' | 'error' };

export interface SummaryProvider {
  readonly name: SummaryProviderName;
  summarise(input: SummaryInput): Promise<SummaryOutcome>;
}

/** Which engine the user chose in Settings. The extractive one is always the fallback. */
export type SummaryEngine = 'extractive' | 'chrome-on-device';
