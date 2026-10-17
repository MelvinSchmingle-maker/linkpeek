/**
 * Summaries from LinkPeek's own backend (server/), which asks Claude (Part 06).
 * Only used when the person switches it on in Settings.
 *
 * What's sent: the article's text (the first 6,000 characters, which is where
 * the point of an article is, and half the cost of the backend's 12,000
 * limit), the link's text, the page's language, and the random install ID
 * used for rate limits. Never the page's address, cookies or anything else.
 *
 * Whatever comes back is checked like any other summary. Over 20 words: the
 * backend is asked once to shorten it, then it's trimmed at a clause or
 * dropped. Filler, a question or the headline repeated: the backend is asked
 * once to write it again. If that still fails, or the backend is down, slow
 * or refuses, the engine falls back to the free summary.
 */
import { enforceLimit } from './enforce';
import type { SummaryInput, SummaryOutcome, SummaryProvider } from './provider';
import { qualityProblem, type QualityProblem } from './quality';
import type { SummaryFlag } from '../types';

export interface RemoteConfig {
  url: string;
  installId: string;
}

/** How much article text is sent. The backend accepts up to 12,000 characters. */
export const TEXT_SENT_CHARS = 6000;
const TIMEOUT_MS = 20_000;

type Problem = QualityProblem | 'too-long';

interface Body {
  installId: string;
  task: 'summarise' | 'shorten';
  evidence: 'full';
  headline: string;
  language?: string;
  text?: string;
  previous?: string;
  problem?: Problem;
}

type Reply = { ok: true; summary: string } | { ok: false; reason: 'insufficient' | 'unavailable' | 'error' };

export class RemoteProvider implements SummaryProvider {
  readonly name = 'remote' as const;

  constructor(
    private readonly config: RemoteConfig | undefined,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async summarise(input: SummaryInput): Promise<SummaryOutcome> {
    const fail = (reason: 'insufficient' | 'unavailable' | 'over-limit' | 'filtered' | 'error'): SummaryOutcome => ({
      ok: false,
      provider: this.name,
      reason,
    });
    if (!this.config?.url || !this.config.installId) return fail('unavailable');
    // Only whole articles. A preview stays the page's own words.
    if (input.evidence !== 'full' || !input.paragraphs?.length) return fail('insufficient');

    const base: Body = {
      installId: this.config.installId,
      task: 'summarise',
      evidence: 'full',
      headline: input.headline.slice(0, 300),
      ...(validLanguage(input.language) ? { language: input.language } : {}),
      text: input.paragraphs.join('\n\n').slice(0, TEXT_SENT_CHARS),
    };

    const first = await this.call(base);
    if (!first.ok) return fail(first.reason);

    const flags: SummaryFlag[] = [];
    let fitted = await enforceLimit(first.summary, {
      shorten: async (long) => {
        const r = await this.call({ ...base, task: 'shorten', text: undefined, previous: long.slice(0, 400) });
        return r.ok ? r.summary : undefined;
      },
    });
    let problem: Problem | undefined = fitted.ok ? qualityProblem(fitted.text, input.headline) : 'too-long';

    if (problem) {
      // One rewrite, told what was wrong. After that, no more requests.
      const again = await this.call({ ...base, previous: (fitted.ok ? fitted.text : first.summary).slice(0, 400), problem });
      if (!again.ok) return fail(again.reason === 'insufficient' ? 'insufficient' : 'filtered');
      fitted = await enforceLimit(again.summary);
      problem = fitted.ok ? qualityProblem(fitted.text, input.headline) : 'too-long';
      if (problem) return fail(problem === 'too-long' ? 'over-limit' : 'filtered');
    }
    if (!fitted.ok) return fail('over-limit');
    if (fitted.how === 'shortened') flags.push('shortened');
    if (fitted.how === 'trimmed') flags.push('trimmed');
    return { ok: true, summary: { text: fitted.text, wordCount: fitted.wordCount, provider: this.name, evidence: 'full', flags } };
  }

  /** One request. Never throws: every problem is a reason. */
  private async call(body: Body): Promise<Reply> {
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(this.config!.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(clean),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false, reason: res.status === 422 ? 'insufficient' : 'unavailable' };
      const data = (await res.json()) as { summary?: unknown; insufficient?: unknown };
      if (data.insufficient === true) return { ok: false, reason: 'insufficient' };
      if (typeof data.summary === 'string' && data.summary.trim()) return { ok: true, summary: data.summary.trim() };
      return { ok: false, reason: 'error' };
    } catch {
      return { ok: false, reason: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }
}

function validLanguage(lang: string | undefined): lang is string {
  return Boolean(lang && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/.test(lang));
}
