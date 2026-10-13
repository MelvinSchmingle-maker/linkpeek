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
  /** Inside running text (a <p>) rather than a headline or list. */
  inParagraph: boolean;
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

/** Path segments that mark site furniture, wherever they appear. */
const UTILITY_PATH = /\/(login|log-in|signin|sign-in|signup|sign-up|register|logout|account|profile|settings|preferences|cart|basket|checkout|search|subscribe|subscription|newsletters?|privacy|terms|cookies?|cookie-policy|contact|about|help|faq|careers|jobs|advertise|donate|user|users|u)(\/|$|\?)/i;
/** Listing pages (a tag, topic or author page), only when the path is short. */
const LISTING_PATH = /^\/(tags?|topics?|category|categories|section|sections|authors?|people)(\/[^/]+)?\/?$/i;

/** Share, intent and ad hosts. Matched as suffixes of the hostname. */
const SHARE_OR_AD_HOSTS = [
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com',
  'taboola.com', 'outbrain.com', 'addthis.com', 'sharethis.com',
];
const SHARE_PATH = /\/(share|sharer|sharer\.php|intent\/tweet|intent\/post|shareArticle|pin\/create|submit)(\/|$|\?)/i;

/** Social sites where a one-segment path is a profile, not a post. */
const SOCIAL_HOSTS = ['x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'threads.net', 'youtube.com', 'bsky.app', 'mastodon.social'];

const NON_CONTENT_FILE = /\.(jpe?g|png|gif|webp|svg|ico|mp3|wav|zip|rar|7z|tar|gz|exe|dmg|msi|apk|css|js|xml|rss|atom)$/i;
const DATE_IN_PATH = /\/(19|20)\d\d[/-](0?[1-9]|1[0-2])([/-]|$)|\/(19|20)\d\d(0[1-9]|1[0-2])\d\d\//;
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
  const text = f.text.trim().toLowerCase().replace(/[.!:›»>→]+$/u, '').trim();
  if (UTILITY_TEXT.has(text)) return no('utility-text');
  if (UTILITY_PATH.test(url.pathname)) return no('utility-path');
  if (LISTING_PATH.test(url.pathname)) return no('listing-page');
  const segments = url.pathname.split('/').filter(Boolean);
  if (hostMatches(host, SOCIAL_HOSTS) && segments.length <= 1 && !url.search) return no('social-profile');
  if (segments.length === 0 && !url.search) return no('homepage');

  // Scoring.
  let score = 0;
  const add = (n: number, reason: string) => {
    score += n;
    reasons.push(reason);
  };

  const words = f.text.split(/\s+/).filter(Boolean).length;
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

  const path = url.pathname;
  if (/\.pdf$/i.test(path)) add(3, 'pdf');
  if (DATE_IN_PATH.test(path)) add(2, 'date-path');
  const last = segments[segments.length - 1] ?? '';
  const longSlug = segments.some((s) => (s.match(/-/g)?.length ?? 0) >= 3 || (s.length >= 25 && /[a-z]/i.test(s)));
  if (longSlug) add(2, 'slug');
  if (CONTENT_SEGMENT.test(path)) add(1, 'content-path');
  if (/\d{5,}/.test(last) || /[?&](id|p|story|article)=\d+/i.test(url.search)) add(1, 'numeric-id');

  return { isCandidate: score >= CANDIDATE_THRESHOLD, score, reasons };
}

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(text.trim());
}
