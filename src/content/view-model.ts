/**
 * Decides what the card shows for a result. Pure: no DOM, no chrome APIs,
 * so every state is easy to unit test.
 */
import {
  EVIDENCE_TAG,
  FAILURE_MESSAGE,
  MSG,
  opensOn,
  permissionNeeded,
  RISK_WARNING,
  SUMMARY_BY,
  VERDICT_LABEL,
} from '../core/messages';
import { siteOf } from '../core/retrieve/url';
import type { HeadlineVerdict, LinkResult } from '../core/types';

export type CardInput = { kind: 'loading'; isDemo: boolean } | { kind: 'result'; result: LinkResult };

export interface CardView {
  /** Tick / cross / neutral mark. Absent while loading, when nothing could be read, or when no check ran. */
  status?: { verdict: HeadlineVerdict; label: string };
  evidenceTag?: string;
  isDemo: boolean;
  loading: boolean;
  warning?: string;
  /** Why the warning was raised, e.g. which domain the link really goes to. */
  warningDetail?: string;
  /** Wording for the link back to the original. */
  openLabel: string;
  /** The one-sentence summary, when we really have one. */
  summary?: string;
  /** Who wrote the summary ("In the article's own words:"). */
  summaryLabel?: string;
  /** What the article text begins with, while there's no summary. Always introduced by extractLabel. */
  extract?: string;
  extractLabel?: string;
  /** An explanatory line (preview notice, failure reason, etc). */
  message?: string;
  /** Preview text for partial results, shown under the message. */
  preview?: string;
  /** One-line reason for a headline verdict. */
  reason?: string;
  /** A plainer headline from the article. Only with a fail verdict and the full article. */
  rewrite?: string;
  rewriteLabel?: string;
  /** The rewrite states a result the headline held back. */
  revealNote?: string;
  /** Offer the "What does this mean?" explanation of the three outcomes. */
  showDefinitions?: boolean;
  /** A small factual note, e.g. the link opens on another site. */
  note?: string;
  /** A button the card offers (e.g. "Allow access…"), handled by the card's owner. */
  action?: string;
  showFeedback: boolean;
}

export function toCardView(input: CardInput): CardView {
  if (input.kind === 'loading') {
    return { isDemo: input.isDemo, loading: true, message: MSG.loading, showFeedback: false, openLabel: MSG.openArticle };
  }

  const r = input.result;
  const view: CardView = {
    isDemo: r.isDemo,
    loading: false,
    evidenceTag: EVIDENCE_TAG[r.evidence],
    warning: RISK_WARNING[r.linkRisk.level],
    showFeedback: false,
    openLabel: MSG.openArticle,
  };
  if (view.warning) {
    view.warningDetail = r.linkRisk.reason;
    view.openLabel = MSG.openAnyway;
  }
  if (r.finalUrl && siteOf(r.finalUrl) && siteOf(r.finalUrl) !== siteOf(r.url)) view.note = opensOn(siteOf(r.finalUrl));

  if (r.needsPermissionFor) {
    view.message = permissionNeeded(r.needsPermissionFor);
    view.action = MSG.allow;
    return view;
  }

  if (r.unsupported) {
    view.message = MSG.unsupported;
    if (!view.warning) view.openLabel = MSG.openLink;
    return view;
  }

  if (r.failure) {
    view.message = FAILURE_MESSAGE[r.failure];
    // Some failures still leave something honest to show: a subscription
    // page's own public description, for example.
    if (r.preview) view.preview = r.summary?.text ?? r.preview;
    // A verdict on the headline's wording can still help when the article
    // failed. A bare "no verdict" would only add clutter, so skip it.
    if (r.headlineCheck.verdict !== 'unknown') addVerdict(view, r);
    return view;
  }

  switch (r.evidence) {
    case 'full':
      if (r.summary) {
        view.summary = r.summary.text;
        view.summaryLabel = SUMMARY_BY[r.summary.provider];
        view.showFeedback = true;
      } else if (r.extract?.firstSentence) {
        view.extractLabel = MSG.extractLabel;
        view.extract = r.extract.firstSentence;
      } else {
        view.message = MSG.summaryFailed;
      }
      break;
    case 'partial':
      if (r.extract?.truncated && r.extract.firstSentence) {
        view.extractLabel = MSG.pdfPartial;
        view.extract = r.extract.firstSentence;
      } else {
        view.message = MSG.partialIntro;
        // A preview fitted to 20 words when the summary engine managed it, else Part 04's.
        view.preview = r.summary?.text ?? r.preview;
        view.showFeedback = Boolean(r.preview) && r.isDemo;
      }
      break;
    case 'headline-only':
      view.message = MSG.headlineOnly;
      break;
    case 'unavailable':
      view.message = MSG.unavailable;
      break;
  }

  addVerdict(view, r);
  return view;
}

function addVerdict(view: CardView, r: LinkResult): void {
  const { verdict, reason, notChecked, rewrite, revealsWithheld } = r.headlineCheck;
  if (notChecked) return;
  view.status = { verdict, label: VERDICT_LABEL[verdict] };
  view.reason = reason ?? (verdict === 'unknown' && r.evidence !== 'full' ? MSG.insufficient : undefined);
  view.showDefinitions = true;
  if (rewrite) {
    view.rewrite = rewrite;
    view.rewriteLabel = MSG.rewriteLabel;
    if (revealsWithheld) view.revealNote = MSG.revealNote;
  }
}
