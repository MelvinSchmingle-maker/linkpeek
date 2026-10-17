/**
 * Picks the summary engine and guarantees the result: a summary of 20 words
 * or fewer that passed the quality checks, or no summary at all.
 *
 * The extractive provider is always last in line, so a missing, slow or
 * failing AI never leaves a full article without a summary when a good
 * sentence exists.
 */
import type { Summary } from '../types';
import { ChromeBuiltInProvider } from './chrome-builtin';
import { MAX_SUMMARY_WORDS } from './enforce';
import { ExtractiveProvider } from './extractive';
import type { SummaryEngine, SummaryInput, SummaryProvider } from './provider';
import { qualityProblem } from './quality';
import { RemoteProvider, type RemoteConfig } from './remote';
import { countWords } from './wordcount';

export function providersFor(engine: SummaryEngine, remote?: RemoteConfig): SummaryProvider[] {
  const extractive = new ExtractiveProvider();
  if (engine === 'chrome-on-device') return [new ChromeBuiltInProvider(), extractive];
  if (engine === 'remote') return [new RemoteProvider(remote), extractive];
  return [extractive];
}

export async function summarise(input: SummaryInput, providers: SummaryProvider[]): Promise<Summary | undefined> {
  if (input.evidence !== 'full' && input.evidence !== 'partial') return undefined;
  for (const provider of providers) {
    let outcome;
    try {
      outcome = await provider.summarise(input);
    } catch {
      continue;
    }
    if (!outcome.ok) continue;
    const s = outcome.summary;
    // Belt and braces: whatever a provider says, nothing over the limit or failing the checks gets out.
    if (countWords(s.text) > MAX_SUMMARY_WORDS || qualityProblem(s.text, input.headline)) continue;
    return { ...s, wordCount: countWords(s.text) };
  }
  return undefined;
}
