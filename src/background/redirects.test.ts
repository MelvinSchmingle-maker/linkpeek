import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRedirects } from './redirects';

const granted = { value: true };
beforeEach(() => {
  granted.value = true;
  vi.stubGlobal('chrome', {
    permissions: { contains: vi.fn(async () => granted.value) },
    declarativeNetRequest: {
      isRegexSupported: vi.fn(async () => ({ isSupported: true })),
      updateDynamicRules: vi.fn(async () => undefined),
    },
    runtime: { id: 'abcdefghijklmnopabcdefghijklmnop' },
  });
});
afterEach(() => vi.unstubAllGlobals());

function respond(url: string) {
  const cancel = vi.fn(async () => undefined);
  vi.stubGlobal('fetch', vi.fn(async () => ({ url, body: { cancel } })));
  return cancel;
}

describe('"Check where this link goes"', () => {
  it('asks the site once, with no cookies and no referrer, and reports the final address', async () => {
    respond('https://www.example.test/final/page');
    const result = await checkRedirects('https://bit.ly/abc');
    expect(result).toEqual({ kind: 'ok', finalUrl: 'https://www.example.test/final/page' });
    const [, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(init).toMatchObject({ method: 'GET', redirect: 'follow', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  });

  it('never reads the page body: it cancels the download once the address is known', async () => {
    const cancel = respond('https://www.example.test/');
    await checkRedirects('https://bit.ly/abc');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('asks nobody when LinkPeek has no access to the site, and says why', async () => {
    granted.value = false;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await checkRedirects('https://bit.ly/abc')).toEqual({ kind: 'error', reason: 'no-access' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a link that is not a web address is refused without a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await checkRedirects('mailto:someone@example.test')).toEqual({ kind: 'error', reason: 'network' });
    expect(await checkRedirects('not a link')).toEqual({ kind: 'error', reason: 'network' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a request that fails is a network error, and an aborted one is a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await checkRedirects('https://bit.ly/abc')).toEqual({ kind: 'error', reason: 'network' });
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(aborted)));
    expect(await checkRedirects('https://bit.ly/abc')).toEqual({ kind: 'error', reason: 'timeout' });
  });

  it('a final address that is not web is not reported as a destination', async () => {
    respond('ftp://files.example.test/a');
    expect(await checkRedirects('https://bit.ly/abc')).toEqual({ kind: 'error', reason: 'network' });
  });
});
