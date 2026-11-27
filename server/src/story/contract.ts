/**
 * Story Search: what the extension may send, and what it gets back.
 * Validated strictly: anything unexpected is a 400, never passed on to a
 * search provider or the AI.
 *
 * The extension sends what the page said about one link (its headline, the
 * card's teaser, nearby text, the address's origin and path, a date), the
 * user's selection if they made one, and a random install ID for rate limits.
 * Never the current page's address, cookies, or anything about the person.
 */

export const MAX_STORY_BODY_BYTES = 16 * 1024;

export const CLUE_SOURCES = [
  'link-text',
  'link-title',
  'image-alt',
  'card-heading',
  'heading-above',
  'card-teaser',
  'surrounding-text',
  'card-label',
  'caption',
  'linked-metadata',
  'page-metadata',
  'url-slug',
  'url-date',
  'page-title',
  'selection',
] as const;
export type ClueSource = (typeof CLUE_SOURCES)[number];
export type Confidence = 'high' | 'medium' | 'low';

export interface SentClue {
  text: string;
  from: ClueSource;
  confidence: Confidence;
}

export interface StoryRequest {
  installId: string;
  /** Origin and path of the link (no query string). */
  url: string;
  shortened?: boolean;
  headline?: SentClue;
  altHeadlines?: SentClue[];
  description?: SentClue;
  context?: SentClue;
  slug?: string;
  /** "2026-11-26" or "2026-11". */
  date?: string;
  dateFrom?: ClueSource;
  publisher?: string;
  author?: string;
  section?: string;
  keywords?: string[];
  language?: string;
  selection?: string;
}

const LIMITS = {
  url: 500,
  headline: 300,
  description: 500,
  context: 700,
  slug: 200,
  publisher: 100,
  author: 100,
  section: 60,
  keyword: 40,
  selection: 1000,
};

// ---------- Response ----------

export type MatchStatus = 'strong' | 'possible' | 'none';
export type InvestigationConfidence = 'strong' | 'partial' | 'conflicting' | 'insufficient';
export type SourceKind = 'primary' | 'agency' | 'news' | 'opinion' | 'social' | 'other';
export type DetailLabel = 'who' | 'what' | 'where' | 'when' | 'why';
export type ReportStatus = 'report' | 'no-results' | 'no-match' | 'report-failed';
export type ReportNote = 'single-source' | 'developing' | 'snippets-only' | 'older-story' | 'syndicated';

export interface Claim {
  text: string;
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
  copyOf?: number;
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
  confirmed: Claim[];
  reported: Claim[];
  unclear: Claim[];
  sources: ReportSource[];
  setAside: number;
  notes: ReportNote[];
  searchedFor: string;
  checkedAt: string;
}

/** Stages streamed to the extension while it waits, one JSON object per line. */
export type StoryEvent =
  | { stage: 'searching' }
  | { stage: 'analysing'; found: number }
  | { stage: 'writing' }
  | { report: StoryReport }
  | { error: StoryErrorCode };

export type StoryErrorCode =
  | 'bad-request'
  | 'too-large'
  | 'method-not-allowed'
  | 'rate-limited'
  | 'disabled'
  | 'not-configured'
  | 'search-failed'
  | 'search-timeout'
  /** The search service's free credit for this month is used up. */
  | 'out-of-credit'
  | 'misconfigured';

// ---------- Validation ----------

const ALLOWED = new Set([
  'installId', 'url', 'shortened', 'headline', 'altHeadlines', 'description', 'context', 'slug', 'date', 'dateFrom',
  'publisher', 'author', 'section', 'keywords', 'language', 'selection',
]);

function text(v: unknown, max: number): string | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || t.length > max) return null;
  return t;
}

function clue(v: unknown, max: number): SentClue | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => k !== 'text' && k !== 'from' && k !== 'confidence')) return null;
  const t = text(o.text, max);
  if (!t) return null;
  if (!CLUE_SOURCES.includes(o.from as ClueSource)) return null;
  if (o.confidence !== 'high' && o.confidence !== 'medium' && o.confidence !== 'low') return null;
  return { text: t, from: o.from as ClueSource, confidence: o.confidence };
}

export function parseStoryRequest(body: unknown): StoryRequest | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some((k) => !ALLOWED.has(k))) return undefined;

  if (typeof b.installId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(b.installId)) return undefined;

  // Only an http(s) origin and path: no query string, fragment or login details.
  if (typeof b.url !== 'string' || b.url.length > LIMITS.url) return undefined;
  let url: URL;
  try {
    url = new URL(b.url);
  } catch {
    return undefined;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.search || url.hash || url.username || url.password) return undefined;

  if (b.shortened !== undefined && typeof b.shortened !== 'boolean') return undefined;
  const headline = clue(b.headline, LIMITS.headline);
  const description = clue(b.description, LIMITS.description);
  const context = clue(b.context, LIMITS.context);
  if (headline === null || description === null || context === null) return undefined;

  let altHeadlines: SentClue[] | undefined;
  if (b.altHeadlines !== undefined) {
    if (!Array.isArray(b.altHeadlines) || b.altHeadlines.length > 3) return undefined;
    altHeadlines = [];
    for (const a of b.altHeadlines) {
      const c = clue(a, LIMITS.headline);
      if (!c) return undefined;
      altHeadlines.push(c);
    }
  }

  const slug = text(b.slug, LIMITS.slug);
  const publisher = text(b.publisher, LIMITS.publisher);
  const author = text(b.author, LIMITS.author);
  const section = text(b.section, LIMITS.section);
  const selection = text(b.selection, LIMITS.selection);
  if ([slug, publisher, author, section, selection].includes(null)) return undefined;

  if (b.date !== undefined && (typeof b.date !== 'string' || !/^(19|20)\d{2}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(b.date))) return undefined;
  if (b.dateFrom !== undefined && (b.date === undefined || !CLUE_SOURCES.includes(b.dateFrom as ClueSource))) return undefined;
  if (b.language !== undefined && (typeof b.language !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/.test(b.language))) return undefined;

  let keywords: string[] | undefined;
  if (b.keywords !== undefined) {
    if (!Array.isArray(b.keywords) || b.keywords.length > 10) return undefined;
    keywords = [];
    for (const k of b.keywords) {
      const t = text(k, LIMITS.keyword);
      if (!t) return undefined;
      keywords.push(t);
    }
  }

  // Something to search for: a headline, a description, a slug, nearby text or a selection.
  if (!headline && !description && !slug && !context && !selection && !altHeadlines?.length) return undefined;

  return {
    installId: b.installId,
    url: url.href,
    ...(b.shortened ? { shortened: true } : {}),
    ...(headline ? { headline } : {}),
    ...(altHeadlines?.length ? { altHeadlines } : {}),
    ...(description ? { description } : {}),
    ...(context ? { context } : {}),
    ...(slug ? { slug } : {}),
    ...(typeof b.date === 'string' ? { date: b.date } : {}),
    ...(typeof b.dateFrom === 'string' ? { dateFrom: b.dateFrom as ClueSource } : {}),
    ...(publisher ? { publisher } : {}),
    ...(author ? { author } : {}),
    ...(section ? { section } : {}),
    ...(keywords?.length ? { keywords } : {}),
    ...(typeof b.language === 'string' ? { language: b.language } : {}),
    ...(selection ? { selection } : {}),
  };
}
