/** Messages between the service worker and the offscreen document. */
import type { Assessment } from '../core/extract/assess';
import type { RawFetch } from '../core/retrieve/fetcher';

export const OFFSCREEN_TARGET = 'linkpeek-offscreen';

export interface OffscreenRequest {
  target: typeof OFFSCREEN_TARGET;
  type: 'assess';
  raw: RawFetch;
}

export type OffscreenResponse = { ok: true; assessment: Assessment } | { ok: false; error: string };

export function isOffscreenRequest(msg: unknown): msg is OffscreenRequest {
  return typeof msg === 'object' && msg !== null && (msg as { target?: unknown }).target === OFFSCREEN_TARGET;
}
