/**
 * What the Story Search card shows, for every state. Pure: no DOM and no
 * chrome APIs, so each state is easy to test.
 *
 * Rules it keeps:
 * - A failed, empty or inconclusive search never looks like a finished
 *   report: no "What happened?" section, and it says why.
 * - A report built on possible matches says so, above everything else.
 * - Every factual line carries its source numbers.
 * - The original link is never opened by the card; it's only a link.
 */
import { MSG } from '../core/messages';
import type { PreviewLine } from '../core/story/package';
import type { StoryErrorCode, StoryReport, StoryStage } from '../core/story/types';

const S = MSG.story;

export type StoryState =
  | { kind: 'confirm'; preview: PreviewLine[]; subject?: string }
  | { kind: 'progress'; stage: StoryStage; subject?: string }
  | { kind: 'insufficient' }
  | { kind: 'not-a-web-link' }
  | { kind: 'error'; code: StoryErrorCode; subject?: string }
  | { kind: 'report'; report: StoryReport };

export type Tone = 'strong' | 'possible' | 'none' | 'conflicting' | 'neutral';

export interface ViewItem {
  label?: string;
  text: string;
  refs: number[];
  /** The passages behind it, shown on request: "[2] BBC News" and the quote. */
  evidence?: { ref: string; quote: string }[];
  /** Its passages don't fully carry it. */
  weak?: boolean;
}

/** Headline accuracy, as shown. */
export interface ViewHeadline {
  heading: string;
  headline: string;
  verdict: string;
  tone: Tone;
  reason: string;
  evidence: { ref: string; quote: string }[];
}

export interface ViewSection {
  id: 'what-happened' | 'details' | 'confirmed' | 'reported' | 'unclear';
  heading: string;
  note?: string;
  kind: 'paragraph' | 'list' | 'details';
  items: ViewItem[];
}

export interface ViewSource {
  n: number;
  title: string;
  url: string;
  /** "BBC News · 24 November 2026 · News" */
  meta: string;
  tags: string[];
}

export interface StoryView {
  title: string;
  subject?: string;
  subjectLabel?: string;
  tags: { text: string; tone: Tone }[];
  stages?: { label: string; state: 'done' | 'active' | 'todo' }[];
  /** A plain explanation: why there's no report, or what went wrong. */
  message?: string;
  /** A caution shown above the report. */
  caution?: string;
  confirm?: { intro: string; lines: { label: string; text: string; from?: string }[]; notSent: string; go: string; cancel: string };
  sections: ViewSection[];
  notes: string[];
  headline?: ViewHeadline;
  sourcesHeading?: string;
  sources: ViewSource[];
  searchedFor?: string;
  setAside?: string;
  retry?: string;
  footnote?: string;
  openLabel: string;
  busy: boolean;
}

const STAGES: StoryStage[] = ['extracting', 'searching', 'analysing', 'writing'];
/** Errors worth trying again for. */
const RETRYABLE = new Set<StoryErrorCode>(['search-failed', 'search-timeout', 'unavailable', 'bad-response', 'rate-limited']);

export function formatDay(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  // A month only ("2026-11", from an address like /2026/11/): never invent a day.
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const t = Date.parse(`${iso}-15T12:00:00Z`);
    return Number.isNaN(t) ? undefined : new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function toStoryView(state: StoryState): StoryView {
  const view: StoryView = { title: S.title, tags: [], sections: [], notes: [], sources: [], openLabel: S.openLink, busy: false };

  switch (state.kind) {
    case 'confirm':
      if (state.subject) {
        view.subject = state.subject;
        view.subjectLabel = S.lookingInto;
      }
      view.confirm = {
        intro: S.confirmIntro,
        lines: state.preview.map((l) => ({
          label: S.previewLabel[l.label],
          text: l.label === 'date' ? (formatDay(l.text) ?? l.text) : l.text,
          ...(l.from && l.label !== 'address' ? { from: S.clueFrom[l.from] } : {}),
        })),
        notSent: S.confirmNotSent,
        go: S.confirmGo,
        cancel: S.confirmCancel,
      };
      return view;

    case 'progress': {
      if (state.subject) {
        view.subject = state.subject;
        view.subjectLabel = S.lookingInto;
      }
      const at = STAGES.indexOf(state.stage);
      view.stages = STAGES.map((s, i) => ({ label: S.stages[s], state: i < at ? 'done' : i === at ? 'active' : 'todo' }));
      view.busy = true;
      return view;
    }

    case 'insufficient':
      view.message = S.insufficient;
      return view;

    case 'not-a-web-link':
      view.message = S.notAWebLink;
      return view;

    case 'error':
      if (state.subject) {
        view.subject = state.subject;
        view.subjectLabel = S.lookingInto;
      }
      view.message = S.error[state.code];
      if (RETRYABLE.has(state.code)) view.retry = S.retry;
      return view;

    case 'report':
      return reportView(view, state.report);
  }
}

function reportView(view: StoryView, r: StoryReport): StoryView {
  view.searchedFor = r.searchedFor || undefined;
  if (r.setAside > 0) view.setAside = S.setAside(r.setAside);
  // A vague link's explanation goes at the top, as the caution, not among the notes at the end.
  view.notes = r.notes.filter((n) => n !== 'vague-link').map((n) => S.note[n]);

  if (r.status === 'no-results' || r.status === 'no-match') {
    view.tags.push({ text: S.match.none, tone: 'none' });
    view.message = r.status === 'no-results' ? S.noResults : S.noMatch;
    return view;
  }

  view.sources = r.sources.map((s) => ({
    n: s.n,
    title: s.title,
    url: s.url,
    meta: [s.publisher, formatDay(s.published), s.updated && s.updated !== s.published ? S.updated(formatDay(s.updated) ?? s.updated) : undefined, S.kind[s.kind]].filter(Boolean).join(' · '),
    tags: [
      ...(s.original ? [S.original] : []),
      ...(s.corrected ? [S.corrected] : []),
      ...(s.match === 'possible' && r.status === 'report' ? [S.possibleTag] : []),
      ...(s.copyOf !== undefined ? [S.repeats(s.copyOf)] : s.via && s.kind !== 'agency' ? [S.credits(s.via)] : []),
    ],
  }));

  if (r.status === 'report-failed') {
    view.tags.push({ text: S.match[r.sources.length ? 'possible' : 'none'], tone: r.sources.length ? 'possible' : 'none' });
    view.message = r.sources.length ? S.reportFailed : S.noMatch;
    view.sourcesHeading = r.sources.length ? S.possibleSources : undefined;
    view.retry = S.retry;
    return view;
  }

  view.subject = r.subject;
  view.tags.push({ text: S.match[r.match], tone: r.match });
  view.tags.push({ text: S.confidence[r.confidence], tone: r.confidence === 'strong' ? 'strong' : r.confidence === 'conflicting' ? 'conflicting' : 'neutral' });
  if (r.notes.includes('vague-link')) view.caution = S.note['vague-link'];
  else if (r.match === 'possible') view.caution = S.possibleOnly;

  const publisherOf = (n: number) => r.sources.find((s) => s.n === n)?.publisher ?? '';
  const quotes = (list: { source: number; quote: string }[] | undefined) => (list ?? []).map((q) => ({ ref: `[${q.source}] ${publisherOf(q.source)}`.trim(), quote: q.quote }));
  const items = (list: { text: string; sources: number[]; evidence?: { source: number; quote: string }[]; weak?: boolean }[]) =>
    list.map((c) => ({ text: c.text, refs: c.sources, ...(c.evidence?.length ? { evidence: quotes(c.evidence) } : {}), ...(c.weak ? { weak: true } : {}) }));
  if (r.whatHappened.length) view.sections.push({ id: 'what-happened', heading: S.whatHappened, kind: 'paragraph', items: items(r.whatHappened) });
  if (r.details.length) {
    view.sections.push({ id: 'details', heading: S.keyDetails, kind: 'details', items: r.details.map((d) => ({ label: S.detail[d.label], ...items([d])[0]! })) });
  }
  if (r.confirmed.length) view.sections.push({ id: 'confirmed', heading: S.confirmed, note: S.confirmedNote, kind: 'list', items: items(r.confirmed) });
  if (r.reported.length) view.sections.push({ id: 'reported', heading: S.reported, note: S.reportedNote, kind: 'list', items: items(r.reported) });
  if (r.unclear.length) view.sections.push({ id: 'unclear', heading: S.unclear, kind: 'list', items: items(r.unclear) });
  if (r.headline) {
    const tone: Record<typeof r.headline.verdict, Tone> = { accurate: 'strong', 'partly-accurate': 'possible', misleading: 'conflicting', unverified: 'neutral' };
    view.headline = { heading: S.headlineHeading, headline: r.headline.headline, verdict: S.verdict[r.headline.verdict], tone: tone[r.headline.verdict], reason: r.headline.reason, evidence: quotes(r.headline.evidence) };
  }
  view.sourcesHeading = r.match === 'possible' ? S.possibleSources : S.sources;
  const day = formatDay(r.checkedAt);
  // "Written by AI" only when something was written; a vague link's card is a list of sources.
  view.footnote = view.sections.length ? (day ? `${S.byAi} ${S.checked(day)}` : S.byAi) : day ? S.checked(day) : undefined;
  return view;
}
