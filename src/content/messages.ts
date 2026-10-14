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
  | { type: 'refresh' };

export interface ContentResponse {
  ok: boolean;
  /** For scan: how many links now have an icon. */
  found?: number;
}

const TYPES = new Set(['ping', 'scan', 'peek', 'peek-focused', 'refresh']);

export function isContentMessage(msg: unknown): msg is ContentMessage {
  return typeof msg === 'object' && msg !== null && TYPES.has((msg as { type?: unknown }).type as string);
}

/** Messages the content script sends to the service worker. */
export type WorkerMessage = { type: 'site-status' };

export interface SiteStatus {
  /** LinkPeek has access to this site, so Smart mode may run here by itself. */
  allowed: boolean;
}
