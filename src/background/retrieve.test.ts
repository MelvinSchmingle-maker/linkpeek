import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retrieve } from './retrieve';

const BBC = 'https://www.bbc.co.uk/news/articles/c3qjn45pepx1o';
const fb = (dest: string) => `https://l.facebook.com/l.php?u=${encodeURIComponent(dest)}&h=AT0test`;

/** Whether LinkPeek has access to the site; the test sets it per case. */
const access = { value: true };

beforeEach(() => {
  access.value = true;
  const chromeGlobal = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome;
  chromeGlobal.permissions = { contains: vi.fn(async () => access.value) };
  // The network rule (local-rule.ts) is installed before any request, so the stand-in must accept it.
  chromeGlobal.declarativeNetRequest = {
    isRegexSupported: vi.fn(async () => ({ isSupported: true })),
    updateDynamicRules: vi.fn(async () => undefined),
    updateSessionRules: vi.fn(async () => undefined),
  };
  chromeGlobal.runtime = { ...(chromeGlobal.runtime as object | undefined), id: 'abcdefghijklmnopabcdefghijklmnop' };
});
afterEach(() => vi.unstubAllGlobals());

/** A response the fetch stub will return. `url` is where it finally came from. */
function fetchReturns(url: string, status = 200) {
  const res = new Response('<html><body><p>Some text.</p></body></html>', { status, headers: { 'content-type': 'text/html' } });
  // A real Response, with its address set the way a redirect would leave it.
  Object.defineProperty(res, 'url', { value: url });
  const cancel = vi.spyOn(res.body!, 'cancel');
  const fetchSpy = vi.fn(async (_url: string) => res);
  vi.stubGlobal('fetch', fetchSpy);
  return { fetchSpy, cancel };
}

const ask = (url: string) => retrieve({ type: 'retrieve', url, headline: 'A headline' }, undefined);

describe('social wrappers and destinations in the worker', () => {
  it('reads the destination of a Facebook wrapper, keeps the wrapper as the link, and asks for access to the destination', async () => {
    access.value = false;
    const { fetchSpy } = fetchReturns(BBC);
    const res = await ask(fb('https://news.example/story'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      kind: 'result',
      result: {
        url: fb('https://news.example/story'),
        resolvedUrl: 'https://news.example/story',
        evidence: 'unavailable',
        failure: 'permission-denied',
        needsPermissionFor: 'news.example',
      },
    });
  });

  // Parsing a fetched page happens in the offscreen document, which unit tests can't start. These two
  // tests check only which address is fetched, so a parse failure after the fetch is ignored here.
  it('fetches the destination, not the wrapper, when LinkPeek has access to it', async () => {
    const { fetchSpy } = fetchReturns('https://news.example/story', 403);
    await ask(fb('https://news.example/story')).catch(() => undefined);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://news.example/story');
  });

  it('does not follow an X t.co link: following it would reach the article site before its permission is checked', async () => {
    const { fetchSpy } = fetchReturns('https://news.example/story', 404);
    const res = await ask('https://t.co/AbC123');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { url: 'https://t.co/AbC123', failure: 'bad-link' } });
  });

  it('refuses a wrapper that cannot say where it goes, and makes no request', async () => {
    const { fetchSpy } = fetchReturns(BBC);
    const res = await ask('https://l.facebook.com/l.php');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'bad-link' } });
  });
});

describe('private and local destinations', () => {
  it('refuses a private address before any request is made', async () => {
    const { fetchSpy } = fetchReturns(BBC);
    const res = await ask('http://192.168.1.1/admin');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'unsafe-address' } });
  });

  it('refuses a private destination inside a wrapper, even with access to the wrapper', async () => {
    const { fetchSpy } = fetchReturns(BBC);
    const res = await ask(fb('http://127.0.0.1:8080/'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'unsafe-address', resolvedUrl: 'http://127.0.0.1:8080/' } });
  });

  it('refuses an address written in another form, such as an IPv4-mapped IPv6 address', async () => {
    const { fetchSpy } = fetchReturns(BBC);
    const res = await ask('http://[::ffff:169.254.169.254]/latest/meta-data/');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'unsafe-address' } });
  });

  it('refuses a public link that redirects to a private address, and never reads the body', async () => {
    const { cancel } = fetchReturns('http://10.0.0.5/internal');
    const res = await ask('https://news.example/story');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'unsafe-address' } });
    if (res.kind === 'result') expect(res.result.finalUrl).toBeUndefined();
  });
});

/** An X card: a t.co link whose label names the card's site (the names here are invented). */
const CARD = 'https://t.co/Yfm360MAr4';
const cardAsk = (site?: string) => retrieve({ type: 'retrieve', url: CARD, headline: 'A headline', ...(site ? { expectedHost: site } : {}) }, undefined);
const sessionRules = () => (globalThis as unknown as { chrome: { declarativeNetRequest: { updateSessionRules: ReturnType<typeof vi.fn> } } }).chrome.declarativeNetRequest.updateSessionRules;

describe('an X card (D66)', () => {
  it('asks for the card\'s site, and names it as the site needing permission', async () => {
    access.value = false;
    const { fetchSpy } = fetchReturns('https://news.example/story');
    const res = await cardAsk('news.example');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'permission-denied', needsPermissionFor: 'news.example' } });
  });

  it('follows the t.co link only inside a window that allows just t.co and the card\'s site', async () => {
    const { fetchSpy } = fetchReturns('https://news.example/story');
    await cardAsk('news.example').catch(() => undefined);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(CARD);
    const [first] = sessionRules().mock.calls[0]!;
    expect(first.addRules[1].condition.requestDomains).toEqual(['t.co', 'news.example']);
    // The window is closed afterwards.
    const removals = sessionRules().mock.calls.filter((c) => c[0].addRules.length === 0);
    expect(removals.length).toBe(1);
  });

  it('says the link does not lead to the card\'s site when the chain lands somewhere else', async () => {
    const { fetchSpy } = fetchReturns('http://other.test/story');
    const res = await cardAsk('news.example');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'destination-differs' } });
  });

  it('reads nothing when the card names no plain site', async () => {
    const { fetchSpy } = fetchReturns('https://news.example/story');
    const res = await cardAsk(undefined);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'bad-link' } });
  });

  it('reads nothing, and says why, when the window cannot be set up', async () => {
    sessionRules().mockRejectedValueOnce(new Error('no rules'));
    const { fetchSpy } = fetchReturns('https://news.example/story');
    const res = await cardAsk('news.example');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res).toMatchObject({ kind: 'result', result: { failure: 'network' } });
  });
});

