/**
 * Every user-facing sentence in one place. Short, plain, no blame, no jargon.
 * Never imply a page was read when it wasn't.
 */
import type { EvidenceLevel, FailureReason, HeadlineVerdict, LinkRiskLevel } from './types';

export const MSG = {
  iconLabel: 'Preview this link with LinkPeek',
  cardLabel: 'LinkPeek preview',
  close: 'Close preview',
  loading: 'Summarising article...',
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
  notReady: "This test version of LinkPeek can't read articles yet. It only shows where previews will appear.",
  feedbackQuestion: 'Was this useful?',
  feedbackUp: 'Yes, useful',
  feedbackDown: 'No, not useful',
  feedbackThanks: 'Thanks for the feedback.',
  feedbackFailed: "Couldn't save your feedback.",
  noKnownWarningNote: "This isn't a guarantee of safety.",
} as const;

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
