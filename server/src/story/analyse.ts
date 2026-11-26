/**
 * The Story Search report from Claude, through the official Anthropic SDK.
 *
 * - Model: STORY_MODEL, default claude-haiku-5-5, the model the owner chose
 *   for summaries (D37). Story Search asks more of the model (matching
 *   stories, spotting contradictions), so this needs measuring on real links
 *   before launch; claude-sonnet-5-5 is one setting away.
 * - Effort: STORY_EFFORT, default "medium" (Haiku 5.5's own default).
 * - The reply is constrained to STORY_SCHEMA with structured outputs, and
 *   still validated here: a reply that doesn't parse is a failure.
 * - max_tokens 6000: room for thinking plus the JSON. Hitting it is a
 *   failure, never a cut-off report.
 * - Refusals: Haiku 5.5 has no server-side fallback; on models that do,
 *   `fallbacks: "default"` is sent, as for summaries (anthropic.ts).
 * - Timeout 20 s, no retry: the whole request has to fit inside the
 *   function's time limit, and the search has already run.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from '../anthropic.js';
import { supportsFallback } from '../anthropic.js';
import type { Usage } from '../contract.js';
import type { DetailLabel, InvestigationConfidence, MatchStatus } from './contract.js';
import { STORY_SCHEMA, STORY_SYSTEM_PROMPT } from './prompt.js';

export const DEFAULT_STORY_MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 6000;
const TIMEOUT_MS = 20_000;

/** The model's reply, as the schema defines it. */
export interface AiReport {
  matches: { source: number; status: MatchStatus; reason: string }[];
  subject: string;
  what_happened: { text: string; sources: number[] }[];
  details: { label: DetailLabel; text: string; sources: number[] }[];
  facts: { text: string; sources: number[] }[];
  unclear: { text: string; sources: number[] }[];
  conflicting: boolean;
  developing: boolean;
  confidence: InvestigationConfidence;
}

export type AnalysisResult =
  | { ok: true; report: AiReport; model: string; usage: Usage }
  | { ok: false; code: 'refused' | 'truncated' | 'timeout' | 'busy' | 'upstream' | 'misconfigured' | 'invalid' };

export interface StoryModel {
  readonly name: string;
  analyse(userMessage: string): Promise<AnalysisResult>;
}

type Effort = 'low' | 'medium' | 'high';

export function buildStoryParams(userMessage: string, model: string, effort: Effort): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: STORY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
    output_config: { effort, format: { type: 'json_schema', schema: STORY_SCHEMA as unknown as Record<string, unknown> } },
    ...(supportsFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

export class AnthropicStoryModel implements StoryModel {
  private client: MessagesClient | undefined;
  readonly name: string;

  constructor(
    client?: MessagesClient,
    private readonly model = process.env.STORY_MODEL?.trim() || DEFAULT_STORY_MODEL,
    private readonly effort: Effort = (['low', 'medium', 'high'] as const).find((e) => e === process.env.STORY_EFFORT?.trim()) ?? 'medium',
  ) {
    this.client = client;
    this.name = model;
  }

  async analyse(userMessage: string): Promise<AnalysisResult> {
    if (!this.client && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return { ok: false, code: 'misconfigured' };
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      this.client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
      res = await this.client.beta.messages.create(buildStoryParams(userMessage, this.model, this.effort));
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, code: 'timeout' };
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) {
        return { ok: false, code: 'misconfigured' };
      }
      if (e instanceof Anthropic.RateLimitError) return { ok: false, code: 'busy' };
      if (e instanceof Anthropic.APIError) return { ok: false, code: 'upstream' };
      if (e instanceof Anthropic.AnthropicError) return { ok: false, code: 'misconfigured' };
      return { ok: false, code: 'upstream' };
    }
    const usage: Usage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    };
    if (res.stop_reason === 'refusal') return { ok: false, code: 'refused' };
    if (res.stop_reason === 'max_tokens') return { ok: false, code: 'truncated' };
    const text = res.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const report = parseAiReport(text);
    if (!report) return { ok: false, code: 'invalid' };
    return { ok: true, report, model: res.model, usage };
  }
}

const STATUSES = new Set(['strong', 'possible', 'none']);
const LABELS = new Set(['who', 'what', 'where', 'when', 'why']);
const CONFIDENCES = new Set(['strong', 'partial', 'conflicting', 'insufficient']);

/** Parses and checks the model's JSON. Returns undefined when it isn't the expected shape. */
export function parseAiReport(text: string): AiReport | undefined {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const claims = (x: unknown) =>
    Array.isArray(x) && x.every((c) => c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string' && Array.isArray((c as { sources?: unknown }).sources) && (c as { sources: unknown[] }).sources.every(Number.isInteger));
  if (!Array.isArray(o.matches) || !o.matches.every((m) => m && Number.isInteger(m.source) && STATUSES.has(m.status) && typeof m.reason === 'string')) return undefined;
  if (typeof o.subject !== 'string' || !claims(o.what_happened) || !claims(o.facts) || !claims(o.unclear)) return undefined;
  if (!claims(o.details) || !(o.details as { label?: unknown }[]).every((d) => LABELS.has(d.label as string))) return undefined;
  if (typeof o.conflicting !== 'boolean' || typeof o.developing !== 'boolean' || !CONFIDENCES.has(o.confidence as string)) return undefined;
  return o as unknown as AiReport;
}

/** Anthropic list prices per million tokens (cached 3 Nov 2026), for the cost log line. Unknown models: Sonnet's. */
const PRICES: Record<string, { input: number; output: number }> = {
  haiku: { input: 0.1, output: 0.5 },
  sonnet: { input: 2, output: 10 },
  opus: { input: 4, output: 20 },
};

export function aiCostUsd(model: string, usage: Usage): number {
  const p = /haiku/i.test(model) ? PRICES.haiku! : /opus/i.test(model) ? PRICES.opus! : PRICES.sonnet!;
  const input = usage.inputTokens + usage.cacheWriteTokens * 1.25 + usage.cacheReadTokens * 0.1;
  return (input * p.input + usage.outputTokens * p.output) / 1_000_000;
}
