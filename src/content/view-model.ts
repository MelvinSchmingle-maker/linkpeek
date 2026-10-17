/**
 * Decides what the card shows for a result. Pure: no DOM, no chrome APIs,
 * so every state is easy to unit test.
 */
import {
  ARTICLE_KIND_LABEL,
  EVIDENCE_TAG,
  FAILURE_MESSAGE,
  LINK_CHECK_LABEL,
  LINK_NOT_A_GUARANTEE,
  MSG,
  opensOn,
  permissionNeeded,
  RISK_WARNING,
  SOURCE_FROM,
  SUMMARY_BY,
  VERDICT_LABEL,
} from '../core/messages';
import { siteOf } from '../core/retrieve/url';
import type { HeadlineVerdict, LinkResult, LinkRisk, PrimaryCounts, SourceInfo } from '../core/types';

/** One fact in "About this source": what it says, and where it came from. */
export interface SourceLine {
  label: string;
  value: string;
  from?: string;
}

export type CardInput =
  | { kind: 'loading'; isDemo: boolean; risk?: LinkRisk }
  /** `readingMode`: the user has reading mode on for this site (Part 12). */
  | { kind: 'result'; result: LinkResult; readingMode?: boolean };

/** The link check's line under the card: the outcome, and any notes that go with it. */
export interface LinkCheckLine {
  label: string;
  notes: string[];
}

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
  /** Offer "Disagree with this rating?" under a tick or cross (never under "no verdict"). */
  canDisagree?: boolean;
  /** The link check's outcome, shown quietly under the card when there's no warning row. */
  linkCheck?: LinkCheckLine;
  /** Offer "Don't warn me on this site" with a warning. */
  canOverrule?: boolean;
  /** The site a warning or an overrule is about. */
  warningSite?: string;
  /** Offer "Check where this link goes" (asks the site, once, when pressed). */
  canCheckWhere?: boolean;
  /** Offer "Read here" (reading mode, Part 12): only for a full article, when the user has it on. */
  canReadHere?: boolean;
  /** "About this source": one line per fact, each with where it came from. Only when the page was read. */
  sourceLines?: SourceLine[];
  /** A small factual note, e.g. the link opens on another site. */
  note?: string;
  /** A button the card offers (e.g. "Allow access…"), handled by the card's owner. */
  action?: string;
  showFeedback: boolean;
}

export function toCardView(input: CardInput): CardView {
  if (input.kind === 'loading') {
    const view: CardView = { isDemo: input.isDemo, loading: true, message: MSG.loading, showFeedback: false, openLabel: MSG.openArticle };
    if (input.risk) riskView(view, input.risk);
    return view;
  }

  const r = input.result;
  const view: CardView = {
    isDemo: r.isDemo,
    loading: false,
    evidenceTag: EVIDENCE_TAG[r.evidence],
    showFeedback: false,
    openLabel: MSG.openArticle,
  };
  riskView(view, r.linkRisk);
  view.canReadHere = Boolean(input.readingMode && r.evidence === 'full' && !r.isDemo && !r.failure);
  if (r.finalUrl && siteOf(r.finalUrl) && siteOf(r.finalUrl) !== siteOf(r.url)) view.note = opensOn(siteOf(r.finalUrl));
  if (r.source) view.sourceLines = sourceLines(r.source);

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

/**
 * The link check, as the card shows it. A suspicious or mismatched link gets a
 * warning row (unless the user has switched warnings off for its site). Every
 * other outcome gets a quiet line. Nothing here says a link is safe.
 */
function riskView(view: CardView, risk: LinkRisk | undefined): void {
  if (!risk) return;
  const warnable = risk.level === 'suspicious' || risk.level === 'mismatch' || risk.level === 'known-threat';
  if (risk.site) view.warningSite = risk.site;
  if (warnable && !risk.overruled) {
    view.warning = RISK_WARNING[risk.level];
    view.warningDetail = risk.reason;
    view.openLabel = MSG.openAnyway;
    view.canOverrule = Boolean(risk.site);
  }
  // Demo cards show fixtures, not a real check, so they get no link check line.
  if (view.isDemo) return;
  if (warnable && risk.overruled && risk.site) {
    view.linkCheck = { label: LINK_CHECK_LABEL[risk.level], notes: [MSG.overruled(risk.site)] };
  } else if (!warnable) {
    const notes = risk.level === 'no-known-warning' ? [LINK_NOT_A_GUARANTEE] : risk.reason ? [risk.reason] : [];
    view.linkCheck = { label: LINK_CHECK_LABEL[risk.level], notes };
  }
  if (risk.note && view.linkCheck) view.linkCheck.notes.push(risk.note);
  if (risk.site) view.canCheckWhere = true;
}

function addVerdict(view: CardView, r: LinkResult): void {
  const { verdict, reason, notChecked, rewrite, revealsWithheld } = r.headlineCheck;
  if (notChecked) return;
  view.status = { verdict, label: VERDICT_LABEL[verdict] };
  view.canDisagree = verdict !== 'unknown';
  view.reason = reason ?? (verdict === 'unknown' && r.evidence !== 'full' ? MSG.insufficient : undefined);
  view.showDefinitions = true;
  if (rewrite) {
    view.rewrite = rewrite;
    view.rewriteLabel = MSG.rewriteLabel;
    if (revealsWithheld) view.revealNote = MSG.revealNote;
  }
}

/** The source card's lines. A fact we don't have is "Not stated", never a negative. */
export function sourceLines(s: SourceInfo): SourceLine[] {
  return [
    line('Publisher', s.publisher?.value, s.publisher?.from),
    line('Published', formatDate(s.published?.value), s.published?.from),
    line('Last updated', formatDate(s.modified?.value), s.modified?.from),
    line('Author', s.author?.value, s.author?.from),
    line('Article type', s.articleType && ARTICLE_KIND_LABEL[s.articleType.value], s.articleType?.from),
    line('Links to primary sources', s.primarySources && primaryText(s.primarySources.value), s.primarySources?.from),
  ];
}

function line(label: string, value: string | undefined, from: keyof typeof SOURCE_FROM | undefined): SourceLine {
  if (!value) return { label, value: MSG.notStated };
  return { label, value, ...(from ? { from: SOURCE_FROM[from] } : {}) };
}

function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "2 links to government sites, 1 link to a research paper", or none. Counts only, never a verdict. */
function primaryText(c: PrimaryCounts): string {
  const kinds: [number, string, string][] = [
    [c.government, 'link to a government site', 'links to government sites'],
    [c.court, 'link to a court page', 'links to court pages'],
    [c.research, 'link to a research paper', 'links to research papers'],
    [c.pdf, 'link to a PDF', 'links to PDFs'],
  ];
  const parts = kinds.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return parts.length ? parts.join(', ') : 'No links to government sites, courts, research papers or PDFs';
}

