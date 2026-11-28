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

/** What the stand-in AI backend was sent, newest last (for checking what LinkPeek sends). */
const aiBodies = [];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });

/**
 * A stand-in for LinkPeek's summary backend (server/), with the same
 * request and reply shapes. It never calls an AI. Test builds point here.
 */
async function standInAi(res, _url, req) {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const body = JSON.parse((await readBody(req)) || '{}');
  aiBodies.push(body);
  const reply = (status, obj) => res.writeHead(status, { 'content-type': 'application/json', ...cors }).end(JSON.stringify(obj));
  const text = String(body.text ?? '');
  // The library article: the backend is having a bad day.
  if (text.includes("library service")) return reply(502, { error: 'upstream' });
  // The tomato blog: too long at first, so LinkPeek must ask for a shorter one.
  if (body.task === 'shorten') return reply(200, { summary: 'A balcony gardener shares three summers of lessons from growing tomatoes.', model: 'stand-in', usage: {} });
  if (text.includes('tomatoes')) {
    return reply(200, {
      summary: 'A gardener who has grown tomatoes on a small south-facing balcony for three summers explains in detail what went wrong in the first two years.',
      model: 'stand-in',
      usage: {},
    });
  }
  if (text.includes('Millbrook council has approved')) {
    return reply(200, { summary: 'Councillors approved protected cycle lanes on High Street by seven votes to five.', model: 'stand-in', usage: {} });
  }
  return reply(200, { summary: 'A summary from the stand-in AI backend for this test page.', model: 'stand-in', usage: {} });
}

/** What the stand-in Story Search backend was sent, newest last. */
const storyBodies = [];

const storySource = (n, title, publisher, url, kind = 'news', extra = {}) => ({ n, title, publisher, url, published: '2026-11-25', kind, match: 'strong', ...extra });
const storyReport = (patch) => ({
  status: 'report',
  match: 'strong',
  confidence: 'strong',
  whatHappened: [],
  details: [],
  confirmed: [],
  reported: [],
  unclear: [],
  sources: [],
  setAside: 0,
  notes: [],
  searchedFor: '',
  checkedAt: '2026-11-26T10:00:00.000Z',
  ...patch,
});

/**
 * A stand-in for Story Search (server/api/story.ts), with the same request
 * and streamed reply shapes. It never searches or calls an AI: the answer
 * depends on words in the headline, so tests can reach every state. The
 * stages are a little apart, so a test can watch them change.
 */
async function standInStory(res, _url, req) {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  const body = JSON.parse((await readBody(req)) || '{}');
  storyBodies.push(body);
  const words = `${body.headline?.text ?? ''} ${body.slug ?? ''} ${body.description?.text ?? ''}`.toLowerCase();
  const searchedFor = body.headline?.text ?? body.slug ?? '';
  if (words.includes('rate limited')) return res.writeHead(429, { 'content-type': 'application/json', ...cors }).end(JSON.stringify({ error: 'rate-limited' }));
  // The backend itself failing (a crash, a bad deploy): not a stream at all.
  if (words.includes('server down')) return res.writeHead(500, { 'content-type': 'text/html', ...cors }).end('<h1>Internal Server Error</h1>');
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', ...cors });
  const send = (o) => res.write(`${JSON.stringify(o)}\n`);
  send({ stage: 'searching' });
  await wait(250);
  if (words.includes('search broken')) {
    send({ error: 'search-failed' });
    return res.end();
  }
  if (words.includes('free searches used')) {
    send({ error: 'out-of-credit' });
    return res.end();
  }
  if (words.includes('nothing turned up')) {
    send({ report: storyReport({ status: 'no-results', match: 'none', confidence: 'insufficient', searchedFor }) });
    return res.end();
  }
  if (words.includes('unknown harbour')) {
    send({ report: storyReport({ status: 'no-match', match: 'none', confidence: 'insufficient', setAside: 4, notes: ['older-story'], searchedFor }) });
    return res.end();
  }
  send({ stage: 'analysing', found: 3 });
  await wait(250);
  send({ stage: 'writing' });
  await wait(100);
  if (words.includes('ai down')) {
    // Claude didn't answer: the closest results only, as possible matches, and no claims.
    send({
      report: storyReport({
        status: 'report-failed',
        match: 'possible',
        confidence: 'insufficient',
        sources: [
          { ...storySource(1, 'Dock cranes to be replaced', 'Example News', 'http://127.0.0.1:4173/articles/ordinary.html'), match: 'possible' },
          { ...storySource(2, 'New cranes for the docks', 'Demo Times', 'http://127.0.0.1:4173/articles/cycle-lanes.html'), match: 'possible' },
        ],
        setAside: 1,
        searchedFor,
      }),
    });
    return res.end();
  }
  if (words.includes('pop star found dead')) {
    // A link with no name and no date (live, the search found deaths from 1997, 2012 and 2024): the closest
    // results as possible matches, each with its date, no subject, nothing written, and why (D68).
    send({
      report: storyReport({
        match: 'possible',
        confidence: 'insufficient',
        sources: [
          { ...storySource(1, 'Singer found dead in hotel room', 'Example News', 'http://127.0.0.1:4173/articles/ordinary.html'), published: '2012-02-12', match: 'possible' },
          { ...storySource(2, 'Rock star found dead in Sydney hotel', 'Demo Times', 'http://127.0.0.1:4173/articles/cycle-lanes.html'), published: '1997-11-22', match: 'possible' },
        ],
        notes: ['vague-link'],
        setAside: 3,
        searchedFor,
      }),
    });
    return res.end();
  }
  if (words.includes('many sources')) {
    const long = 'Harbour festival returns with tall ships, a night market and fireworks over the old quay after a three-year break, organisers confirm';
    send({
      report: storyReport({
        subject: 'Harbour festival returns after a three-year break',
        whatHappened: [{ text: 'The harbour festival will return on 12 June 2027 after a three-year break, organisers said.', sources: [1, 2, 3] }],
        confirmed: [{ text: 'The festival returns on 12 June 2027.', sources: [1, 3] }],
        reported: [{ text: 'Fireworks will be launched from the old quay.', sources: [4] }],
        sources: [
          { ...storySource(1, 'Harbour festival is back', 'Demo Gazette', 'http://127.0.0.1:4173/2026/11/25/many-sources-story-about-the-harbour-festival'), original: true },
          storySource(2, `${long} (wire report)`, 'Example Wire', 'http://127.0.0.1:4173/articles/ordinary.html', 'agency', { via: 'Example Wire' }),
          storySource(3, 'Festival dates announced', 'Example News', 'http://127.0.0.1:4173/articles/cycle-lanes.html', 'news', { copyOf: 2, via: 'Example Wire' }),
          storySource(4, 'Night market plans for the quay', 'Demo Times', 'http://127.0.0.1:4173/articles/bridge.html', 'news'),
          storySource(5, 'Why the festival matters', 'Demo Times', 'http://127.0.0.1:4173/articles/opinion.html', 'opinion'),
          { ...storySource(6, 'Can’t wait for the fireworks!', 'social.example', 'http://127.0.0.1:4173/articles/post.html', 'social'), match: 'possible' },
        ],
        notes: ['syndicated'],
        searchedFor,
      }),
    });
    return res.end();
  }
  if (words.includes('possible bridge')) {
    send({
      report: storyReport({
        match: 'possible',
        confidence: 'partial',
        subject: 'Bridge repairs may close the crossing',
        whatHappened: [{ text: 'A local paper says the old bridge may close for repairs in December 2026.', sources: [1] }],
        sources: [{ ...storySource(1, 'Bridge could shut', 'Local Gazette', 'http://127.0.0.1:4173/articles/bridge.html'), match: 'possible' }],
        notes: ['single-source'],
        searchedFor,
      }),
    });
    return res.end();
  }
  send({
    report: storyReport({
      subject: 'Ferry strike called off after late-night talks',
      whatHappened: [
        {
          text: 'Harbour Ferries workers called off a strike planned for 1 December 2026 after talks ended on 25 November.',
          sources: [1, 2],
          evidence: [
            { source: 1, quote: 'The crew union called off the strike planned for 1 December after talks ended late on 25 November.' },
            { source: 2, quote: 'Harbour Ferries workers will not strike on 1 December, the union said.' },
          ],
        },
      ],
      details: [{ label: 'who', text: 'Harbour Ferries and the crew union.', sources: [1], evidence: [{ source: 1, quote: 'Harbour Ferries and the crew union reached a deal' }] }],
      confirmed: [
        {
          text: 'The strike planned for 1 December 2026 will not go ahead.',
          sources: [1, 2],
          evidence: [
            { source: 1, quote: 'called off the strike planned for 1 December' },
            { source: 2, quote: 'Harbour Ferries workers will not strike on 1 December' },
          ],
        },
      ],
      reported: [{ text: 'The deal includes a 4% pay rise.', sources: [2], evidence: [{ source: 2, quote: 'a pay offer the union described as fair' }], weak: true }],
      unclear: [{ text: 'The full terms of the deal have not been published.', sources: [] }],
      sources: [
        storySource(1, 'Ferry strike off after talks', 'Example News', 'http://127.0.0.1:4173/articles/ordinary.html', 'news', { depth: 'full' }),
        storySource(2, 'Union and ferry firm agree deal', 'Demo Times', 'http://127.0.0.1:4173/articles/cycle-lanes.html', 'news', { updated: '2026-11-26', corrected: true, depth: 'excerpt' }),
      ],
      independent: 2,
      headline: {
        headline: 'Ferry strike called off after late-night talks',
        verdict: 'accurate',
        reason: 'Both reports say the strike was called off after talks.',
        evidence: [{ source: 1, quote: 'The crew union called off the strike planned for 1 December after talks ended late on 25 November.' }],
        basis: { kind: 'supported' },
      },
      setAside: 2,
      searchedFor,
    }),
  });
  res.end();
}

const routes = {
  '/api/summarise': standInAi,
  '/api/story': standInStory,
  '/api/story/sent': (res) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(storyBodies)),
  '/api/summarise/sent': (res) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(aiBodies)),
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
  // A corrections page at the address most sites use (Part 08).
  '/corrections': async (res) => res.writeHead(200, { 'content-type': html }).end(await readFile(join(root, 'corrections.html'))),
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
    aiBodies.length = 0;
    storyBodies.length = 0;
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
    await route(res, url, req);
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
