/**
 * Story Search shapes on the extension side. The request shape mirrors the
 * backend's contract (server/src/story/contract.ts), which validates it
 * again: anything unexpected there is a 400.
 */

/** Where a clue came from. Shown to the user before anything is sent. */
export type ClueSource =
  | 'link-text'
  | 'link-title'
  | 'image-alt'
  | 'card-heading'
  | 'heading-above'
  | 'card-teaser'
  | 'surrounding-text'
  | 'card-label'
  | 'caption'
  /** Structured data on the current page that describes this exact link (e.g. a news front page's ItemList). */
  | 'linked-metadata'
  /** The current page's own tags, used only when the link points at this page or the page is clearly about the same story. */
  | 'page-metadata'
  | 'url-slug'
  | 'url-date'
  | 'page-title'
  | 'selection';

export type Confidence = 'high' | 'medium' | 'low';

export interface Clue {
  text: string;
  from: ClueSource;
  confidence: Confidence;
}

/** How the current page's own metadata relates to the clicked link. */
export type PageRelation = 'same-page' | 'related' | 'unrelated' | 'unknown';

/** Everything LinkPeek worked out about a link, on the device. Not all of it is sent. */
export interface StoryClues {
  /** The link as the page has it. Never sent. */
  href: string;
  /** Origin and path only (see url.ts). */
  url: string;
  site: string;
  shortened: boolean;
  unwrapped: boolean;
  linkText?: Clue;
  /** Best headline from the fallback hierarchy, when one exists. */
  headline?: Clue;
  /** Other headline wordings found (card heading, metadata headline...). */
  altHeadlines: Clue[];
  description?: Clue;
  /** Text around the link, capped. */
  context?: Clue;
  slug?: Clue;
  /** "2026-11-26" or "2026-11". */
  date?: Clue;
  publisher?: Clue;
  author?: Clue;
  section?: Clue;
  keywords: string[];
  language?: string;
  selection?: Clue;
  pageRelation: PageRelation;
}

/** One text clue as sent. */
export interface SentClue {
  text: string;
  from: ClueSource;
  confidence: Confidence;
}

/**
 * What the extension sends to LinkPeek's server for one Story Search. Never
 * the current page's address, cookies, form contents or the page's full text.
 */
export interface StoryRequestClues {
  url: string;
  shortened?: boolean;
  headline?: SentClue;
  altHeadlines?: SentClue[];
  description?: SentClue;
  context?: SentClue;
  slug?: string;
  date?: string;
  dateFrom?: ClueSource;
  publisher?: string;
  author?: string;
  section?: string;
  keywords?: string[];
  language?: string;
  selection?: string;
}

export interface StoryRequestBody extends StoryRequestClues {
  installId: string;
}

// ---------- The report the backend sends back ----------

export type MatchStatus = 'strong' | 'possible' | 'none';
export type InvestigationConfidence = 'strong' | 'partial' | 'conflicting' | 'insufficient';
export type SourceKind = 'primary' | 'agency' | 'news' | 'opinion' | 'social' | 'other';
export type DetailLabel = 'who' | 'what' | 'where' | 'when' | 'why';
export type ReportStatus = 'report' | 'no-results' | 'no-match' | 'report-failed';
export type ReportNote = 'single-source' | 'developing' | 'headlines-only' | 'excerpts-only' | 'older-story' | 'syndicated' | 'vague-link' | 'no-established-sources' | 'withdrawn';
/** How much of an article LinkPeek had: its headline, a short search excerpt, a long part of its text, or all of it. */
export type EvidenceDepth = 'headline' | 'excerpt' | 'extended' | 'full';

/** A passage copied word for word from a source: why LinkPeek says what it says. */
export interface Evidence {
  source: number;
  quote: string;
}

export interface Claim {
  text: string;
  /** Source numbers (1-based, as in `sources`). Never empty for factual claims. */
  sources: number[];
  /** The passages, from those sources, that support it (checked by the backend). */
  evidence?: Evidence[];
  /** Its own passages don't fully carry it: never counted as confirmed. */
  weak?: boolean;
}

export type HeadlineVerdict = 'accurate' | 'partly-accurate' | 'misleading' | 'unverified';

/** What a headline verdict rests on, as the backend's rules found it. */
export interface HeadlineBasis {
  kind: 'supported' | 'contradicted' | 'alleged' | 'unsupported' | 'disputed' | 'insufficient';
  terms?: string[];
}

/** Does the link's headline say what the reporting establishes? */
export interface HeadlineCheck {
  headline: string;
  verdict: HeadlineVerdict;
  reason: string;
  evidence: Evidence[];
  basis?: HeadlineBasis;
}

export interface ReportSource {
  n: number;
  title: string;
  publisher: string;
  url: string;
  published?: string;
  kind: SourceKind;
  match: Exclude<MatchStatus, 'none'>;
  /** This source repeats another one's report (syndicated or copied): that source's number. */
  copyOf?: number;
  /** The news agency this report credits, when it says so ("Reuters"). */
  via?: string;
  /** This is the linked article itself, found by the search. */
  original?: boolean;
  /** When the article says it was last updated ("YYYY-MM-DD"). */
  updated?: string;
  /** Its publisher corrected it; what it now says was used. */
  corrected?: boolean;
  /** How much of the article LinkPeek had. */
  depth?: EvidenceDepth;
}

export interface StoryReport {
  status: ReportStatus;
  subject?: string;
  match: MatchStatus;
  confidence: InvestigationConfidence;
  whatHappened: Claim[];
  details: (Claim & { label: DetailLabel })[];
  /** Stated by two independent news reports, or (for what it announced) an official source. */
  confirmed: Claim[];
  /** Reported, not confirmed that way. */
  reported: Claim[];
  unclear: Claim[];
  sources: ReportSource[];
  /** Independent reports among the sources (copies of one report count once). */
  independent?: number;
  /** How many search results were set aside as not about this story. */
  setAside: number;
  notes: ReportNote[];
  /** Headline accuracy, when the link had a headline. */
  headline?: HeadlineCheck;
  /** The main search query, shown so the user can judge it. */
  searchedFor: string;
  /** When the investigation ran (ISO date-time). */
  checkedAt: string;
}

export type StoryStage = 'extracting' | 'searching' | 'analysing' | 'writing';

/** Why a Story Search didn't produce a report. */
export type StoryErrorCode =
  | 'not-configured'
  | 'search-failed'
  | 'search-timeout'
  | 'rate-limited'
  /** The search service's free credit for this month is used up. */
  | 'out-of-credit'
  | 'unavailable'
  | 'bad-response';
