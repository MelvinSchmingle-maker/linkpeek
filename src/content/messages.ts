import type { RetrieveRequest } from '../background/retrieve';
/** Messages the popup and service worker send to the content script. */
export type ContentMessage =
  | { type: 'ping' }
  /** One-off scan of the page (Scan mode, or the popup button in any mode). */
  | { type: 'scan' }
  /** Open the card for the link with this URL (right-click > Peek). */
  | { type: 'peek'; url: string }
  /** Open the card for the focused link (keyboard shortcut). */
  | { type: 'peek-focused' }
  /** The site was turned on or off: check again whether to run by itself. */
  | { type: 'refresh' }
  /** A card is about to open in another frame of this tab: close ours. */
  | { type: 'close-card' }
  /** Access to a site was just granted: try the open card's link again. */
  | { type: 'retry' }
  /** "Undo on this page" (Part 12): put back anything the annoyance tools hid or labelled. */
  | { type: 'annoyance-undo' };

export interface ContentResponse {
  ok: boolean;
  /** For scan: how many links now have an icon. */
  found?: number;
}

const TYPES = new Set(['ping', 'scan', 'peek', 'peek-focused', 'refresh', 'close-card', 'retry', 'annoyance-undo']);

export function isContentMessage(msg: unknown): msg is ContentMessage {
  return typeof msg === 'object' && msg !== null && TYPES.has((msg as { type?: unknown }).type as string);
}

/** Why a "check where this link goes" couldn't finish. */
export type RedirectCheckError = 'no-access' | 'timeout' | 'network' | 'unsafe-address' | 'wrapper';
export type RedirectCheckResult = { kind: 'ok'; finalUrl: string } | { kind: 'error'; reason: RedirectCheckError };

/** Messages the content script and LinkPeek's pages send to the service worker. */
export type WorkerMessage =
  | { type: 'site-status' }
  | RetrieveRequest
  /** "Check where this link goes" (Part 11): asks the link's site where it ends up, once, without cookies. */
  | { type: 'check-redirects'; url: string }
  /** Open LinkPeek's small window that asks for access to a link's site. */
  | { type: 'open-permission'; url: string; also?: string }
  /** Sent by that window once access is granted. */
  | { type: 'permission-granted'; tabId: number }
  /** The user asked for the site's corrections page (Part 08). */
  | { type: 'corrections'; url: string };

const WORKER_TYPES = new Set(['site-status', 'retrieve', 'open-permission', 'permission-granted', 'corrections', 'check-redirects']);

export function isWorkerMessage(msg: unknown): msg is WorkerMessage {
  return typeof msg === 'object' && msg !== null && WORKER_TYPES.has((msg as { type?: unknown }).type as string);
}

export interface SiteStatus {
  /** LinkPeek has access to this site, so Smart mode may run here by itself. */
  allowed: boolean;
}
