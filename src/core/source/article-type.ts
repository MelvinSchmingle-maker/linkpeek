/**
 * What kind of piece a page is: news, opinion, analysis, sponsored, press
 * release, or another clear type. Read from the page's own labels, its
 * structured data, and its web address, in that order of trust. A page that
 * doesn't say clearly gets no kind at all ("Not stated"), never a guess.
 *
 * Sponsored and press-release come first: a sponsored news story is sponsored.
 */
import type { PageLabel } from '../extract/html';
import type { ArticleKind, SourceFact } from '../types';

/** Address patterns, matched on the lower-cased path. Each one is a clear signal in a real site's URLs. */
const PATHS: { kind: ArticleKind; test: RegExp }[] = [
  { kind: 'sponsored', test: /\/(sponsored|paid-content|partner-content|promoted|advertorial)(\/|-|$)/ },
  { kind: 'press-release', test: /\/(press-releases?|pressreleases?|news-releases?)(\/|$)/ },
  { kind: 'opinion', test: /\/(opinion|opinions|commentisfree|comment)(\/|$)/ },
  { kind: 'analysis', test: /\/analysis(\/|$)/ },
  { kind: 'news', test: /\/news(\/|$)/ },
];

/** schema.org types that name a news piece. */
const NEWS_TYPES = new Set(['NewsArticle', 'ReportageNewsArticle', 'ReviewNewsArticle']);
/** schema.org types that are plainly not news, and that we don't sort further. */
const OTHER_TYPES = new Set(['Article', 'BlogPosting', 'SocialMediaPosting', 'LiveBlogPosting', 'ScholarlyArticle', 'TechArticle', 'Report', 'Blog', 'VideoObject']);

export interface KindInput {
  /** The page's final address. */
  url: string;
  labels: PageLabel[];
  /** The schema.org type from the page's structured data, when the page gave one. */
  schemaType?: string;
}

export function articleKindFrom(input: KindInput): SourceFact<ArticleKind> | undefined {
  const path = pathOf(input.url);
  const fromPath = (kind: ArticleKind): SourceFact<ArticleKind> | undefined =>
    PATHS.find((p) => p.kind === kind)?.test.test(path) ? { value: kind, from: 'address' } : undefined;
  const fromLabel = (label: PageLabel, kind: ArticleKind): SourceFact<ArticleKind> | undefined =>
    input.labels.includes(label) ? { value: kind, from: 'page-label' } : undefined;
  const fromSchema = (...types: string[]): SourceFact<ArticleKind> | undefined =>
    input.schemaType && types.includes(input.schemaType) ? { value: kindForSchema(input.schemaType), from: 'structured-data' } : undefined;

  return (
    fromLabel('sponsored', 'sponsored') ??
    fromPath('sponsored') ??
    fromLabel('press-release', 'press-release') ??
    fromPath('press-release') ??
    fromSchema('OpinionNewsArticle') ??
    fromLabel('opinion', 'opinion') ??
    fromPath('opinion') ??
    fromSchema('AnalysisNewsArticle', 'BackgroundNewsArticle') ??
    fromPath('analysis') ??
    fromSchema(...NEWS_TYPES) ??
    fromPath('news') ??
    (input.schemaType && OTHER_TYPES.has(input.schemaType) ? { value: 'other', from: 'structured-data' } : undefined)
  );
}

function kindForSchema(type: string): ArticleKind {
  if (type === 'OpinionNewsArticle') return 'opinion';
  if (type === 'AnalysisNewsArticle' || type === 'BackgroundNewsArticle') return 'analysis';
  if (NEWS_TYPES.has(type)) return 'news';
  return 'other';
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}
