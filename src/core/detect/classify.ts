/**
 * Link classifier: should this link get the LinkPeek icon?
 *
 * Pure function over plain facts about a link (see features.ts for how those
 * facts are read from the page). No DOM here, so it is fast to test.
 *
 * The aim is precision: an icon on a menu link is more annoying than a
 * missing icon on an article, because the user can always right-click a
 * link to peek at it manually.
 */

export interface LinkFeatures {
  /** Absolute URL the link points to. */
  href: string;
  /** URL of the page the link is on. */
  pageUrl: string;
  /** Visible link text (or aria-label), whitespace collapsed. */
  text: string;
  /** Inside, or wrapping, an h1-h4 heading. */
  inHeading: boolean;
  /** Inside an <article> element. */
  inArticle: boolean;
  /** Inside <main> or role=main. */
  inMain: boolean;
  /** Inside running text: a <p> with plenty of other text around the link. */
  inParagraph: boolean;
  /** Inside a page-level sidebar (aside / role=complementary), not one inside an article. */
  inAside: boolean;
  /** Inside nav, header, footer, a menu, or their ARIA equivalents. */
  inNavigation: boolean;
  /** Link (or its parent) behaves as a button, tab or menu item. */
  isControl: boolean;
  /** Link has no text, only an image. */
  imageOnly: boolean;
  /** rel attribute contains "sponsored". */
  sponsored: boolean;
}

export interface Classification {
  isCandidate: boolean;
  score: number;
  /** Short codes explaining the score, for debugging and tests. */
  reasons: string[];
}

export const CANDIDATE_THRESHOLD = 4;

/** Link texts that are never article headlines. Compared lower-cased, trimmed. */
const UTILITY_TEXT = new Set([
  'home', 'news', 'sport', 'sports', 'more', 'read more', 'see more', 'show more', 'load more', 'continue reading',
  'next', 'previous', 'prev', 'back', 'top', 'back to top', 'skip to content', 'skip to main content',
  'menu', 'search', 'log in', 'login', 'sign in', 'signin', 'sign up', 'signup', 'register', 'subscribe',
  'log out', 'logout', 'sign out', 'account', 'my account', 'profile', 'settings', 'help', 'faq',
  'contact', 'contact us', 'about', 'about us', 'privacy', 'privacy policy', 'terms', 'terms of use',
  'terms of service', 'cookies', 'cookie policy', 'cookie settings', 'accessibility', 'careers', 'jobs',
  'advertise', 'share', 'tweet', 'email', 'print', 'comment', 'comments', 'reply', 'permalink', 'edit',
  'view all', 'see all', 'all', 'newsletter', 'newsletters', 'donate', 'shop', 'store', 'cart', 'basket',
]);

/**
 * Secondary links to an article. "Continue reading <title>" and
 * "Leave a comment on <title>" start that way; the others are the whole text.
 * ("Read the full annual report on..." is a real link and must not match.)
 */
const UTILITY_PREFIX =
  /^(continue reading|keep reading|leave a comment)\b|^(read more|read (the )?full (story|article|post)|read the rest|read the story|lire la suite|weiterlesen|leer m[aá]s|continua a leggere)$/;
/** "245 comments", "12 replies". */
const COUNT_TEXT = /^\d[\d,.\s]*(k\s*)?(comments?|replies|responses|reactions)$/;
/** Links into a page's comment section. */
const COMMENTS_FRAGMENT = /^#(comments?|respond|reply|comment-\d+|disqus_thread)\b/i;

/** First path segments that mark site furniture (after any locale prefix like /en-gb/). */
const UTILITY_SEGMENT =
  /^(login|log-in|signin|sign-in|signup|sign-up|register|logout|account|accounts|profile|settings|preferences|cart|basket|checkout|search|subscribe|subscription|newsletters?|privacy|terms|cookies?|cookie-policy|contact|about|help|faq|careers|jobs|advertise|donate|user|users|u)$/i;
const LOCALE_SEGMENT = /^[a-z]{2}([-_][a-z]{2})?$/i;
/** Listing pages (a tag, topic or author page), only when the path is short. */
const LISTING_PATH = /^\/(tags?|topics?|category|categories|section|sections|authors?|people)(\/[^/]+)?\/?$/i;
/** Wiki namespace pages (categories, help, talk...), not articles. */
const WIKI_NAMESPACE = /\/wiki\/(category|special|help|portal|template|file|image|talk|wikipedia|user|draft|module|book)(_talk)?:/i;
/** Shop product pages: product titles look like article slugs, but they aren't articles. */
const PRODUCT_PATH = /\/(dp|gp\/product|itm|ip|listing)\/[^/]+/i;
/** Code-hosting objects (a commit, a file, a folder): their messages read like headlines but aren't articles. */
const CODE_OBJECT_PATH = /\/(commit|commits|blob|tree|raw|blame|compare)\//i;
/** Signals that the link points at an article, beyond wordy link text. At least one is required. */
const STRUCTURAL = new Set(['heading', 'article', 'pdf', 'date-path', 'slug', 'content-path', 'numeric-id']);

/** Share, intent and ad hosts. Matched as suffixes of the hostname. */
const SHARE_OR_AD_HOSTS = [
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com',
  'taboola.com', 'outbrain.com', 'addthis.com', 'sharethis.com',
];
const SHARE_PATH = /\/(share|sharer|sharer\.php|intent\/tweet|intent\/post|shareArticle|pin\/create|submit)(\/|$|\?)/i;

/** Social sites where a one-segment path is a profile, not a post. */
const SOCIAL_HOSTS = ['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'threads.net', 'youtube.com', 'bsky.app', 'mastodon.social'];

const NON_CONTENT_FILE = /\.(jpe?g|png|gif|webp|svg|ico|mp3|wav|zip|rar|7z|tar|gz|exe|dmg|msi|apk|css|js|xml|rss|atom)$/i;
const DATE_IN_PATH =
  /\/(19|20)\d\d[/-](0?[1-9]|1[0-2])([/-]|$)|\/(19|20)\d\d(0[1-9]|1[0-2])\d\d\/|\/(19|20)\d\d\/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\//i;
const CONTENT_SEGMENT = /\/(news|article|articles|story|stories|blog|blogs|post|posts|p|report|reports|research|opinion|analysis|features?|comments|status|watch|video|videos|publications?|press-releases?|insights?|guides?)(\/|$)/i;

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

export function classifyLink(f: LinkFeatures): Classification {
  const reasons: string[] = [];
  const no = (reason: string): Classification => ({ isCandidate: false, score: 0, reasons: [reason] });

  let url: URL;
  let page: URL;
  try {
    url = new URL(f.href);
    page = new URL(f.pageUrl);
  } catch {
    return no('bad-url');
  }

  // Hard exclusions.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return no('not-web');
  if (url.origin === page.origin && url.pathname === page.pathname && url.search === page.search) {
    return no('same-page');
  }
  if (f.imageOnly || f.text.length === 0) return no('no-text');
  if (f.isControl) return no('control');
  if (f.sponsored) return no('sponsored');
  if (f.inNavigation) return no('navigation');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostMatches(host, SHARE_OR_AD_HOSTS) || SHARE_PATH.test(url.pathname)) return no('share-or-ad');
  if (NON_CONTENT_FILE.test(url.pathname)) return no('file');
  const text = f.text.trim().toLowerCase().replace(/[.!:…›»>→]+$/u, '').trim();
  if (UTILITY_TEXT.has(text) || UTILITY_PREFIX.test(text) || COUNT_TEXT.test(text)) return no('utility-text');
  if (COMMENTS_FRAGMENT.test(url.hash)) return no('comments-link');
  const path = url.pathname;
  const segments = path.split('/').filter(Boolean);
  if (isUtilityPath(segments, path)) return no('utility-path');
  if (LISTING_PATH.test(path) || WIKI_NAMESPACE.test(path)) return no('listing-page');
  if (PRODUCT_PATH.test(path)) return no('product-page');
  if (CODE_OBJECT_PATH.test(path)) return no('code-object');
  if (hostMatches(host, SOCIAL_HOSTS) && segments.length <= 1 && !url.search) return no('social-profile');
  if (segments.length === 0 && !url.search) return no('homepage');

  // Scoring.
  let score = 0;
  const add = (n: number, reason: string) => {
    score += n;
    reasons.push(reason);
  };

  const words = wordCount(f.text);
  if (words >= 4) add(2, 'words>=4');
  if (words >= 6) add(1, 'words>=6');
  if (words <= 2) add(-2, 'words<=2');
  if (looksLikeUrl(f.text)) add(-1, 'text-is-url');

  if (f.inHeading) add(3, 'heading');
  if (f.inArticle) add(1, 'article');
  if (f.inMain) add(1, 'main');
  // Article pages are full of in-text links. Only strong article signals
  // (a date, a long slug, a PDF) should earn those an icon.
  if (f.inParagraph && !f.inHeading) add(-3, 'in-paragraph');
  if (f.inAside && !f.inHeading) add(-3, 'aside');

  if (/\.pdf$/i.test(path)) add(3, 'pdf');
  if (DATE_IN_PATH.test(path)) add(2, 'date-path');
  if (segments.some(isWordSlug)) add(2, 'slug');
  if (CONTENT_SEGMENT.test(path)) add(1, 'content-path');
  const last = stripExtension(segments[segments.length - 1] ?? '');
  if (/(^|[-_.])\d{5,}($|[-_.])/.test(last) || /[?&](id|p|story|article|t)=\d+/i.test(url.search)) add(1, 'numeric-id');

  // Wordy text in <main> alone isn't enough: something about the link's
  // place or address has to say "article".
  const structural = reasons.some((r) => STRUCTURAL.has(r));
  if (!structural) reasons.push('no-structural-signal');
  return { isCandidate: structural && score >= CANDIDATE_THRESHOLD, score, reasons };
}

/**
 * A path whose first real segment is site furniture (/login, /account/...,
 * /profile/name), unless the rest of the path clearly leads to content:
 * /user/name/comments/123/title, /profile/name/post/123, /help/.../2026/oct/12/...
 */
function isUtilityPath(segments: string[], path: string): boolean {
  const start = segments[0] && LOCALE_SEGMENT.test(segments[0]) && segments.length > 1 ? 1 : 0;
  const first = segments[start];
  if (!first || !UTILITY_SEGMENT.test(first)) return false;
  const rest = '/' + segments.slice(start + 1).join('/');
  const leadsToContent = DATE_IN_PATH.test(path) || CONTENT_SEGMENT.test(rest) || segments.slice(start + 1).some(isWordSlug);
  return !leadsToContent;
}

function stripExtension(segment: string): string {
  return segment.replace(/\.(s?html?|php|aspx?|jsp)$/i, '');
}

/**
 * A readable title in the address, like "council-approves-new-cycle-lanes"
 * or "History_of_the_bicycle". Commit hashes, document IDs and other opaque
 * strings don't count, however long they are.
 */
export function isWordSlug(segment: string): boolean {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep it as is.
  }
  const parts = stripExtension(decoded).split(/[-_+]+/).filter(Boolean);
  if (parts.length < 4) return false;
  const words = parts.filter((p) => /^\p{L}{2,}$/u.test(p));
  return words.length >= 3;
}

const NO_SPACE_SCRIPTS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/**
 * Words in a link's text. Chinese, Japanese, Thai and similar scripts don't
 * put spaces between words, so splitting on spaces would make every headline
 * look like one word. For those, count words properly.
 */
export function wordCount(text: string): number {
  const bySpace = text.split(/\s+/).filter(Boolean).length;
  if (!NO_SPACE_SCRIPTS.test(text)) return bySpace;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let n = 0;
    for (const seg of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) if (seg.isWordLike) n++;
    return Math.max(n, bySpace);
  }
  return Math.max(bySpace, Math.floor(text.replace(/\s+/g, '').length / 2));
}

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(text.trim());
}
