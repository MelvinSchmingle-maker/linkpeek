/**
 * Every user-facing sentence in one place. Short, plain, no blame, no jargon.
 * Never imply a page was read when it wasn't.
 */
import type { FeedbackReason } from './feedback/store';
import type {
  ArticleKind,
  EvidenceLevel,
  FactOrigin,
  FailureReason,
  HeadlineVerdict,
  LinkRiskLevel,
  SummaryProviderName,
} from './types';

export const MSG = {
  iconLabel: 'Preview this link with LinkPeek',
  cardLabel: 'LinkPeek preview',
  close: 'Close preview',
  whatDoesThisMean: 'What does this mean?',
  aboutSource: 'About this source',
  sourceNote: "This shows what the page discloses. It isn't a rating of accuracy.",
  notStated: 'Not stated',
  correctionsLabel: 'Corrections page',
  lookForCorrections: 'Look for a corrections page',
  lookingForCorrections: 'Looking...',
  correctionsNotChecked: 'Not checked yet.',
  correctionsFound: 'Found:',
  correctionsNotFound: "Not found at the usual addresses. That doesn't mean the site has no corrections policy.",
  correctionsNeedAccess: 'LinkPeek needs access to this site to look for its corrections page.',
  correctionsError: "Couldn't check right now. Try again later.",
  definitionsIntro: "A headline check judges the headline, not the story.",
  rewriteLabel: "LinkPeek's plainer headline, from the article:",
  revealNote: 'This rewrite states the result the headline holds back.',
  /** The three outcomes, in the words the card and the options page both show. */
  verdictDefinitions: [
    ['Possible clickbait:', 'The headline is written to make you click, or says more than the article does. It doesn\'t mean the story is false.'],
    ['Headline check passed:', "The headline states its main point, and the article we read backs it up. It doesn't mean the story is true."],
    ['No headline verdict:', "We don't have enough to say either way. This is the default."],
  ] as [string, string][],
  loading: 'Reading the article...',
  openArticle: 'Open article',
  openLink: 'Open link',
  openAnyway: 'Open link anyway',
  demoTag: 'Demo data',
  demoTagTitle: 'Made-up example on a test page. Not a real assessment.',
  partialIntro: 'Full article unavailable. Showing a preview from the available information.',
  headlineOnly: "Only the headline was available, so there's no summary.",
  insufficient: 'Not enough information to assess this headline.',
  summaryFailed: "Couldn't write a summary for this article. You can still open it.",
  unsupported: "LinkPeek can't preview this type of link yet.",
  unavailable: 'No reliable summary is available for this link.',
  // "Text", not "article": a link may lead to a discussion or a reference page (Part 04 live check).
  extractLabel: "Couldn't fit a summary into 20 words. The text begins:",
  pdfPartial: 'Only the first pages of this PDF were read. It begins:',
  allow: 'Allow access…',
  feedbackQuestion: 'Was this useful?',
  feedbackUp: 'Yes, useful',
  feedbackDown: 'No, not useful',
  feedbackThanks: 'Thanks for the feedback.',
  feedbackFailed: "Couldn't save your feedback.",
  feedbackWrongQuestion: 'What was wrong? (optional)',
  feedbackSkip: 'Skip',
  feedbackDisagree: 'Disagree with this rating?',
  feedbackDisagreeThanks: 'Thanks. Noted on this device only.',
  linkCheckHeading: 'Link check:',
  overruleButton: "Don't warn me on this site",
  overruled: (site: string) => `Warnings are off for links to ${site}. You can turn them back on in Settings.`,
  checkWhere: 'Check where this link goes',
  checkingWhere: 'Checking...',
  checkedWhere: (site: string) => `It goes to ${site}, after any redirects. Chrome doesn't show each redirect to LinkPeek, so only the final address is known.`,
  checkWhereFailed: "Couldn't check where this link goes right now.",
  readHere: 'Read here',
  readHereFailed: "Couldn't open the article for reading.",
  checkWhereNeedsAccess: (site: string) => `LinkPeek needs your permission to check where this link goes on ${site}.`,
  noKnownWarningNote: "This isn't a guarantee of safety.",
} as const;

/** The reasons for a thumbs-down, in the order the card shows them. Keys match FEEDBACK_REASONS. */
export const FEEDBACK_REASON_LABEL: Record<FeedbackReason, string> = {
  'missed-main-point': 'Missed the main point',
  'factually-inaccurate': 'Factually inaccurate',
  'too-vague': 'Too vague',
  'not-article-match': "Didn't match the article",
  inaccessible: 'Article inaccessible',
  other: 'Other',
};

/** Shown when LinkPeek may not fetch pages from the link's site yet. */
export function permissionNeeded(host: string): string {
  return `LinkPeek needs your permission to read pages on ${host}.`;
}

/** A small factual note when a link ends up on another site. Not a warning. */
export function opensOn(host: string): string {
  return `Opens on ${host}.`;
}

export const VERDICT_LABEL: Record<HeadlineVerdict, string> = {
  pass: 'Headline check passed',
  fail: 'Possible clickbait',
  unknown: 'No headline verdict',
};

/** Short tag shown only when it matters. Full content needs no tag. */
export const EVIDENCE_TAG: Partial<Record<EvidenceLevel, string>> = {
  partial: 'Preview only',
  'headline-only': 'Headline only',
};

/** Link warnings shown in the compact card, in a red row with the reason. */
export const RISK_WARNING: Partial<Record<LinkRiskLevel, string>> = {
  'known-threat': 'Known threat detected',
  suspicious: 'Suspicious destination',
  mismatch: 'Goes somewhere different from what it shows',
};

/** The five link outcomes, in the exact words the card uses (Part 11). */
export const LINK_CHECK_LABEL: Record<LinkRiskLevel, string> = {
  'known-threat': 'Known threat detected',
  suspicious: 'Suspicious destination',
  mismatch: 'Goes somewhere different from what it shows',
  'no-known-warning': 'No known warning',
  'not-checked': 'Not checked',
};

/** Never "safe". Shown after "No known warning". */
export const LINK_NOT_A_GUARANTEE = "This isn't a guarantee of safety.";

const SITE_BLOCKED = "Couldn't open this article.";

export const FAILURE_MESSAGE: Record<FailureReason, string> = {
  'permission-denied': `${SITE_BLOCKED} LinkPeek doesn't have permission to read this site.`,
  network: `${SITE_BLOCKED} The connection failed.`,
  timeout: `${SITE_BLOCKED} The site took too long to respond.`,
  'http-4xx': `${SITE_BLOCKED} The site said the page isn't available.`,
  'http-403': `${SITE_BLOCKED} The site refused the request.`,
  'http-429': `${SITE_BLOCKED} The site is limiting requests right now.`,
  'http-5xx': `${SITE_BLOCKED} The site had an error.`,
  'login-wall': `${SITE_BLOCKED} The site asks you to log in.`,
  paywall: "The publisher's metadata indicates this content may have restricted access. Showing the available preview.",
  'bot-challenge': `${SITE_BLOCKED} The site asked for a human check.`,
  'js-rendered-empty': `${SITE_BLOCKED} The page needs to run in a browser tab to show its text.`,
  'extraction-failed': "Couldn't find the article text on this page.",
  'unsupported-type': MSG.unsupported,
  'too-large': `${SITE_BLOCKED} It's too large to preview.`,
  'summary-failed': MSG.summaryFailed,
  'bad-link': `${SITE_BLOCKED} This link goes through a redirect LinkPeek can't follow safely yet.`,
  'unsafe-address': `${SITE_BLOCKED} LinkPeek only reads public websites, and this address isn't one.`,
};

/**
 * Says who wrote a summary, every time. The extractive engine chooses a
 * sentence but doesn't write it, so it says so. Demo summaries carry the
 * "Demo data" tag instead.
 */
export const SUMMARY_BY: Record<SummaryProviderName, string | undefined> = {
  extractive: "In the article's own words:",
  'chrome-on-device': "Summary by Chrome's AI, on this computer:",
  remote: 'Summary by AI (Claude):',
  demo: undefined,
};

/** Where a source fact came from, in words. Shown beside the fact. */
export const SOURCE_FROM: Record<FactOrigin, string> = {
  'structured-data': "from the page's structured data",
  'meta-tags': "from the page's meta tags",
  byline: 'from the byline',
  'page-text': 'from the page',
  'page-label': 'from a label on the page',
  address: 'from the web address',
  'article-links': 'counted from the links in the article',
};

export const ARTICLE_KIND_LABEL: Record<ArticleKind, string> = {
  news: 'News',
  opinion: 'Opinion',
  analysis: 'Analysis',
  sponsored: 'Sponsored content',
  'press-release': 'Press release',
  other: 'Another kind of article',
};
