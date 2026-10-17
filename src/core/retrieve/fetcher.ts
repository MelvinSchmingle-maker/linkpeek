/**
 * Fetches one destination, carefully. Used by the service worker (for sites
 * LinkPeek has access to) and by the content script (for links to the same
 * site as the page, which need no extra permission).
 *
 * - Never sends cookies or logins (credentials: 'omit').
 * - Gives up after a timeout and stops reading past a size limit.
 * - Retries once, only on a network error or timeout. A site that refused us
 *   (403, 429, a challenge page) is never asked again.
 */

/** Test builds use a short timeout so the slow-site test is quick; the live check uses the real one. */
export const TIMEOUT_MS = __E2E__ && !__LIVE__ ? 3000 : 8000;
export const MAX_HTML_BYTES = 3 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type FetchError = 'timeout' | 'network' | 'too-large' | 'unsafe-address';

/** What came back, in a form that can be passed between parts of the extension. */
export interface RawFetch {
  requestedUrl: string;
  finalUrl: string;
  redirected: boolean;
  status: number;
  /** Lower-case media type without parameters, e.g. "text/html". */
  contentType: string;
  /** Decoded text for HTML and other text responses. */
  text?: string;
  /** Base64 bytes for PDFs (extension messages can't carry binary data). */
  base64?: string;
  /**
   * Who fetched it: the page (same-site links), the extension, or nobody
   * (the link points at the page the user is already on, which was read
   * as it is).
   */
  via: 'page' | 'extension' | 'current-page';
}

export type FetchOutcome = { ok: true; raw: RawFetch } | { ok: false; error: FetchError };

export interface FetchOptions {
  via: 'page' | 'extension';
  timeoutMs?: number;
  /**
   * Checked on the address the response finally came from, before its body is
   * read. A refused address is never read. Redirects can't be checked one by
   * one from an extension, so this only sees where the chain ended.
   */
  refuse?: (url: string) => boolean;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export async function fetchLimited(url: string, opts: FetchOptions): Promise<FetchOutcome> {
  const first = await fetchOnce(url, opts);
  if (first.ok || (first.error !== 'network' && first.error !== 'timeout')) return first;
  return fetchOnce(url, opts);
}

async function fetchOnce(url: string, opts: FetchOptions): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5' },
    });
    if (opts.refuse?.(res.url || url)) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, error: 'unsafe-address' };
    }
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const isPdf = contentType === 'application/pdf' || (!contentType && /\.pdf($|\?)/i.test(res.url));
    const limit = isPdf ? MAX_PDF_BYTES : MAX_HTML_BYTES;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > limit) {
      controller.abort();
      return { ok: false, error: 'too-large' };
    }
    const bytes = await readLimited(res, limit);
    if (bytes === 'too-large') {
      controller.abort();
      return { ok: false, error: 'too-large' };
    }
    const raw: RawFetch = {
      requestedUrl: url,
      finalUrl: res.url || url,
      redirected: res.redirected,
      status: res.status,
      contentType: isPdf ? 'application/pdf' : contentType,
      via: opts.via,
    };
    if (isPdf) raw.base64 = toBase64(bytes);
    else if (isTextual(contentType)) raw.text = decode(bytes, res.headers.get('content-type') ?? '');
    return { ok: true, raw };
  } catch {
    if (controller.signal.aborted) return { ok: false, error: 'timeout' };
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function isTextual(contentType: string): boolean {
  return contentType === '' || contentType.startsWith('text/') || /\b(xhtml|xml|json)\b/.test(contentType);
}

async function readLimited(res: Response, limit: number): Promise<Uint8Array | 'too-large'> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return 'too-large';
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Decode using the charset from the header, or a <meta charset> near the top, else UTF-8. */
function decode(bytes: Uint8Array, contentTypeHeader: string): string {
  let charset = /charset=["']?([\w-]+)/i.exec(contentTypeHeader)?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
