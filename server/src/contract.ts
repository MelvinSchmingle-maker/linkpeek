/**
 * What the extension may send, and what it gets back. Validated strictly:
 * anything unexpected is a 400, never passed on to the AI.
 *
 * The extension never sends the page's address, cookies or anything about
 * the person. It sends the article's text, the link's text, the page
 * language, and a random install ID used only for rate limits.
 */

export const MAX_TEXT_CHARS = 12_000;
export const MAX_HEADLINE_CHARS = 300;
export const MAX_PREVIOUS_CHARS = 400;
export const MAX_BODY_BYTES = 64 * 1024;

export type Task = 'summarise' | 'shorten';
export type Evidence = 'full' | 'partial';
export type Problem = 'filler-opener' | 'repeats-headline' | 'question' | 'too-short' | 'too-long';

export interface SummariseRequest {
  installId: string;
  task: Task;
  evidence: Evidence;
  headline: string;
  language?: string;
  /** The article text (task "summarise"). */
  text?: string;
  /** A summary that needs fixing: shortening (task "shorten") or rewriting (with `problem`). */
  previous?: string;
  problem?: Problem;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type SummariseResponse =
  | { summary: string; model: string; usage: Usage }
  | { insufficient: true; model: string; usage: Usage }
  | { error: ErrorCode };

export type ErrorCode =
  | 'bad-request'
  | 'too-large'
  | 'method-not-allowed'
  | 'rate-limited'
  | 'busy'
  | 'disabled'
  | 'refused'
  | 'truncated'
  | 'timeout'
  | 'upstream'
  | 'misconfigured';

const PROBLEMS: Problem[] = ['filler-opener', 'repeats-headline', 'question', 'too-short', 'too-long'];

export function parseRequest(body: unknown): SummariseRequest | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const b = body as Record<string, unknown>;
  const allowed = new Set(['installId', 'task', 'evidence', 'headline', 'language', 'text', 'previous', 'problem']);
  if (Object.keys(b).some((k) => !allowed.has(k))) return undefined;

  const { installId, task, evidence, headline, language, text, previous, problem } = b;
  if (typeof installId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(installId)) return undefined;
  if (task !== 'summarise' && task !== 'shorten') return undefined;
  if (evidence !== 'full' && evidence !== 'partial') return undefined;
  if (typeof headline !== 'string' || headline.length > MAX_HEADLINE_CHARS) return undefined;
  if (language !== undefined && (typeof language !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/.test(language))) return undefined;
  if (previous !== undefined && (typeof previous !== 'string' || !previous.trim() || previous.length > MAX_PREVIOUS_CHARS)) return undefined;
  if (problem !== undefined && !PROBLEMS.includes(problem as Problem)) return undefined;

  if (task === 'summarise') {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_CHARS) return undefined;
    // A rewrite names what was wrong with the previous attempt, and only then.
    if ((previous === undefined) !== (problem === undefined)) return undefined;
  } else {
    if (text !== undefined || typeof previous !== 'string') return undefined;
  }

  return {
    installId,
    task,
    evidence,
    headline,
    ...(language ? { language } : {}),
    ...(typeof text === 'string' ? { text } : {}),
    ...(typeof previous === 'string' ? { previous } : {}),
    ...(problem ? { problem: problem as Problem } : {}),
  };
}
