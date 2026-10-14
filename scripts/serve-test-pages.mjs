/**
 * Tiny static server for test-pages/, used by the Playwright tests and for
 * trying the extension by hand: node scripts/serve-test-pages.mjs
 * Serves on http://127.0.0.1:4173 only (never on your network).
 *
 * Besides the files, a few routes imitate how real sites behave, so
 * LinkPeek's failure handling can be tested without the internet.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../test-pages/', import.meta.url));
const icon = fileURLToPath(new URL('../public/icons/icon-16.png', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf' };
const html = 'text/html; charset=utf-8';

/** Requests per path, so tests can check that LinkPeek doesn't fetch the same article twice. */
const hits = new Map();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const routes = {
  '/status/403': (res) => res.writeHead(403, { 'content-type': html }).end('<h1>Forbidden</h1>'),
  '/status/404': (res) => res.writeHead(404, { 'content-type': html }).end('<h1>Page not found</h1>'),
  '/status/429': (res) => res.writeHead(429, { 'content-type': html, 'retry-after': '120' }).end('<h1>Too many requests</h1>'),
  '/status/500': (res) => res.writeHead(500, { 'content-type': html }).end('<h1>Server error</h1>'),
  // A bot check, served the way Cloudflare does: status 503 and a challenge page.
  '/challenge': async (res) => res.writeHead(503, { 'content-type': html }).end(await readFile(join(root, 'articles/challenge.html'))),
  // A link that ends up on another site.
  '/redirect-cross': (res) => res.writeHead(302, { location: 'http://demo.test:4173/articles/cycle-lanes.html' }).end(),
  // A members-only story that sends you to a login page.
  '/redirect-login': (res) => res.writeHead(302, { location: '/accounts/login?next=%2Fmembers%2Fstory' }).end(),
  '/accounts/login': async (res) => res.writeHead(200, { 'content-type': html }).end(await readFile(join(root, 'articles/login.html'))),
  // Too slow: answers after LinkPeek has given up.
  '/slow': async (res) => {
    await wait(10_000);
    if (!res.destroyed) res.writeHead(200, { 'content-type': html }).end(await readFile(join(root, 'articles/cycle-lanes.html')));
  },
  // A little slow, but fine (for testing a service worker restart mid-request).
  '/slow-ok': async (res) => {
    await wait(1500);
    if (!res.destroyed) res.writeHead(200, { 'content-type': html }).end(await readFile(join(root, 'articles/cycle-lanes.html')));
  },
  // Bigger than LinkPeek will read (4 MB of HTML, no Content-Length).
  '/huge': (res) => {
    res.writeHead(200, { 'content-type': html });
    const chunk = `<p>${'Lorem ipsum dolor sit amet. '.repeat(400)}</p>`;
    let sent = 0;
    const pump = () => {
      while (sent < 4 * 1024 * 1024) {
        if (res.destroyed) return;
        sent += chunk.length;
        if (!res.write(chunk)) return res.once('drain', pump);
      }
      res.end();
    };
    res.on('error', () => undefined);
    pump();
  },
  // Not an article at all.
  '/image.png': async (res) => res.writeHead(200, { 'content-type': 'image/png' }).end(await readFile(icon)),
  '/hits': (res, url) =>
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ count: hits.get(url.searchParams.get('path')) ?? 0 })),
  '/hits/reset': (res) => {
    hits.clear();
    res.writeHead(200).end('ok');
  },
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = normalize(decodeURIComponent(url.pathname));
  if (!path.startsWith('/hits')) hits.set(path, (hits.get(path) ?? 0) + 1);
  // /hang/...: never answers, like an ad or tracker that keeps a page "loading" forever.
  if (path.startsWith('/hang/')) return;
  if (path.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  const route = routes[path];
  if (route) {
    await route(res, url);
    return;
  }
  const file = join(root, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Test pages on http://127.0.0.1:${port}`));
