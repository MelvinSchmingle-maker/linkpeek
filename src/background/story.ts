/**
 * Story Search in the service worker. The card in the page opens a port,
 * sends what it found about the link, and gets stages and the report back.
 * Closing the card closes the port, which stops the request.
 *
 * The request goes from here, not from the page, so it carries the
 * extension's origin rather than the page's, with no cookies or referrer.
 */
import { runStorySearch, type StoryEvent } from '../core/story/client';
import { getStoryReport, setStoryReport, storyKey } from '../core/story/cache';
import type { StoryRequestClues } from '../core/story/types';
import { getInstallId, STORY_INSTALL_KEY } from '../core/storage/install-id';
import { getSettings } from '../core/storage/settings';

export const STORY_PORT = 'linkpeek-story';

/** What the card sends over the port. */
export interface StoryPortRequest {
  type: 'story-search';
  request: StoryRequestClues;
}

/** What the worker sends back. */
export type StoryPortMessage = StoryEvent;

function isRequest(msg: unknown): msg is StoryPortRequest {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as { type?: unknown; request?: { url?: unknown } };
  return m.type === 'story-search' && typeof m.request === 'object' && m.request !== null && typeof m.request.url === 'string';
}

export function registerStoryPort(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== STORY_PORT) return;
    // Only LinkPeek's own content script, in a tab.
    if (port.sender?.id !== chrome.runtime.id || port.sender.tab?.id === undefined) {
      port.disconnect();
      return;
    }
    const controller = new AbortController();
    let open = true;
    port.onDisconnect.addListener(() => {
      open = false;
      controller.abort();
    });
    const post = (m: StoryPortMessage) => {
      if (!open) return;
      try {
        port.postMessage(m);
      } catch {
        open = false;
      }
    };
    let started = false;
    port.onMessage.addListener((msg: unknown) => {
      if (started || !isRequest(msg)) return;
      started = true;
      void search(msg.request, post, controller.signal).finally(() => {
        if (open) port.disconnect();
      });
    });
  });
}

async function search(request: StoryRequestClues, post: (m: StoryPortMessage) => void, signal: AbortSignal): Promise<void> {
  const settings = await getSettings();
  if (!settings.storySearch) {
    post({ kind: 'error', code: 'not-configured' });
    return;
  }
  const key = await storyKey(request);
  const cached = await getStoryReport(key);
  if (cached) {
    post({ kind: 'report', report: cached });
    return;
  }
  if (!__STORY_API_URL__) {
    post({ kind: 'error', code: 'not-configured' });
    return;
  }
  const installId = await getInstallId(Date.now(), STORY_INSTALL_KEY);
  const last = await runStorySearch(__STORY_API_URL__, { ...request, installId }, post, { signal });
  // A report the AI couldn't write is a passing problem: not kept, so "Try again" really tries again.
  if (last.kind === 'report' && last.report.status !== 'report-failed') await setStoryReport(key, last.report);
}
