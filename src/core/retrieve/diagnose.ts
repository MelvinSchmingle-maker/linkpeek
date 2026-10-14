/**
 * Telling a real article apart from the pages that only look like a
 * response: errors, rate limits, "are you a robot?" checks, login and
 * subscription walls, and pages that need JavaScript to show anything.
 * These are failures, never content to summarise.
 *
 * Pure functions over plain data, so they're easy to test.
 */
import type { FailureReason } from '../types';

/** Failure from the HTTP status alone (a challenge page may still be found inside a 403/503). */
export function failureFromStatus(status: number): FailureReason | undefined {
  if (status >= 200 && status < 300) return undefined;
  if (status === 401) return 'login-wall';
  if (status === 402) return 'paywall';
  if (status === 403) return 'http-403';
  if (status === 429) return 'http-429';
  if (status >= 400 && status < 500) return 'http-4xx';
  if (status >= 500) return 'http-5xx';
  // 1xx/3xx that weren't followed: treat as unusable.
  return 'http-4xx';
}

/** Markers that only appear on bot-check pages. One is enough. */
const STRONG_CHALLENGE = [
  /cf_chl_|cf-browser-verification|challenge-platform\/|cdn-cgi\/challenge/i, // Cloudflare
  /captcha-delivery\.com|datadome/i, // DataDome
  /px-captcha|_pxCaptcha|perimeterx/i, // PerimeterX / HUMAN
  /_Incapsula_Resource|incap_ses_/i, // Imperva
  /ak_bmsc.*sensor_data|akamai bot manager/i, // Akamai
];
/** Titles bot-check pages use. */
const CHALLENGE_TITLE =
  /^(just a moment\.*|attention required!? \| cloudflare|access denied|are you a robot\??|please verify you are a human|security check|ddos protection by .*|one more step|checking your browser.*|pardon our interruption)$/i;
/** Weaker hints: also used by ordinary pages (comment forms), so they only count when there's little text. */
const WEAK_CHALLENGE = /g-recaptcha|h-captcha|hcaptcha\.com|recaptcha\/api|enable javascript and cookies to continue|verify you are human/i;

export function looksLikeChallenge(html: string, title: string, articleWords: number): boolean {
  if (CHALLENGE_TITLE.test(title.trim())) return true;
  const head = html.slice(0, 200_000);
  if (STRONG_CHALLENGE.some((re) => re.test(head))) return articleWords < 150;
  return articleWords < 80 && WEAK_CHALLENGE.test(head);
}

const LOGIN_PATH = /\/(login|log-in|signin|sign-in|sign_in|auth|sso|account\/login|accounts\/login|session\/new)(\/|$|\?)/i;
const LOGIN_TITLE = /\b(log ?in|sign ?in|sign up|create (an )?account|register)\b/i;

/**
 * A login wall: we were sent to a login page, or the page is mostly a
 * password form with little text.
 */
/** The link was sent on to a login page. */
export function redirectedToLogin(requestedUrl: string, finalUrl: string): boolean {
  return LOGIN_PATH.test(new URL(finalUrl).pathname) && !LOGIN_PATH.test(new URL(requestedUrl).pathname);
}

export function looksLikeLoginWall(args: {
  requestedUrl: string;
  finalUrl: string;
  hasPasswordField: boolean;
  title: string;
  articleWords: number;
}): boolean {
  const { requestedUrl, finalUrl, hasPasswordField, title, articleWords } = args;
  if (redirectedToLogin(requestedUrl, finalUrl)) return true;
  if (hasPasswordField && articleWords < 150) return true;
  return articleWords < 60 && LOGIN_TITLE.test(title);
}

/** Phrases subscription walls show. Only count when the text is short. */
const PAYWALL_TEXT =
  /(subscribe|subscription|subscribers?) (now )?(to|for) (continue|keep) reading|to continue reading,? (please )?(subscribe|sign in|log in)|this (article|story|content) is (only )?(available|for) (to )?(subscribers|members)|already a subscriber\??|become a (member|subscriber) to read/i;

/**
 * A subscription wall. Strongest signal: the publisher's own structured data
 * says the page isn't free (schema.org isAccessibleForFree: false). In that
 * case LinkPeek never reads the article body, even if the page happens to
 * contain it: that's the publisher's line, and we don't cross it.
 */
export function looksLikePaywall(args: { isAccessibleForFree?: boolean; bodyText: string; articleWords: number; hasPaywallElement: boolean }): boolean {
  if (args.isAccessibleForFree === false) return true;
  if (args.articleWords >= 150) return false;
  return args.hasPaywallElement || PAYWALL_TEXT.test(args.bodyText.slice(0, 20_000));
}

/**
 * The page is an empty shell that builds itself with JavaScript (which
 * LinkPeek doesn't run when it reads a page in the background).
 */
export function looksJsRendered(args: { articleWords: number; bodyWords: number; scriptCount: number; hasEmptyAppRoot: boolean; noscriptAsksForJs: boolean }): boolean {
  if (args.articleWords >= 50) return false;
  if (args.noscriptAsksForJs) return true;
  return args.scriptCount > 0 && (args.hasEmptyAppRoot || args.bodyWords < 30);
}

export type ContentKind = 'html' | 'pdf' | 'unsupported';

export function contentKind(contentType: string, url: string): ContentKind {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === '' || contentType === 'text/html' || contentType === 'application/xhtml+xml') return 'html';
  if (contentType === 'text/plain' && !/\.(txt|csv|log)$/i.test(url)) return 'html';
  return 'unsupported';
}
