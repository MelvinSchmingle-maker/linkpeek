/**
 * What an opt-in usage count could record (Part 14a). Built now as a schema
 * and a guard, so the rule "counts only, never a URL or article text" is
 * enforced in code before anything exists to send it. Nothing sends these
 * events yet: that needs a backend, real users and the owner's go-ahead
 * (docs/measurement.md).
 */
import type { EvidenceLevel, FailureReason } from '../types';

export type MeasureEvent =
  | { name: 'summary-shown'; evidence: EvidenceLevel; provider?: string }
  | { name: 'feedback'; value: 'up' | 'down' | 'disagree' }
  | { name: 'card-link-opened'; hostname: string }
  | { name: 'failure'; reason: FailureReason };

/** The only keys an event may carry, and what each may hold. */
const ALLOWED: Record<string, RegExp | readonly string[]> = {
  name: ['summary-shown', 'feedback', 'card-link-opened', 'failure'],
  evidence: ['full', 'partial', 'headline-only', 'unavailable'],
  provider: /^[a-z-]{1,30}$/,
  value: ['up', 'down', 'disagree'],
  // A hostname only: letters, digits, dots and dashes, and no path, port or user name.
  hostname: /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/,
  reason: /^[a-z-]{1,40}$/,
};

/**
 * Returns the event with only allowed keys and values, or undefined if
 * anything doesn't fit. Never lets a URL, a path or article text through.
 */
export function cleanEvent(input: Record<string, unknown>): MeasureEvent | undefined {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const rule = ALLOWED[key];
    if (!rule || typeof value !== 'string') return undefined;
    const ok = Array.isArray(rule) ? rule.includes(value) : (rule as RegExp).test(value);
    if (!ok) return undefined;
    out[key] = value;
  }
  if (!out.name) return undefined;
  return out as MeasureEvent;
}
