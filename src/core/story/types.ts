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
export type ReportNote = 'single-source' | 'developing' | 'snippets-only' | 'older-story' | 'syndicated' | 'vague-link';

export interface Claim {
  text: string;
  /** Source numbers (1-based, as in `sources`). Never empty for factual claims. */
  sources: number[];
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
}

export interface StoryReport {
  status: ReportStatus;
  subject?: string;
  match: MatchStatus;
  confidence: InvestigationConfidence;
  whatHappened: Claim[];
  details: (Claim & { label: DetailLabel })[];
  /** Backed by at least two independent sources, or by a primary source. */
  confirmed: Claim[];
  /** Backed by one independent source only. */
  reported: Claim[];
  unclear: Claim[];
  sources: ReportSource[];
  /** How many search results were set aside as not about this story. */
  setAside: number;
  notes: ReportNote[];
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
