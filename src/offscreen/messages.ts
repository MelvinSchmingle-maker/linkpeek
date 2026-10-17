/** Messages between the service worker and the offscreen document. */
import type { Assessment } from '../core/extract/assess';
import type { RawFetch } from '../core/retrieve/fetcher';
import type { SummaryEngine } from '../core/summary/provider';
import type { RemoteConfig } from '../core/summary/remote';

export const OFFSCREEN_TARGET = 'linkpeek-offscreen';

export interface OffscreenRequest {
  target: typeof OFFSCREEN_TARGET;
  type: 'assess';
  raw: RawFetch;
  /** The link's text, so a summary that only repeats it can be rejected. */
  headline: string;
  engine: SummaryEngine;
  /** Only when the engine is "remote": where the backend is, and this install's random ID. */
  remote?: RemoteConfig;
  /** Reading mode (Part 12) asked for the article's paragraphs. */
  readable?: boolean;
}

export type OffscreenResponse = { ok: true; assessment: Assessment } | { ok: false; error: string };

export function isOffscreenRequest(msg: unknown): msg is OffscreenRequest {
  return typeof msg === 'object' && msg !== null && (msg as { target?: unknown }).target === OFFSCREEN_TARGET;
}
