/**
 * One Story Search, as the card sees it:
 *
 *  1. Extracting: read the link and its surroundings (extract.ts). Nothing
 *     leaves the device. Not enough to go on: say so and stop.
 *  2. First time only: show exactly what would be sent, and wait for
 *     "Search" or "Not now".
 *  3. Searching, analysing, preparing: the stages the server reports, as it
 *     reaches them, over a port to the service worker.
 *  4. The report, or a plain message about what went wrong.
 *
 * Closing the card stops the search (the port closes, the worker aborts).
 */
import { extractStoryClues } from '../core/story/extract';
import { buildPackage, type StoryPackage } from '../core/story/package';
import { giveStoryConsent, hasStoryConsent } from '../core/story/consent';
import type { StoryEvent } from '../core/story/client';
import type { StoryState } from './story-view';

/** Same as STORY_PORT in background/story.ts (not imported, so the content script stays free of worker code). */
const PORT_NAME = 'linkpeek-story';

export class StoryRun {
  private port?: chrome.runtime.Port;
  private pkg?: StoryPackage;
  private finished = false;
  private cancelled = false;
  private subject?: string;

  constructor(
    private readonly link: HTMLAnchorElement,
    private readonly selection: string | undefined,
    private readonly show: (state: StoryState) => void,
  ) {}

  /** Step 1, then 2 or 3. */
  async begin(): Promise<void> {
    this.show({ kind: 'progress', stage: 'extracting' });
    try {
      this.pkg = buildPackage(extractStoryClues(this.link, { selection: this.selection }));
    } catch {
      // A page built in a way the extractor can't read: treat it as nothing to go on, never as a hang.
      this.pkg = { ok: false, reason: 'insufficient' };
    }
    if (!this.pkg.ok) {
      this.end({ kind: this.pkg.reason === 'insufficient' ? 'insufficient' : 'not-a-web-link' });
      return;
    }
    const r = this.pkg.request;
    this.subject = r.headline?.text ?? r.altHeadlines?.[0]?.text ?? r.description?.text ?? r.slug ?? r.context?.text;
    let consented = false;
    try {
      consented = await hasStoryConsent();
    } catch {
      // Storage unreadable: ask, which is the safe default.
    }
    if (this.cancelled) return;
    if (consented) this.search();
    else this.show({ kind: 'confirm', preview: this.pkg.preview, ...(this.subject ? { subject: this.subject } : {}) });
  }

  /** "Search" pressed on the confirmation. */
  confirm(): void {
    if (this.cancelled || !this.pkg?.ok) return;
    void giveStoryConsent().catch(() => undefined);
    this.search();
  }

  /** "Try again". */
  retry(): void {
    if (this.cancelled || !this.pkg?.ok) return;
    this.finished = false;
    this.search();
  }

  /** The card closed, or "Not now". */
  cancel(): void {
    this.cancelled = true;
    this.finished = true;
    try {
      this.port?.disconnect();
    } catch {
      // Already gone.
    }
    this.port = undefined;
  }

  private search(): void {
    if (!this.pkg?.ok) return;
    const subject = this.subject ? { subject: this.subject } : {};
    this.show({ kind: 'progress', stage: 'searching', ...subject });
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch {
      this.end({ kind: 'error', code: 'unavailable', ...subject });
      return;
    }
    this.port = port;
    port.onMessage.addListener((m: StoryEvent) => {
      if (this.finished || port !== this.port) return;
      if (m.kind === 'stage') this.show({ kind: 'progress', stage: m.stage, ...subject });
      else if (m.kind === 'report') this.end({ kind: 'report', report: m.report });
      else if (m.kind === 'error') this.end({ kind: 'error', code: m.code, ...subject });
    });
    port.onDisconnect.addListener(() => {
      // The worker went away before answering (Chrome restarted it, or the extension updated).
      if (!this.finished && port === this.port) this.end({ kind: 'error', code: 'unavailable', ...subject });
    });
    port.postMessage({ type: 'story-search', request: this.pkg.request });
  }

  private end(state: StoryState): void {
    this.finished = true;
    if (!this.cancelled) this.show(state);
  }
}
