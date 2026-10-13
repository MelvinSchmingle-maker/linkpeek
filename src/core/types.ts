/**
 * Shared types. Every module speaks in these shapes so the UI never has to
 * guess how much LinkPeek actually knows about a link.
 */

/**
 * How much of the destination we really read.
 * - full: enough real article text to summarise the substance.
 * - partial: only a description, abstract, metadata or a short excerpt.
 * - headline-only: we have the link text and nothing else.
 * - unavailable: not enough to say anything useful.
 */
export type EvidenceLevel = 'full' | 'partial' | 'headline-only' | 'unavailable';

/**
 * Headline-quality check. This is NOT a fact-check.
 * - pass: the headline states its main point (and, where we have the article,
 *   the article backs it up).
 * - fail: a specific clickbait or misleading pattern was found with enough evidence.
 * - unknown: not enough evidence, or no clear verdict. The default.
 */
export type HeadlineVerdict = 'pass' | 'fail' | 'unknown';

/**
 * Link-safety outcome. There is deliberately no "safe" value.
 */
export type LinkRiskLevel =
  | 'known-threat'
  | 'suspicious'
  | 'mismatch'
  | 'no-known-warning'
  | 'not-checked';

/** Why we could not get or summarise the content. */
export type FailureReason =
  | 'permission-denied'
  | 'network'
  | 'timeout'
  | 'http-4xx'
  | 'http-403'
  | 'http-429'
  | 'http-5xx'
  | 'login-wall'
  | 'paywall'
  | 'bot-challenge'
  | 'js-rendered-empty'
  | 'extraction-failed'
  | 'unsupported-type'
  | 'too-large'
  | 'summary-failed';

export interface Summary {
  text: string;
  wordCount: number;
  /** Which engine wrote it, e.g. "extractive", "demo". */
  provider: string;
}

export interface HeadlineCheck {
  verdict: HeadlineVerdict;
  /** One short sentence explaining the verdict. */
  reason?: string;
  /** A plain rewrite. Only ever present when evidence is "full". */
  rewrite?: string;
}

export interface LinkRisk {
  level: LinkRiskLevel;
  reason?: string;
}

export interface SourceInfo {
  publisher?: string;
  published?: string;
}

export interface LinkResult {
  /** Stable id for this result (used for one-vote-per-result feedback). */
  id: string;
  url: string;
  headline: string;
  evidence: EvidenceLevel;
  summary?: Summary;
  /** Description or excerpt shown when evidence is "partial". */
  preview?: string;
  headlineCheck: HeadlineCheck;
  linkRisk: LinkRisk;
  source?: SourceInfo;
  failure?: FailureReason;
  /** The destination is a format we cannot handle yet. */
  unsupported?: boolean;
  /** True when this came from fixtures, not a real assessment. Always shown in the UI. */
  isDemo: boolean;
}

export type Mode = 'smart' | 'scan' | 'manual';
