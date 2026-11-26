/**
 * Finished reports, so many people asking about the same link pay for one
 * search, not many.
 *
 * Kept in this function instance's memory only. Serverless functions run as
 * several short-lived copies, so this saves repeats that land on the same
 * warm copy, not every repeat. A shared store (Vercel's Runtime Cache, or a
 * key-value database) would save more, and is the next step once real
 * traffic shows it's worth it.
 *
 * Keyed by the link (its address and what it says), never by who asked.
 * Only LinkPeek's own report is kept, never the provider's raw results.
 * A breaking story or an empty result is kept for minutes, a settled story
 * for hours.
 */
import { createHash } from 'node:crypto';
import type { StoryReport, StoryRequest } from './contract.js';
import { daysBetween } from './text.js';

export const SHORT_TTL_MS = 10 * 60 * 1000;
export const LONG_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;

export interface ReportCache {
  get(key: string): StoryReport | undefined;
  set(key: string, report: StoryReport, ttlMs: number): void;
}

export class MemoryReportCache implements ReportCache {
  private readonly entries = new Map<string, { report: StoryReport; expires: number }>();

  constructor(private readonly now = () => Date.now()) {}

  get(key: string): StoryReport | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Most recently used goes to the end.
    this.entries.delete(key);
    this.entries.set(key, e);
    return e.report;
  }

  set(key: string, report: StoryReport, ttlMs: number): void {
    this.entries.delete(key);
    this.entries.set(key, { report, expires: this.now() + ttlMs });
    while (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
  }
}

export function cacheKey(req: StoryRequest): string {
  const parts = [req.url, req.headline?.text ?? '', req.slug ?? '', req.date ?? '', req.description?.text ?? '', req.selection ?? ''];
  return createHash('sha256').update(parts.join('\u0000').toLowerCase()).digest('base64url');
}

/** How long a report may be reused: minutes for breaking or empty results, hours otherwise. */
export function ttlFor(report: StoryReport, now: Date): number {
  if (report.status !== 'report') return SHORT_TTL_MS;
  if (report.notes.includes('developing')) return SHORT_TTL_MS;
  const newest = report.sources.map((s) => s.published).filter((d): d is string => Boolean(d)).sort().pop();
  const age = newest ? daysBetween(newest, now.toISOString().slice(0, 10)) : undefined;
  return age !== undefined && age <= 2 ? SHORT_TTL_MS : LONG_TTL_MS;
}
