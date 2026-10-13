/**
 * Decides what the card shows for a result. Pure: no DOM, no chrome APIs,
 * so every state is easy to unit test.
 */
import {
  EVIDENCE_TAG,
  FAILURE_MESSAGE,
  MSG,
  RISK_WARNING,
  VERDICT_LABEL,
} from '../core/messages';
import type { HeadlineVerdict, LinkResult } from '../core/types';

export type CardInput =
  | { kind: 'loading'; isDemo: boolean }
  /** Article reading isn't built yet (Part 04). Says so plainly. */
  | { kind: 'not-ready' }
  | { kind: 'result'; result: LinkResult };

export interface CardView {
  /** Tick / cross / neutral mark. Absent while loading or when nothing could be read. */
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
  /** An explanatory line (preview notice, failure reason, etc). */
  message?: string;
  /** Preview text for partial results, shown under the message. */
  preview?: string;
  /** One-line reason for a headline verdict. */
  reason?: string;
  showFeedback: boolean;
}

export function toCardView(input: CardInput): CardView {
  if (input.kind === 'loading') {
    return { isDemo: input.isDemo, loading: true, message: MSG.loading, showFeedback: false, openLabel: MSG.openArticle };
  }

  if (input.kind === 'not-ready') {
    return { isDemo: false, loading: false, message: MSG.notReady, showFeedback: false, openLabel: MSG.openArticle };
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

  if (r.unsupported) {
    view.message = MSG.unsupported;
    if (!view.warning) view.openLabel = MSG.openLink;
    return view;
  }

  if (r.failure) {
    view.message = FAILURE_MESSAGE[r.failure];
    // A verdict on the headline's wording can still help when the article
    // failed. A bare "no verdict" would only add clutter, so skip it.
    if (r.headlineCheck.verdict !== 'unknown') addVerdict(view, r);
    return view;
  }

  switch (r.evidence) {
    case 'full':
      if (r.summary) {
        view.summary = r.summary.text;
        view.showFeedback = true;
      } else {
        view.message = MSG.summaryFailed;
      }
      break;
    case 'partial':
      view.message = MSG.partialIntro;
      view.preview = r.preview;
      view.showFeedback = Boolean(r.preview);
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
  const { verdict, reason } = r.headlineCheck;
  view.status = { verdict, label: VERDICT_LABEL[verdict] };
  view.reason = reason ?? (verdict === 'unknown' ? MSG.insufficient : undefined);
}
