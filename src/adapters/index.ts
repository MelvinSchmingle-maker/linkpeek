/**
 * Social adapters (Part 13): the shared hook. The service worker asks this
 * registry before the general reader. No platform adapter is registered yet:
 * each one waits for its own research and the owner's decision (docs/adapters/).
 *
 * An adapter returns either a full answer, or undefined to let the general
 * reader handle the link. It never sends data anywhere the general reader
 * wouldn't, and it never reads a page the user didn't open.
 */
import type { Assessment } from '../core/extract/assess';

export interface AdapterContext {
  url: URL;
  headline: string;
}

export interface Adapter {
  id: string;
  matches(url: URL): boolean;
  /** An answer in the same shape and evidence levels as the general reader, or undefined to fall back. */
  read(ctx: AdapterContext): Promise<Assessment | undefined>;
}

export const ADAPTERS: Adapter[] = [];

/** The adapter for this address, if any platform adapter claims it. */
export function adapterFor(url: URL, adapters: Adapter[] = ADAPTERS): Adapter | undefined {
  return adapters.find((a) => a.matches(url));
}
