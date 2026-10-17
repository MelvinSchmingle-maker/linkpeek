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

/** Which engine wrote a summary. "demo" is fixture data on the test pages. */
export type SummaryProviderName = 'extractive' | 'chrome-on-device' | 'remote' | 'demo';

/**
 * Notes about how a summary was made.
 * - preview: built from the page's own description or a short excerpt, not the full article.
 * - trimmed: cut at a clause boundary to fit 20 words.
 * - shortened: the provider was asked once to make it shorter.
 */
export type SummaryFlag = 'preview' | 'trimmed' | 'shortened';

export interface Summary {
  text: string;
  wordCount: number;
  provider: SummaryProviderName;
  /** The evidence the summary was made from. */
  evidence?: EvidenceLevel;
  flags?: SummaryFlag[];
}

export interface HeadlineCheck {
  verdict: HeadlineVerdict;
  /** The check hasn't run at all. The card then shows no verdict mark. */
  notChecked?: boolean;
  /** One short sentence explaining the verdict. */
  reason?: string;
  /** A plainer headline from the article. Only ever present when evidence is "full", and only with a fail verdict. */
  rewrite?: string;
  /** The rewrite states a result the headline held back on purpose. The card says so. */
  revealsWithheld?: boolean;
}

/**
 * Limits on a study's findings that an article states. Only these labels are
 * kept, never the article's own words.
 */
export type StudyLimit = 'animal' | 'lab' | 'small' | 'early' | 'observational' | 'further';

/** A money or percentage figure from an article, as a plain number. */
export interface Figure {
  unit: 'money' | 'percent';
  value: number;
}

/**
 * What the headline check needs to know about an article, kept after reading.
 * Derived facts only, so a cached result carries no article text.
 */
export interface ContentFacts {
  limits: StudyLimit[];
  figures: Figure[];
}

export interface LinkRisk {
  level: LinkRiskLevel;
  /** One plain sentence from the strongest check that fired. */
  reason?: string;
  /** The registrable site the address points to, e.g. "bbc.co.uk". Used for "Don't warn me on this site". */
  site?: string;
  /** Extra facts from a redirect check, e.g. "Opens on bbc.co.uk after redirects." */
  note?: string;
  /** The user switched warnings off for this site. The check still ran; only the warning is hidden. */
  overruled?: boolean;
}

/** What kind of piece it is. "other" is a clear type we don't sort further; unclear pages get no kind at all. */
export type ArticleKind = 'news' | 'opinion' | 'analysis' | 'sponsored' | 'press-release' | 'other';

/**
 * Where a fact came from. Shown next to the fact, so nobody has to take it on
 * trust: "from the page's structured data", "from the web address", and so on.
 */
export type FactOrigin =
  | 'structured-data'
  | 'meta-tags'
  | 'byline'
  | 'page-text'
  | 'page-label'
  | 'address'
  | 'article-links';

export interface SourceFact<T> {
  value: T;
  from: FactOrigin;
}

/** How many links in the article text go to each kind of primary source. A count, never a judgement. */
export interface PrimaryCounts {
  government: number;
  court: number;
  research: number;
  pdf: number;
}

/**
 * What the page discloses about itself. A field that's missing is "Not stated"
 * in the card, never a negative. Ownership and independent coverage come later
 * and are deliberately absent (see src/core/source/facts.ts).
 */
export interface SourceInfo {
  publisher?: SourceFact<string>;
  published?: SourceFact<string>;
  modified?: SourceFact<string>;
  author?: SourceFact<string>;
  articleType?: SourceFact<ArticleKind>;
  primarySources?: SourceFact<PrimaryCounts>;
}

/** How the text was obtained. */
export type ExtractMethod = 'readability' | 'pdf' | 'current-page';

/**
 * What LinkPeek actually read from the destination, before any summary
 * exists. Shown as "the article's first sentence", never as a summary.
 */
export interface ArticleExtract {
  firstSentence: string;
  /** Words of article text found (after removing menus, ads and the like). */
  wordCount: number;
  method: ExtractMethod;
  title?: string;
  /** Only part of the document was read (e.g. the first pages of a long PDF). */
  truncated?: boolean;
}

export interface LinkResult {
  /** The article's paragraphs, only when reading mode asked for them (Part 12). Never stored. */
  readable?: string[];
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
  /** What was read, while there's no summary yet. */
  extract?: ArticleExtract;
  /** Where the link ended up after redirects, when that differs from url. */
  finalUrl?: string;
  /** LinkPeek needs the user's permission to read pages on this host before it can try. */
  needsPermissionFor?: string;
  /** True when this came from fixtures, not a real assessment. Always shown in the UI. */
  isDemo: boolean;
}

export type Mode = 'smart' | 'scan' | 'manual';
