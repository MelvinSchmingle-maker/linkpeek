/**
 * Regression tests for the network rule (D59): LinkPeek must not get a
 * request to this computer or the local network, redirects included, and
 * ordinary pages must not be affected.
 *
 * Each test serves a "private" server on 127.0.0.1 and counts the requests it
 * receives. The browser maps public-looking names (public.test, other.test)
 * onto 127.0.0.1 with --host-resolver-rules, so a public URL can redirect to
 * the private server, as it would on the open web. A refused request leaves the
 * private count at zero.
 *
 * Runs in the "guard" project (see playwright.config.ts). It needs the builds
 * from `npm run test:e2e`: dist/ (release), dist-live/ (release-equivalent,
 * with LinkPeek's test hook) and dist-e2e/ (the browser test build).
 */
import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const RELEASE = join(root, 'dist');
const LIVE = join(root, 'dist-live');
const TEST_BUILD = join(root, 'dist-e2e');
/** One rule per IPv4 range (14), plus single-label, local-name and IPv6 rules (see src/background/local-rule.ts). */
const LOCAL_RULE_COUNT = 17;
const LOCAL_RULE_IDS = Array.from({ length: LOCAL_RULE_COUNT }, (_, i) => i + 1);

test.setTimeout(90_000);

const paragraph =
  'The council said the new bridge would open to walkers and cyclists in the spring, after months of checks on its steel supports and the paths that lead to it from both banks of the river.';
const ARTICLE = `<!doctype html><html><head><title>A quiet day on the river</title></head><body><article><h1>A quiet day on the river</h1>${[
  paragraph,
  paragraph,
  paragraph,
].map((p) => `<p>${p}</p>`).join('')}</article></body></html>`;

/** Counts of requests each server received. */
const hits = { private: 0, privateIPv6: 0, article: 0 };
let privatePort = 0;
let privateIPv6Port = 0;
let publicPort = 0;
let ipv6Available = false;
let servers: Server[] = [];

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location });
  res.end();
}

test.beforeAll(async () => {
  const privateServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
    hits.private++;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end('<html><body><p>private</p></body></html>');
  });
  await new Promise<void>((done) => privateServer.listen(0, '127.0.0.1', done));
  privatePort = (privateServer.address() as { port: number }).port;

  const privateV6 = createServer((_req: IncomingMessage, res: ServerResponse) => {
    hits.privateIPv6++;
    res.end('<html><body><p>private</p></body></html>');
  });
  try {
    await new Promise<void>((done, fail) => {
      privateV6.once('error', fail);
      privateV6.listen(0, '::1', done);
    });
    ipv6Available = true;
    privateIPv6Port = (privateV6.address() as { port: number }).port;
  } catch {
    ipv6Available = false; // This machine has no IPv6 loopback; the IPv6 redirect test is skipped.
  }

  const publicServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    switch (req.url) {
      case '/article':
        hits.article++;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end(ARTICLE);
      case '/page':
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end('<html><body><p>An ordinary page.</p></body></html>');
      case '/to-private':
        return redirect(res, `http://127.0.0.1:${privatePort}/secret`);
      case '/to-private-decimal':
        return redirect(res, `http://2130706433:${privatePort}/secret`);
      case '/to-private-ipv6':
        return redirect(res, `http://[::1]:${privateIPv6Port}/secret`);
      case '/to-public':
        return redirect(res, `http://other.test:${publicPort}/article`);
      default:
        res.writeHead(404);
        res.end();
    }
  });
  await new Promise<void>((done) => publicServer.listen(0, '127.0.0.1', done));
  publicPort = (publicServer.address() as { port: number }).port;

  servers = [privateServer, privateV6, publicServer];
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((done) => s.close(() => done()))));
});

test.beforeEach(() => {
  hits.private = 0;
  hits.privateIPv6 = 0;
  hits.article = 0;
});

/** Opens a browser with one build of the extension loaded. */
async function launch(extensionPath: string, userDataDir = '') {
  const context: BrowserContext = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // public.test and other.test are public-looking names; both are sent to this computer.
      '--host-resolver-rules=MAP public.test 127.0.0.1,MAP other.test 127.0.0.1',
    ],
  });
  const isLinkPeek = (w: Worker) => w.url().startsWith('chrome-extension://');
  const worker = context.serviceWorkers().find(isLinkPeek) ?? (await context.waitForEvent('serviceworker', { predicate: isLinkPeek }));
  return { context, worker };
}

/** Number of network rules LinkPeek has installed (polls, since the rule is installed when the worker starts). */
type InstalledRule = { id: number; condition: { initiatorDomains?: string[]; regexFilter?: string } };

/** The rules LinkPeek has installed. Polls, since they are installed when the worker starts. */
async function installedRules(worker: Worker): Promise<InstalledRule[]> {
  let rules: InstalledRule[] = [];
  for (let i = 0; i < 40; i++) {
    // Right after the worker is found, Chrome may not have finished exposing the API yet.
    rules = await worker
      .evaluate(() => chrome.declarativeNetRequest.getDynamicRules())
      .catch(() => [] as InstalledRule[]);
    if (rules.length >= LOCAL_RULE_COUNT) break;
    await new Promise((done) => setTimeout(done, 150));
  }
  return rules;
}

async function extensionId(worker: Worker) {
  return worker.evaluate(() => chrome.runtime.id);
}

/** Asks LinkPeek to read an address, as the card does. Only the live build has this hook. */
async function retrieve(worker: Worker, url: string) {
  for (let i = 0; i < 40; i++) {
    if (await worker.evaluate(() => typeof (globalThis as { __linkpeekRetrieve?: unknown }).__linkpeekRetrieve === 'function')) break;
    await new Promise((done) => setTimeout(done, 150));
  }
  const res = await worker.evaluate((u) => (globalThis as unknown as { __linkpeekRetrieve: (u: string) => Promise<unknown> }).__linkpeekRetrieve(u), url);
  return res as { kind: string; result?: { failure?: string; finalUrl?: string; evidence: string } };
}

test.describe('release build (dist/)', () => {
  test('asks for the network-rule permission and no site access at install', () => {
    const manifest = JSON.parse(readFileSync(join(RELEASE, 'manifest.json'), 'utf8'));
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toEqual(['https://*/*', 'http://*/*']);
  });

  test('installs one rule, scoped to LinkPeek\'s own requests', async () => {
    const { context, worker } = await launch(RELEASE);
    try {
      const rules = await installedRules(worker);
      const id = await extensionId(worker);
      expect(rules.map((r) => r.id).sort((a, b) => a - b)).toEqual(LOCAL_RULE_IDS);
      for (const rule of rules) expect(rule.condition.initiatorDomains).toEqual([id]);
    } finally {
      await context.close();
    }
  });

  test('a request from LinkPeek to this computer is refused, and the server gets nothing', async () => {
    const { context, worker } = await launch(RELEASE);
    try {
      await installedRules(worker);
      const outcome = await worker.evaluate(
        (u) => fetch(u).then(() => 'reached', () => 'refused'),
        `http://127.0.0.1:${privatePort}/secret`,
      );
      expect(outcome).toBe('refused');
      expect(hits.private).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('a request from LinkPeek to an IPv6 loopback address is refused', async () => {
    test.skip(!ipv6Available, 'this machine has no IPv6 loopback');
    const { context, worker } = await launch(RELEASE);
    try {
      await installedRules(worker);
      const outcome = await worker.evaluate(
        (u) => fetch(u).then(() => 'reached', () => 'refused'),
        `http://[::1]:${privateIPv6Port}/secret`,
      );
      expect(outcome).toBe('refused');
      expect(hits.privateIPv6).toBe(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('live build (release-equivalent, dist-live/)', () => {
  test('LinkPeek refuses a private address before any request is made', async () => {
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const res = await retrieve(worker, `http://127.0.0.1:${privatePort}/secret`);
      expect(res.result?.failure).toBe('unsafe-address');
      expect(hits.private).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('a public address that redirects to this computer: the redirect is refused and the server gets nothing', async () => {
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const res = await retrieve(worker, `http://public.test:${publicPort}/to-private`);
      expect(res.result?.failure).toBe('network');
      expect(res.result?.finalUrl).toBeUndefined();
      expect(hits.private).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('a redirect to this computer written in another form (decimal) is refused too', async () => {
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const res = await retrieve(worker, `http://public.test:${publicPort}/to-private-decimal`);
      expect(res.result?.failure).toBe('network');
      expect(hits.private).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('a redirect to an IPv6 loopback address is refused', async () => {
    test.skip(!ipv6Available, 'this machine has no IPv6 loopback');
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const res = await retrieve(worker, `http://public.test:${publicPort}/to-private-ipv6`);
      expect(res.result?.failure).toBe('network');
      expect(hits.privateIPv6).toBe(0);
    } finally {
      await context.close();
    }
  });

  test('a legitimate public redirect still works', async () => {
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const res = await retrieve(worker, `http://public.test:${publicPort}/to-public`);
      expect(res.result?.failure).toBeUndefined();
      expect(res.result?.finalUrl).toBe(`http://other.test:${publicPort}/article`);
      expect(hits.article).toBe(1);
    } finally {
      await context.close();
    }
  });

  test('an ordinary web page can still reach this computer: the rule does not change normal browsing', async () => {
    const { context, worker } = await launch(LIVE);
    try {
      await installedRules(worker);
      const page = await context.newPage();
      await page.goto(`http://public.test:${publicPort}/page`);
      const outcome = await page.evaluate(
        (u) => fetch(u, { mode: 'no-cors' }).then(() => 'reached', () => 'refused'),
        `http://127.0.0.1:${privatePort}/secret`,
      );
      expect(outcome).toBe('reached');
      expect(hits.private).toBe(1);
    } finally {
      await context.close();
    }
  });

  test('a service-worker restart keeps the rule, and the refusal still holds', async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'linkpeek-guard-'));
    const first = await launch(LIVE, userDataDir);
    await installedRules(first.worker);
    await first.context.close();

    const second = await launch(LIVE, userDataDir);
    try {
      const rules = await installedRules(second.worker);
      expect(rules.map((r) => r.id).sort((a, b) => a - b)).toEqual(LOCAL_RULE_IDS);
      expect(rules.length).toBe(LOCAL_RULE_COUNT);
      const res = await retrieve(second.worker, `http://public.test:${publicPort}/to-private`);
      expect(res.result?.failure).toBe('network');
      expect(hits.private).toBe(0);
    } finally {
      await second.context.close();
    }
  });

  test('if the rule cannot be installed, nothing is requested at all', async () => {
    // A copy of the live build without the permission: Chrome has no network rule API for it.
    const noRule = join(root, 'test-results', 'guard-no-rule');
    cpSync(LIVE, noRule, { recursive: true, force: true });
    const manifestPath = join(noRule, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.permissions = manifest.permissions.filter((p: string) => p !== 'declarativeNetRequest');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const { context, worker } = await launch(noRule);
    try {
      const res = await retrieve(worker, `http://public.test:${publicPort}/article`);
      expect(res.result?.failure).toBe('network');
      expect(hits.article).toBe(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('browser test build (dist-e2e/)', () => {
  test('has no network rule and no such permission, so local test pages still load', async () => {
    expect(existsSync(TEST_BUILD)).toBe(true);
    const manifest = JSON.parse(readFileSync(join(TEST_BUILD, 'manifest.json'), 'utf8'));
    expect(manifest.permissions).not.toContain('declarativeNetRequest');

    const { context, worker } = await launch(TEST_BUILD);
    try {
      // The API itself is absent in the test build: LinkPeek never reaches for it.
      expect(await worker.evaluate(() => typeof chrome.declarativeNetRequest)).toBe('undefined');
    } finally {
      await context.close();
    }
  });
});
