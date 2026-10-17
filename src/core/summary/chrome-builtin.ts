/**
 * Summaries written by Chrome's own on-device AI (the Summarizer API, Gemini
 * Nano). Free, and the article text never leaves the computer.
 *
 * Checked 17 Oct 2026 against https://developer.chrome.com/docs/ai/summarizer-api:
 * stable since Chrome 138; available in pages and documents, not in workers
 * (so this runs in the offscreen document, not the service worker); English,
 * Japanese, Spanish, German and French; needs a desktop with at least 22 GB
 * free disk and a GPU with more than 4 GB of memory, or 16 GB of RAM and 4
 * CPU cores. The model is downloaded once, which needs a click from the user,
 * so this provider only runs when the model is already "available". The
 * Settings page has the download button.
 *
 * The "headline" summary type writes 12, 17 or 22 words, which suits a
 * 20-word limit. Whatever comes back still goes through the same limit and
 * quality checks as any other summary, and the article text is treated as
 * data: the output is shown as text only, never as markup.
 */
import { enforceLimit } from './enforce';
import type { SummaryInput, SummaryOutcome, SummaryProvider } from './provider';
import { qualityProblem } from './quality';

export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export interface SummarizerOptions {
  type: 'tldr' | 'key-points' | 'teaser' | 'headline';
  format: 'plain-text' | 'markdown';
  length: 'short' | 'medium' | 'long';
  expectedInputLanguages?: string[];
  outputLanguage?: string;
  sharedContext?: string;
}

export interface SummarizerSession {
  summarize(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  destroy?(): void;
}

/** The shape of Chrome's global `Summarizer`. */
export interface SummarizerApi {
  availability(options?: Partial<SummarizerOptions>): Promise<Availability>;
  create(options?: Partial<SummarizerOptions> & { signal?: AbortSignal }): Promise<SummarizerSession>;
}

export const SUPPORTED_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr'];
/** The model has a limited input window; the opening of an article carries its point. */
const MAX_INPUT_CHARS = 6000;
const TIMEOUT_MS = 15_000;

export function chromeSummarizer(): SummarizerApi | undefined {
  return (globalThis as { Summarizer?: SummarizerApi }).Summarizer;
}

export function summarizerOptions(language: string | undefined, length: SummarizerOptions['length']): SummarizerOptions {
  const lang = baseLanguage(language) ?? 'en';
  return { type: 'headline', format: 'plain-text', length, expectedInputLanguages: [lang], outputLanguage: lang };
}

export class ChromeBuiltInProvider implements SummaryProvider {
  readonly name = 'chrome-on-device' as const;

  constructor(private readonly api: SummarizerApi | undefined = chromeSummarizer()) {}

  async summarise(input: SummaryInput): Promise<SummaryOutcome> {
    const fail = (reason: 'insufficient' | 'unavailable' | 'over-limit' | 'filtered' | 'error'): SummaryOutcome => ({
      ok: false,
      provider: this.name,
      reason,
    });
    // Only whole articles. A preview stays the page's own words.
    if (input.evidence !== 'full' || !input.paragraphs?.length) return fail('insufficient');
    if (!this.api) return fail('unavailable');
    const lang = baseLanguage(input.language);
    if (lang && !SUPPORTED_LANGUAGES.includes(lang)) return fail('unavailable');

    const options = summarizerOptions(input.language, 'medium');
    try {
      // Never start the multi-gigabyte download from here: only use a model that's already there.
      if ((await this.api.availability(options)) !== 'available') return fail('unavailable');
      const text = input.paragraphs.join('\n\n').slice(0, MAX_INPUT_CHARS);
      const first = await this.run(options, text);
      const fitted = await enforceLimit(first, {
        shorten: (long) => this.run(summarizerOptions(input.language, 'short'), long),
      });
      if (!fitted.ok) return fail('over-limit');
      if (qualityProblem(fitted.text, input.headline)) return fail('filtered');
      const flags = fitted.how === 'as-is' ? [] : fitted.how === 'shortened' ? (['shortened'] as const) : (['trimmed'] as const);
      return {
        ok: true,
        summary: { text: fitted.text, wordCount: fitted.wordCount, provider: this.name, evidence: 'full', flags: [...flags] },
      };
    } catch {
      return fail('error');
    }
  }

  private async run(options: SummarizerOptions, text: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const session = await this.api!.create({ ...options, signal: controller.signal });
    try {
      return await session.summarize(text, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
      session.destroy?.();
    }
  }
}

function baseLanguage(lang: string | undefined): string | undefined {
  const base = lang?.trim().toLowerCase().split(/[-_]/)[0];
  return base || undefined;
}
