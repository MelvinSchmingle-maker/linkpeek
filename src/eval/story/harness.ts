/**
 * Plumbing for the Story Search end-to-end suite (src/eval/story-e2e.test.ts).
 *
 * - Recording: real requests to Exa and Tavily, saved with what came back,
 *   so later runs replay them instead of searching again. Headers are never
 *   saved (that's where the keys travel), and article extracts are cut to
 *   short passages, because this repository is public. The pipeline sees the
 *   same cut text while recording, so a replay behaves exactly like the
 *   recording run.
 * - Replay: serves a recording in order and checks each request matches what
 *   was recorded. A mismatch means the code now searches differently: the
 *   recording is out of date and has to be made again, on purpose.
 * - Claude: a stand-in client that returns a saved or written reply through
 *   LinkPeek's real AnthropicStoryModel (so its parsing and checks run), and
 *   a budget guard for live calls.
 */
import { createHash } from 'node:crypto';
import type { MessagesClient } from '../../../server/src/anthropic';
import type { AnalysisResult, StoryModel } from '../../../server/src/story/analyse';
import { aiCostUsd, MAX_TOKENS } from '../../../server/src/story/analyse';
import type { SearchHit, SearchOptions, SearchOutcome, SearchProvider } from '../../../server/src/story/providers/types';
import type { SearchQuery } from '../../../server/src/story/queries';

// ---------- Recordings ----------

/** Longest extract kept per passage, and passages kept per result. Short: this repository is public. */
export const KEEP_PASSAGE_CHARS = 320;
export const KEEP_PASSAGES = 2;

export interface Exchange {
  provider: 'exa' | 'tavily';
  request: { method: string; path: string; body: unknown };
  status: number;
  response: unknown;
}

export interface Recording {
  case: string;
  /** When it was recorded, and the date the investigation treated as today (replays use the same date). */
  recordedAt: string;
  today: string;
  note: string;
  exchanges: Exchange[];
}

function cut(text: string, max = KEEP_PASSAGE_CHARS): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const space = head.lastIndexOf(' ');
  return `${(space > max * 0.6 ? head.slice(0, space) : head).trim()}…`;
}

/** Keeps only what LinkPeek's adapters read, with extracts cut short. */
export function trimResponse(provider: 'exa' | 'tavily', data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.results)) return data;
  const results = (d.results as Record<string, unknown>[]).map((r) => {
    if (provider === 'exa') {
      const highlights = Array.isArray(r.highlights) ? (r.highlights as unknown[]).filter((h): h is string => typeof h === 'string').slice(0, KEEP_PASSAGES).map((h) => cut(h)) : [];
      return { title: r.title, url: r.url, publishedDate: r.publishedDate, author: r.author, highlights };
    }
    const content = typeof r.content === 'string' ? r.content.split(/\s*\[\.\.\.\]\s*/).filter(Boolean).slice(0, KEEP_PASSAGES).map((c) => cut(c)).join(' [...] ') : '';
    return { title: r.title, url: r.url, published_date: r.published_date ?? null, content };
  });
  return provider === 'exa' ? { results, costDollars: d.costDollars } : { results, usage: d.usage };
}

function providerOf(url: string): 'exa' | 'tavily' {
  return new URL(url).hostname.includes('tavily') ? 'tavily' : 'exa';
}

function bodyOf(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') return null;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/** Real fetch, recording each exchange (without headers) and handing the pipeline the trimmed reply it will later replay. */
export function recordingFetch(real: typeof fetch, sink: Exchange[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const provider = providerOf(url);
    const res = await real(input, init);
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Not JSON: recorded as null, which the adapters treat as a failure.
    }
    const trimmed = res.ok ? trimResponse(provider, data) : data;
    sink.push({ provider, request: { method: init?.method ?? 'GET', path: new URL(url).pathname, body: bodyOf(init) }, status: res.status, response: trimmed });
    return json(res.status, trimmed);
  }) as typeof fetch;
}

export interface Replay {
  fetch: typeof fetch;
  /** Requests that didn't match the recording (each one fails the test with this message). */
  errors: string[];
  /** HTTP requests served, by provider. */
  served: Record<'exa' | 'tavily', number>;
  remaining: () => number;
}

/**
 * A request as recordings are matched against it: without the options that ask for page text (Exa's
 * `contents.text`, Tavily's `include_raw_content`, D75). Recordings never keep page text (trimResponse cuts
 * every result to short excerpts: this repository is public), so a recording answers the same search
 * whether or not page text was asked for, served as what it is: excerpts. Everything else (the query, its
 * dates, the number of results, the filters) must match exactly.
 */
export function comparableRequest(provider: 'exa' | 'tavily', body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const b = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  if (provider === 'exa' && b.contents && typeof b.contents === 'object') delete (b.contents as Record<string, unknown>).text;
  if (provider === 'tavily') delete b.include_raw_content;
  return b;
}

/** Serves recorded exchanges in order, checking each request is the one recorded. */
export function replayFetch(exchanges: Exchange[], caseId: string): Replay {
  const queue = [...exchanges];
  const replay: Replay = {
    errors: [],
    served: { exa: 0, tavily: 0 },
    remaining: () => queue.length,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const provider = providerOf(url);
      const next = queue.shift();
      const body = bodyOf(init);
      if (!next || next.provider !== provider || JSON.stringify(comparableRequest(provider, next.request.body)) !== JSON.stringify(comparableRequest(provider, body))) {
        replay.errors.push(
          `${caseId}: request ${replay.served.exa + replay.served.tavily + 1} to ${provider} doesn't match the recording. ` +
            `Story Search now searches differently, so the recording is out of date: re-record with \`npm run test:story-e2e:record\`.\n` +
            `  sent:     ${JSON.stringify(body)}\n  recorded: ${next ? `${next.provider} ${JSON.stringify(next.request.body)}` : '(none left)'}`,
        );
        return json(500, { error: 'not recorded' });
      }
      replay.served[provider]++;
      return json(next.status, next.response);
    }) as typeof fetch,
  };
  return replay;
}

/** A fetch that answers every request with one fixed reply: for simulated provider failures. */
export function fixedFetch(status: number, data: unknown, calls?: { count: number }): typeof fetch {
  return (async () => {
    if (calls) calls.count++;
    return json(status, data);
  }) as typeof fetch;
}

/** A fetch that answers with a body that isn't JSON at all. */
export function garbageFetch(status: number, text: string, calls?: { count: number }): typeof fetch {
  return (async () => {
    if (calls) calls.count++;
    return new Response(text, { status, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
}

/** Answers each request with the next reply in the list (the last one repeats): for synthetic search results. */
export function sequenceFetch(replies: { status: number; data: unknown }[], calls?: { count: number; bodies: unknown[] }): typeof fetch {
  let i = 0;
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (calls) {
      calls.count++;
      calls.bodies.push(bodyOf(init));
    }
    const r = replies[Math.min(i++, replies.length - 1)]!;
    return json(r.status, r.data);
  }) as typeof fetch;
}

/** A fetch that never answers until the adapter gives up (a timeout). */
export function hangingFetch(calls?: { count: number }): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) => {
    if (calls) calls.count++;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }) as typeof fetch;
}

/** A fetch that fails the test if anything calls it: for runs that must not search. */
export function forbiddenFetch(calls: { count: number }): typeof fetch {
  return (async () => {
    calls.count++;
    return json(500, { error: 'this run must not make requests' });
  }) as typeof fetch;
}

// ---------- Watching the search ----------

export interface SearchCall {
  query: SearchQuery;
  options: SearchOptions;
  outcome: 'ok' | string;
  provider?: string;
  hits: number;
  /** What the adapter says the search cost: Exa's own reported figure, or Tavily's credits at the pay-as-you-go price. */
  costUsd?: number;
}

/** Wraps a provider (or chain) and keeps every result it returned, so sources can be checked against what was really retrieved. */
export class WatchingProvider implements SearchProvider {
  readonly name: string;
  readonly exactPhrases?: boolean;
  readonly calls: SearchCall[] = [];
  readonly hits: SearchHit[] = [];

  constructor(private readonly inner: SearchProvider) {
    this.name = inner.name;
    if (inner.exactPhrases !== undefined) this.exactPhrases = inner.exactPhrases;
  }

  async search(query: SearchQuery, options: SearchOptions): Promise<SearchOutcome> {
    const out = await this.inner.search(query, options);
    this.calls.push({ query, options, outcome: out.ok ? 'ok' : out.code, ...(out.ok ? { provider: out.provider, costUsd: out.costUsd } : {}), hits: out.ok ? out.hits.length : 0 });
    if (out.ok) this.hits.push(...out.hits);
    return out;
  }
}

// ---------- Claude ----------

/** What Claude sent back, as saved for replay: the text, the stop reason, the model and the usage. Never the request or its headers. */
export interface SavedReply {
  model: string;
  stopReason: string;
  text: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  /** Hash of the prompt it answered (system prompt and user message), so a reply is never reused for a different prompt. */
  promptHash: string;
  recordedAt: string;
}

type CreateParams = Parameters<MessagesClient['beta']['messages']['create']>[0];
export type Reply = Omit<SavedReply, 'promptHash' | 'recordedAt'>;

/** The user message of a request, as LinkPeek builds it. */
export function userMessageOf(params: unknown): string {
  const m = (params as { messages?: { content?: unknown }[] }).messages?.[0]?.content;
  return typeof m === 'string' ? m : '';
}

/** sha256 of the system prompt and user message: what decides Claude's answer. */
export function promptHash(params: unknown): string {
  const p = params as { system?: { text?: string }[]; model?: string };
  const system = (p.system ?? []).map((b) => b.text ?? '').join('\n');
  return createHash('sha256').update(`${p.model ?? ''}\n${system}\n${userMessageOf(params)}`).digest('hex').slice(0, 32);
}

/**
 * A client that answers with a saved or written reply. LinkPeek's real
 * AnthropicStoryModel sits on top, so its checks of the reply (stop reason,
 * JSON shape) run exactly as they do with Claude.
 */
export function replyClient(reply: (params: CreateParams) => Reply, seen?: { params: unknown[] }): MessagesClient {
  return {
    beta: {
      messages: {
        create: (async (params: CreateParams) => {
          seen?.params.push(params);
          const r = reply(params);
          return {
            id: 'msg_replay',
            type: 'message',
            role: 'assistant',
            model: r.model,
            stop_reason: r.stopReason,
            content: [{ type: 'text', text: r.text }],
            usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens, cache_read_input_tokens: r.usage.cache_read_input_tokens ?? 0, cache_creation_input_tokens: r.usage.cache_creation_input_tokens ?? 0 },
          };
        }) as unknown as MessagesClient['beta']['messages']['create'],
      },
    },
  };
}

/** A client that throws: for simulated Claude failures (the SDK's own error classes, so the real mapping runs). */
export function throwingClient(error: unknown): MessagesClient {
  return { beta: { messages: { create: (async () => Promise.reject(error)) as unknown as MessagesClient['beta']['messages']['create'] } } };
}

/** Wraps a real client: keeps each reply, with the hash of the prompt it answered, for saving. Never the key or the headers. */
export function savingClient(inner: MessagesClient, sink: SavedReply[]): MessagesClient {
  return {
    beta: {
      messages: {
        create: (async (params: CreateParams) => {
          const res = await inner.beta.messages.create(params);
          const msg = res as unknown as { model: string; stop_reason: string; content: { type: string; text?: string }[]; usage: SavedReply['usage'] };
          sink.push({
            model: msg.model,
            stopReason: msg.stop_reason,
            text: msg.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
            usage: {
              input_tokens: msg.usage.input_tokens,
              output_tokens: msg.usage.output_tokens,
              cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
              cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
            },
            promptHash: promptHash(params),
            recordedAt: new Date().toISOString(),
          });
          return res;
        }) as MessagesClient['beta']['messages']['create'],
      },
    },
  };
}

/** The Story Search call's max_tokens: the most output one call can bill. Taken from analyse.ts, never copied. */
export const MAX_OUTPUT_TOKENS = MAX_TOKENS;

/**
 * The most one call can cost before it's made, at the model's list price: the
 * prompt counted generously (one token per 2.5 characters, all of it billed
 * as a cache write, the dearest kind of input) plus the whole output allowance.
 */
export function worstCaseUsd(model: string, promptChars: number): number {
  return aiCostUsd(model, { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: Math.ceil(promptChars / 2.5), outputTokens: MAX_OUTPUT_TOKENS });
}

/** One spending limit shared by every call in a run. */
export class Budget {
  spentUsd = 0;
  calls = 0;
  refused = 0;
  constructor(readonly limitUsd: number) {}
}

/**
 * Stops live calls before they could take spending past the budget: a call
 * goes ahead only if what's been spent plus that call's worst case still fits.
 * What a call cost is worked out from the tokens Claude reports; a call that
 * failed counts at its worst case, since it may still have been billed.
 */
export class BudgetedModel implements StoryModel {
  readonly name: string;

  constructor(
    private readonly inner: StoryModel,
    private readonly budget: Budget,
    private readonly systemChars: number,
  ) {
    this.name = inner.name;
  }

  async analyse(userMessage: string): Promise<AnalysisResult> {
    const worst = worstCaseUsd(this.name, this.systemChars + userMessage.length);
    if (this.budget.spentUsd + worst > this.budget.limitUsd) {
      this.budget.refused++;
      return { ok: false, code: 'misconfigured' };
    }
    this.budget.calls++;
    const out = await this.inner.analyse(userMessage);
    this.budget.spentUsd += out.ok ? aiCostUsd(out.model, out.usage) : worst;
    return out;
  }
}

/** A model that is never called (search-only runs). */
export const noAi: StoryModel = { name: 'none', analyse: async () => ({ ok: false, code: 'misconfigured' }) };
