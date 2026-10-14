// @vitest-environment node
/**
 * The fetcher against a real local HTTP server: timeouts, size limits, the
 * single retry, character sets and PDFs. Runs in plain Node (the fake DOM
 * has its own fetch, which behaves like a web page's).
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchLimited, fromBase64, MAX_HTML_BYTES } from './fetcher';

let server: Server;
let base = '';
const hits = new Map<string, number>();
const nodeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    hits.set(path, (hits.get(path) ?? 0) + 1);
    if (path === '/ok') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<p>Hello £ café</p>');
    if (path === '/latin1') {
      return res.writeHead(200, { 'content-type': 'text/html' }).end(Buffer.from('<meta charset="iso-8859-1"><p>caf\xe9</p>', 'latin1'));
    }
    if (path === '/403') return res.writeHead(403, { 'content-type': 'text/html' }).end('nope');
    if (path === '/slow') return void setTimeout(() => res.writeHead(200).end('late'), 1500);
    if (path === '/declared-huge') return res.writeHead(200, { 'content-type': 'text/html', 'content-length': String(MAX_HTML_BYTES + 1) }).end();
    if (path === '/streamed-huge') {
      res.writeHead(200, { 'content-type': 'text/html' });
      const chunk = 'x'.repeat(64 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent <= MAX_HTML_BYTES + chunk.length) {
          if (res.destroyed) return;
          sent += chunk.length;
          if (!res.write(chunk)) return void res.once('drain', pump);
        }
        res.end();
      };
      res.on('error', () => undefined);
      return pump();
    }
    if (path === '/flaky') {
      // Drop the connection the first time, answer the second.
      if (hits.get(path) === 1) return req.socket.destroy();
      return res.writeHead(200, { 'content-type': 'text/html' }).end('second time lucky');
    }
    if (path === '/pdf') return res.writeHead(200, { 'content-type': 'application/pdf' }).end(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]));
    if (path === '/redirect') return res.writeHead(302, { location: '/ok' }).end();
    if (path === '/cookies') return res.writeHead(200, { 'content-type': 'text/plain' }).end(req.headers.cookie ?? 'no cookies');
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const get = (path: string, timeoutMs = 1000) => fetchLimited(`${base}${path}`, { via: 'extension', timeoutMs, fetchImpl: nodeFetch });

describe('fetchLimited', () => {
  it('reads an HTML page and its charset', async () => {
    const r = await get('/ok');
    expect(r).toMatchObject({ ok: true, raw: { status: 200, contentType: 'text/html', text: '<p>Hello £ café</p>', redirected: false } });
  });

  it('honours a <meta charset> when the header has none', async () => {
    const r = await get('/latin1');
    expect(r.ok && r.raw.text).toContain('café');
  });

  it('returns error statuses as they are (the reader decides), and does not retry them', async () => {
    const r = await get('/403');
    expect(r).toMatchObject({ ok: true, raw: { status: 403 } });
    expect(hits.get('/403')).toBe(1);
  });

  it('gives up on a slow site and says "timeout", after one retry', async () => {
    const r = await get('/slow', 300);
    expect(r).toEqual({ ok: false, error: 'timeout' });
    expect(hits.get('/slow')).toBe(2);
  });

  it('refuses a page that says it is too big, without reading it', async () => {
    expect(await get('/declared-huge')).toEqual({ ok: false, error: 'too-large' });
  });

  it('stops reading a page that turns out to be too big', async () => {
    expect(await get('/streamed-huge', 5000)).toEqual({ ok: false, error: 'too-large' });
  });

  it('retries once after a dropped connection', async () => {
    const r = await get('/flaky');
    expect(r.ok && r.raw.text).toBe('second time lucky');
    expect(hits.get('/flaky')).toBe(2);
  });

  it('keeps PDFs as bytes (base64), not text', async () => {
    const r = await get('/pdf');
    expect(r.ok && r.raw.contentType).toBe('application/pdf');
    expect(r.ok && r.raw.text).toBeUndefined();
    expect(r.ok && [...fromBase64(r.raw.base64!)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it('follows ordinary redirects and records where it ended up', async () => {
    const r = await get('/redirect');
    expect(r).toMatchObject({ ok: true, raw: { redirected: true, finalUrl: `${base}/ok`, requestedUrl: `${base}/redirect` } });
  });

  it('sends no cookies', async () => {
    const r = await get('/cookies');
    expect(r.ok && r.raw.text).toBe('no cookies');
  });

  it('a refused connection is a network error (after one retry)', async () => {
    const r = await fetchLimited('http://127.0.0.1:1/', { via: 'extension', timeoutMs: 1000, fetchImpl: nodeFetch });
    expect(r).toEqual({ ok: false, error: 'network' });
  });
});
