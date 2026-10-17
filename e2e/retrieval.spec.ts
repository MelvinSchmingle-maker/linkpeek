/**
 * Part 04: reading real destinations, end to end in Chromium, against the
 * local test server (test-pages/retrieval.html and the routes in
 * scripts/serve-test-pages.mjs). No internet needed.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, inWorker, setSettings, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/retrieval.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

async function openCase(page: Page, name: string) {
  await page.locator(`a[data-case="${name}"] + [data-linkpeek="icon"]`).getByRole('button').click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  return card(page);
}

/** Peek at a link by URL (for links that get no icon, like an image). */
async function peek(context: BrowserContext, url: string) {
  return inWorker(
    context,
    async (u) => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'peek', url: u }).catch(() => null);
    },
    url,
  );
}

async function hits(page: Page, path: string): Promise<number> {
  const res = await page.request.get(`${TEST_SERVER}/hits?path=${encodeURIComponent(path)}`);
  return ((await res.json()) as { count: number }).count;
}

test.beforeEach(async ({ page }) => {
  await page.request.get(`${TEST_SERVER}/hits/reset`);
  await page.goto(PAGE);
  await expect(page.locator('a[data-case="full"] + [data-linkpeek="icon"]')).toHaveCount(1);
});

/** Full articles: a summary, labelled with who wrote it, 20 words or fewer (Part 05). */
const SUMMARISED: [string, string][] = [
  ['full', 'Millbrook council has approved two kilometres of protected cycle lanes on High Street, with work due to start in March.'],
  ['full-divs', "A review of Millbrook's library service has recommended longer opening hours at weekends."],
  ['full-blog', 'I have grown tomatoes on a small balcony for three summers now.'],
  ['other-site', 'I have grown tomatoes on a small balcony for three summers now.'],
  ['redirect', 'Millbrook council has approved two kilometres of protected cycle lanes on High Street, with work due to start in March.'],
];

for (const [name, summary] of SUMMARISED) {
  test(`summarises: ${name}`, async ({ page }) => {
    const c = await openCase(page, name);
    await expect(c.locator('.summary-label')).toHaveText("In the article's own words:");
    await expect(c.locator('.summary')).toHaveText(summary);
    const words = (await c.locator('.summary').innerText()).trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(20);
    // No verdict mark LinkPeek didn't earn.
    await expect(c.locator('[data-status]')).toHaveCount(0);
  });
}

const READ: [string, RegExp][] = [
  ['partial-short', /Preview only[\s\S]*Full article unavailable\. Showing a preview[\s\S]*The Saturday market returns this weekend with twenty stalls\./],
  ['partial-meta', /Full article unavailable[\s\S]*Residents will discuss the proposed park redesign/],
  ['nothing', /Couldn't find the article text on this page\./],
  ['login', /Couldn't open this article\. The site asks you to log in\./],
  ['paywall', /It's behind a subscription\.[\s\S]*Members only: a look at the draft budget/],
  ['js', /needs to run in a browser tab[\s\S]*Rail timetable changes from December/],
  ['challenge', /The site asked for a human check\./],
  ['403', /The site refused the request\./],
  ['404', /The site said the page isn't available\./],
  ['429', /The site is limiting requests right now\./],
  ['500', /The site had an error\./],
  ['redirect', /Opens on demo\.test\./],
  ['huge', /It's too large to preview\./],
  ['pdf', /In the article's own words:/],
  ['pdf-long', /Only the first pages of this PDF were read/],
  ['pdf-scanned', /Couldn't find the article text/],
];

for (const [name, expected] of READ) {
  test(`reads: ${name}`, async ({ page }) => {
    const c = await openCase(page, name);
    await expect(c).toContainText(expected);
    // Never a verdict mark LinkPeek didn't earn. A summary only where the whole article was read.
    await expect(c.locator('[data-status]')).toHaveCount(0);
    if (!['redirect', 'pdf'].includes(name)) await expect(c.locator('.summary')).toHaveCount(0);
  });
}

test('a paywalled page never shows text from its paid body, and gets no summary', async ({ page }) => {
  const c = await openCase(page, 'paywall');
  await expect(c).not.toContainText('Councillors voted seven to five');
  await expect(c.locator('.summary')).toHaveCount(0);
});

test('Settings: the on-device AI option says plainly when this computer cannot run it', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await expect(page.locator('#ondevice-toggle')).not.toBeChecked();
  // Playwright's Chromium has no on-device model: the page must say so, not pretend.
  await expect(page.locator('#ondevice-status')).toHaveText(/can't run|doesn't offer|needs to download/);
});

test('a slow site times out with a clear message (after one retry)', async ({ page }) => {
  const c = await openCase(page, 'slow');
  await expect(c).toContainText("The site took too long to respond.");
  expect(await hits(page, '/slow')).toBe(2);
});

test('refusals are never retried: 403, 429 and robot checks are asked once', async ({ page }) => {
  for (const [name, path] of [['403', '/status/403'], ['429', '/status/429'], ['challenge', '/challenge']] as const) {
    await openCase(page, name);
    expect(await hits(page, path), path).toBe(1);
    await page.keyboard.press('Escape');
  }
});

test('an image is not something LinkPeek can preview', async ({ page, context }) => {
  expect(await peek(context, `${TEST_SERVER}/image.png`)).toEqual({ ok: true });
  await expect(card(page)).toContainText("LinkPeek can't preview this type of link yet.", { timeout: 10_000 });
});

test('a link to this very page is read from the page itself, not fetched again', async ({ page, context }) => {
  const before = await hits(page, '/retrieval.html');
  expect(await peek(context, `${TEST_SERVER}/retrieval.html#top`)).toEqual({ ok: true });
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 10_000 });
  expect(await hits(page, '/retrieval.html')).toBe(before);
});

test('the same article twice is fetched once (cached)', async ({ page }) => {
  await openCase(page, 'full');
  await page.keyboard.press('Escape');
  const c = await openCase(page, 'full');
  await expect(c).toContainText('Millbrook council has approved');
  expect(await hits(page, '/articles/cycle-lanes.html')).toBe(1);
});

test('passing problems are not cached: a 429 is asked again next time', async ({ page }) => {
  await openCase(page, '429');
  await page.keyboard.press('Escape');
  await openCase(page, '429');
  expect(await hits(page, '/status/429')).toBe(2);
});

test.describe('without access to the site', () => {
  test.beforeEach(async ({ context, page }) => {
    await inWorker(context, () => chrome.storage.local.set({ e2eHostAccess: false }), null);
    await page.request.get(`${TEST_SERVER}/hits/reset`);
  });

  test('a same-site link is fetched by the page itself (no extra permission needed)', async ({ page }) => {
    const c = await openCase(page, 'full-divs');
    await expect(c).toContainText("A review of Millbrook's library service");
    expect(await hits(page, '/articles/library-review.html')).toBe(1);
  });

  test('a link to another site asks for permission, and "Allow access…" opens LinkPeek’s window', async ({ page, context }) => {
    const c = await openCase(page, 'other-site');
    await expect(c).toContainText('LinkPeek needs your permission to read pages on demo.test.');
    const windowOpened = context.waitForEvent('page');
    await c.getByRole('button', { name: 'Allow access…' }).click();
    const win = await windowOpened;
    await expect(win.locator('#host')).toHaveText('demo.test');
    await expect(win.getByRole('button', { name: 'Allow demo.test' })).toBeVisible();
    await expect(win.getByRole('button', { name: 'Allow all websites' })).toBeVisible();
    // Nothing was fetched from the other site.
    expect(await hits(page, '/articles/tomatoes.html')).toBe(0);
  });

  test('once access is granted, the open card tries again by itself', async ({ page, context }) => {
    const c = await openCase(page, 'other-site');
    await expect(c).toContainText('needs your permission');
    // Stand-in for the user allowing it in Chrome's prompt (tests can't click that).
    await inWorker(context, () => chrome.storage.local.set({ e2eHostAccess: true }), null);
    await inWorker(
      context,
      async () => {
        const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
        await chrome.tabs.sendMessage(tab!.id!, { type: 'retry' });
      },
      null,
    );
    await expect(c).toContainText('I have grown tomatoes on a small balcony', { timeout: 10_000 });
  });
});

test('Manual mode: right-click peek on a real link reads it', async ({ page, context }) => {
  await setSettings(context, { mode: 'manual' });
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(0);
  expect(await peek(context, `${TEST_SERVER}/articles/tomatoes.html`)).toEqual({ ok: true });
  await expect(card(page)).toContainText('I have grown tomatoes on a small balcony', { timeout: 10_000 });
});

test('a service worker restart in the middle of reading still gets an answer', async ({ page, context }) => {
  await page.locator('a[data-case="slow-ok"] + [data-linkpeek="icon"]').getByRole('button').click();
  await expect(card(page)).toContainText('Reading the article...');
  // Stop every service worker while the slow page is still loading.
  const cdp = await context.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.stopAllWorkers');
  await expect(card(page)).toContainText('Millbrook council has approved', { timeout: 15_000 });
  // Proof the worker really died mid-request: the page had to ask again,
  // so the slow article was requested twice.
  expect(await hits(page, '/slow-ok')).toBe(2);
});
