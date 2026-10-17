/**
 * Rate limits. Every summary costs money, and the endpoint is public (any
 * extension install, or anyone with curl, can call it), so each request is
 * counted twice:
 *
 * - per install: a random install ID the extension makes up and rotates
 *   monthly. Stops one install from running up the bill. It's easy to fake,
 *   which is why there's a second count.
 * - per IP address: so one machine making up fresh install IDs still hits
 *   the same limit. Vercel sees the address anyway; we don't log or keep it.
 *
 * On Vercel both counts use one Vercel Firewall rate-limit rule, checked
 * from code with @vercel/firewall, so no database is needed. One rule
 * because Vercel's Hobby plan allows one per project: both counts get the
 * same numbers, in separate buckets. The rule must exist in the project
 * (server/README.md says how). If it's missing the request is refused
 * rather than let through: an unguarded endpoint spends money.
 *
 * Nothing here caps everyone together. Many machines can still add up, so
 * the real ceiling on spend is the monthly limit set in the Anthropic
 * Console. Set one before going live.
 */
import { checkRateLimit } from '@vercel/firewall';

export type LimitResult = 'ok' | 'limited' | 'misconfigured';

export interface RateLimiter {
  check(installId: string, request: Request): Promise<LimitResult>;
}

export const RULE = 'summarise';

export class VercelFirewallLimiter implements RateLimiter {
  async check(installId: string, request: Request): Promise<LimitResult> {
    // Vercel sets x-real-ip on every request. Without it there's no second count, so refuse.
    const ip = request.headers.get('x-real-ip');
    if (!ip) return 'misconfigured';
    for (const key of [`install:${installId}`, `ip:${ip}`]) {
      const { rateLimited, error } = await checkRateLimit(RULE, { request, rateLimitKey: key, timeout: 2000 });
      if (error === 'not-found') return 'misconfigured';
      if (rateLimited || error === 'blocked') return 'limited';
    }
    return 'ok';
  }
}

/**
 * For local runs and tests: fixed windows kept in this process's memory.
 * Not for production: serverless functions run as many short-lived copies,
 * each with its own memory.
 */
export class MemoryLimiter implements RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly perInstall: number,
    private readonly overall: number,
    private readonly windowMs = 60_000,
    private readonly now = () => Date.now(),
  ) {}

  async check(installId: string): Promise<LimitResult> {
    if (!this.take(`install:${installId}`, this.perInstall)) return 'limited';
    if (!this.take('all', this.overall)) return 'limited';
    return 'ok';
  }

  private take(key: string, max: number): boolean {
    const t = this.now();
    const w = this.hits.get(key);
    if (!w || t - w.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      return true;
    }
    if (w.count >= max) return false;
    w.count++;
    return true;
  }
}

/** Used when no real limiter is available: every request is refused, never let through unguarded. */
export class RefuseAll implements RateLimiter {
  async check(): Promise<LimitResult> {
    return 'misconfigured';
  }
}

/**
 * Picks the limiter. Outside Vercel, @vercel/firewall lets every request
 * through (it only logs a warning; checked 17 Oct 2026), so it's only used
 * when running on Vercel, which sets VERCEL=1. RATE_LIMITER=memory is for
 * local runs. Anything else refuses.
 */
export function limiterFor(env: Record<string, string | undefined>): RateLimiter {
  if (env.RATE_LIMITER === 'memory') return new MemoryLimiter(20, 200);
  if (env.VERCEL === '1') return new VercelFirewallLimiter();
  return new RefuseAll();
}

