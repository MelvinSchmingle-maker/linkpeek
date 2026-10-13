/** Messages the popup and service worker send to the content script. */
export type ContentMessage =
  | { type: 'ping' }
  /** One-off scan of the page (Scan mode, or the popup button in any mode). */
  | { type: 'scan' }
  /** Open the card for the link with this URL (right-click > Peek). */
  | { type: 'peek'; url: string }
  /** Open the card for the focused link (keyboard shortcut). */
  | { type: 'peek-focused' };

export interface ContentResponse {
  ok: boolean;
  /** For scan: how many links now have an icon. */
  found?: number;
}

export function isContentMessage(msg: unknown): msg is ContentMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    ['ping', 'scan', 'peek', 'peek-focused'].includes((msg as { type: string }).type)
  );
}
