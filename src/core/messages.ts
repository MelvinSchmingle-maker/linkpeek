/**
 * Every user-facing sentence in one place. Short, plain, no blame, no jargon.
 * Never imply a page was read when it wasn't.
 */
import type {
  ArticleKind,
  EvidenceLevel,
  FactOrigin,
  FailureReason,
  HeadlineVerdict,
  LinkRiskLevel,
  SummaryProviderName,
} from './types';
import type { PreviewLine } from './story/package';
import type {
  ClueSource,
  DetailLabel,
  InvestigationConfidence,
  MatchStatus,
  ReportNote,
  SourceKind,
  StoryErrorCode,
  StoryStage,
} from './story/types';

/**
 * Story Search: investigates a link's story elsewhere on the web, without
 * opening the link. Never presents a guess, a failed search or a possible
 * match as an established story.
 */
const STORY = {
  menu: 'LinkPeek – Story Search',
  title: 'Story Search',
  cardLabel: 'LinkPeek Story Search',
  lookingInto: 'Looking into:',
  stages: {
    extracting: 'Extracting link information',
    searching: 'Searching for matching stories',
    analysing: 'Analysing relevant sources',
    writing: 'Preparing the report',
  } satisfies Record<StoryStage, string>,
  stageDone: 'done',
  stageNow: 'in progress',
  confirmIntro:
    "Story Search finds this story elsewhere on the web, so you don't have to open the link. LinkPeek will send this to its server, which searches the web and asks an AI (Claude, by Anthropic) to write a short report:",
  confirmNotSent: "Not sent: this page's address, your cookies, or anything you've typed. The link isn't opened.",
  confirmGo: 'Search',
  confirmCancel: 'Not now',
  previewLabel: {
    headline: 'Headline',
    'other-headline': 'Also worded',
    description: 'Description',
    'nearby-text': 'Nearby text',
    address: 'Link address',
    date: 'Date',
    publisher: 'Publisher',
    selection: 'Your selection',
  } satisfies Record<PreviewLine['label'], string>,
  clueFrom: {
    'link-text': 'from the link',
    'link-title': "from the link's title",
    'image-alt': "from the link's image",
    'card-heading': 'from the article card',
    'heading-above': 'from the heading above the link',
    'card-teaser': 'from the article card',
    'surrounding-text': 'from the text around the link',
    'card-label': 'from the article card',
    caption: 'from a caption',
    'linked-metadata': "from this page's data about the link",
    'page-metadata': "from this page's own tags",
    'url-slug': 'words from the address',
    'url-date': 'from the address',
    'page-title': "from this page's title",
    selection: 'you selected it',
  } satisfies Record<ClueSource, string>,
  match: { strong: 'Strong match', possible: 'Possible match', none: 'No reliable match' } satisfies Record<MatchStatus, string>,
  confidence: {
    strong: 'Strong evidence',
    partial: 'Partial evidence',
    conflicting: 'Conflicting information',
    insufficient: 'Insufficient information',
  } satisfies Record<InvestigationConfidence, string>,
  whatHappened: 'What happened?',
  keyDetails: 'Key details',
  detail: { who: 'Who', what: 'What', where: 'Where', when: 'When', why: 'Why' } satisfies Record<DetailLabel, string>,
  confirmed: 'What is confirmed?',
  confirmedNote: 'Stated by more than one independent source, or by an official one.',
  reported: 'Reported by one source',
  reportedNote: 'Not yet confirmed independently.',
  unclear: 'What remains unclear?',
  sources: 'Supporting sources',
  possibleSources: 'Possibly related sources',
  kind: {
    primary: 'Official source',
    agency: 'News agency',
    news: 'News',
    opinion: 'Opinion',
    social: 'Social media post',
    other: 'Website',
  } satisfies Record<SourceKind, string>,
  original: 'The linked article',
  possibleTag: 'Possible match',
  repeats: (n: number) => `Repeats source ${n}`,
  credits: (agency: string) => `Credits ${agency}`,
  note: {
    'single-source': 'Only one independent source was found.',
    developing: 'This story may still be developing. Details may change.',
    'snippets-only': 'Only headlines and short snippets were available, not the articles themselves.',
    'older-story': 'Some results were about an earlier story with similar wording. They were left out.',
    syndicated: 'Some sources repeat the same report. Repeats count once.',
    'vague-link':
      "This link doesn't say who was involved or when, so LinkPeek can't tell which story it means. The reports below are possible matches only and may be about a different story.",
  } satisfies Record<ReportNote, string>,
  possibleOnly: 'These sources may be about a different story. Check them before relying on this.',
  searchedFor: 'Searched for:',
  setAside: (n: number) => `${n} search result${n === 1 ? '' : 's'} set aside as not about this story.`,
  noResults: 'No reports about this story were found.',
  noMatch: "The search found results, but none clearly about this story. LinkPeek won't guess.",
  reportFailed: "Couldn't write a report. These sources may be about the same story:",
  insufficient:
    "There isn't enough information about this link to search for it. Its text, its address and the page around it don't say what the story is.",
  notAWebLink: 'Story Search works on links to web pages.',
  error: {
    'not-configured': "Story Search isn't set up in this version of LinkPeek.",
    'search-failed': "The search service didn't answer. Try again in a minute.",
    'search-timeout': 'The search took too long. Try again.',
    'rate-limited': "You've run several Story Searches in a short time. Try again in a few minutes.",
    'out-of-credit': "Story Search has used this month's free searches. It works again when they renew at the start of next month.",
    unavailable: "LinkPeek's server couldn't be reached. Try again later.",
    'bad-response': "LinkPeek's server sent an answer it couldn't read. Try again later.",
  } satisfies Record<StoryErrorCode, string>,
  retry: 'Try again',
  byAi: "Written by AI (Claude) from web search results, then checked by LinkPeek's rules. Read the sources to check it yourself.",
  checked: (date: string) => `Checked ${date}.`,
  sourceRef: (n: number) => `Source ${n}`,
  openLink: 'Open link',
  openSource: 'opens in a new tab',
};

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
  noKnownWarningNote: "This isn't a guarantee of safety.",
  story: STORY,
} as const;

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

/** Link warnings shown in the compact card. "no-known-warning" and "not-checked" stay quiet there. */
export const RISK_WARNING: Partial<Record<LinkRiskLevel, string>> = {
  'known-threat': 'Known threat detected',
  suspicious: 'Suspicious destination',
  mismatch: 'Goes somewhere different from what it shows',
};

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
  paywall: `${SITE_BLOCKED} It's behind a subscription.`,
  'bot-challenge': `${SITE_BLOCKED} The site asked for a human check.`,
  'js-rendered-empty': `${SITE_BLOCKED} The page needs to run in a browser tab to show its text.`,
  'extraction-failed': "Couldn't find the article text on this page.",
  'unsupported-type': MSG.unsupported,
  'too-large': `${SITE_BLOCKED} It's too large to preview.`,
  'summary-failed': MSG.summaryFailed,
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
