/**
 * Placeholder for summaries from LinkPeek's own backend (Part 06). Not built:
 * there is no backend, so this always says it's unavailable and the engine
 * moves on. Kept so the provider slot has its final shape.
 */
import type { SummaryOutcome, SummaryProvider } from './provider';

export class RemoteProvider implements SummaryProvider {
  readonly name = 'remote' as const;

  async summarise(): Promise<SummaryOutcome> {
    return { ok: false, provider: this.name, reason: 'unavailable' };
  }
}
