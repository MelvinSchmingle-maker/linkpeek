/**
 * Summaries from Claude, through the official Anthropic SDK.
 *
 * - Model: SUMMARY_MODEL, default claude-opus-5-5. Changing it is a cost
 *   decision (docs/cost/part-06-estimate.md), so it's one setting.
 * - Effort "low": a 20-word sentence doesn't need long reasoning, and effort
 *   is what bounds the thinking tokens billed as output.
 * - max_tokens 1024: room for brief thinking plus one sentence. Hitting it
 *   counts as a failure, never a cut-off summary.
 * - The fixed system prompt carries a cache marker (see prompt.ts).
 * - Refusals: on models that support it, `fallbacks: "default"` lets the API
 *   retry a declined request on Anthropic's recommended fallback model.
 *   Claude Haiku 5.5 has no server-side fallback, so it isn't sent there.
 *   A refusal that survives is reported as "refused", and the extension uses
 *   its own summary instead.
 * - Timeout 15 s with one retry, inside the function's 30 s limit.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SummariseRequest, Usage } from './contract.js';
import { cleanReply, INSUFFICIENT, SYSTEM_PROMPT, userMessage } from './prompt.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 15_000;

export type ProviderResult =
  | { ok: true; summary: string; model: string; usage: Usage }
  | { ok: true; insufficient: true; model: string; usage: Usage }
  | { ok: false; code: 'refused' | 'truncated' | 'timeout' | 'busy' | 'upstream' | 'misconfigured' };

export interface SummaryModel {
  summarise(req: SummariseRequest): Promise<ProviderResult>;
}

/** The part of the SDK client this uses, so tests can stand in for it. */
export interface MessagesClient {
  beta: { messages: { create: Anthropic['beta']['messages']['create'] } };
}

/** Models with server-side refusal fallback. Haiku 5.5 has none. */
export function supportsFallback(model: string): boolean {
  return !/haiku/i.test(model);
}

export function buildParams(req: SummariseRequest, model: string): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage(req) }],
    output_config: { effort: 'low' },
    ...(supportsFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

export class AnthropicSummaryModel implements SummaryModel {
  private client: MessagesClient | undefined;

  /** The client is made on first use, so a missing key is a "misconfigured" answer, not a function that won't start. */
  constructor(
    client?: MessagesClient,
    private readonly model = process.env.SUMMARY_MODEL?.trim() || DEFAULT_MODEL,
  ) {
    this.client = client;
  }

  async summarise(req: SummariseRequest): Promise<ProviderResult> {
    // No key in the environment: say so plainly. (The SDK would throw a plain Error before any request.)
    if (!this.client && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return { ok: false, code: 'misconfigured' };
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      this.client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
      res = await this.client.beta.messages.create(buildParams(req, this.model));
    } catch (e) {
      // Most specific first. Never pass the SDK's message on: it isn't for the extension.
      if (e instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, code: 'timeout' };
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) {
        return { ok: false, code: 'misconfigured' };
      }
      if (e instanceof Anthropic.RateLimitError) return { ok: false, code: 'busy' };
      if (e instanceof Anthropic.APIError) return { ok: false, code: 'upstream' };
      // Thrown before any request, e.g. no API key in the environment.
      if (e instanceof Anthropic.AnthropicError) return { ok: false, code: 'misconfigured' };
      return { ok: false, code: 'upstream' };
    }

    const usage: Usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    };
    // Check why it stopped before reading anything.
    if (res.stop_reason === 'refusal') return { ok: false, code: 'refused' };
    if (res.stop_reason === 'max_tokens') return { ok: false, code: 'truncated' };

    const text = res.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const reply = cleanReply(text);
    if (!reply) return { ok: false, code: 'upstream' };
    if (reply === INSUFFICIENT) return { ok: true, insufficient: true, model: res.model, usage };
    return { ok: true, summary: reply, model: res.model, usage };
  }
}
