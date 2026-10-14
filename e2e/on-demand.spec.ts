/**
 * Runs against dist-e2e-on-demand: nothing is on the page until LinkPeek is
 * injected, exactly as on any site you haven't turned on. Each test injects
 * and messages in one go, the same sequence the service worker (right-click,
 * shortcut) and the popup ("Scan this page") use.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, inWorker, OTHER_SITE, setSettings, test, TEST_SERVER } from './fixtures';

const NEWS = `${TEST_SERVER}/news-front.html`;
const icons = (page: Page) => page.locator('[data-linkpeek="icon"]');
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

/** executeScript then sendMessage straight away, like background send() and the popup. */
function injectAndSend(context: BrowserContext, msg: unknown) {
  return inWorker(
    context,
    async (m) => {
      const [tab] = await chrome.tabs.query({ url: ['http://127.0.0.1/*', 'http://demo.test/*'] });
      await chrome.scripting.executeScript({ target: { tabId: tab!.id!, frameIds: [0] }, files: ['content.js'] });
      return chrome.tabs.sendMessage(tab!.id!, m, { frameId: 0 });
    },
    msg,
  );
}

async function siteTurnedOn(context: BrowserContext, allowed: boolean) {
  await inWorker(context, (a) => chrome.storage.local.set({ e2eSiteAllowed: a }), allowed);
}

test('nothing runs until LinkPeek is asked', async ({ page }) => {
  await page.goto(NEWS);
  await page.waitForTimeout(800);
  await expect(icons(page)).toHaveCount(0);
});

test('Manual: the first right-click peek on a fresh page opens the card and it stays open (10 fresh pages)', async ({
  page,
  context,
}) => {
  await setSettings(context, { mode: 'manual' });
  for (let i = 0; i < 10; i++) {
    await page.goto(`${NEWS}?run=${i}`);
    const res = await injectAndSend(context, { type: 'peek', url: `${TEST_SERVER}/articles/cycle-lanes.html` });
    expect(res, `run ${i}`).toEqual({ ok: true });
    await page.waitForTimeout(400);
    await expect(card(page), `run ${i}`).toContainText('Millbrook council approved');
    await expect(icons(page), `run ${i}`).toHaveCount(1);
  }
});

test('Scan: the first scan on a fresh page finds the links and the icons stay (10 fresh pages)', async ({ page, context }) => {
  await setSettings(context, { mode: 'scan' });
  for (let i = 0; i < 10; i++) {
    await page.goto(`${NEWS}?run=${i}`);
    const res = await injectAndSend(context, { type: 'scan' });
    expect(res, `run ${i}`).toEqual({ ok: true, found: 11 });
    await page.waitForTimeout(400);
    await expect(icons(page), `run ${i}`).toHaveCount(11);
  }
});

test('Smart on a site you have NOT turned on: a peek opens one card and does not start scanning the page', async ({
  page,
  context,
}) => {
  await siteTurnedOn(context, false);
  await page.goto(NEWS);
  expect(await injectAndSend(context, { type: 'peek', url: `${TEST_SERVER}/articles/bakery.html` })).toEqual({ ok: true });
  await expect(card(page)).toContainText('Possible clickbait');
  await page.waitForTimeout(1500);
  await expect(icons(page)).toHaveCount(1);
});

test('Smart on a site you have turned on: icons appear by themselves once injected', async ({ page, context }) => {
  await siteTurnedOn(context, true);
  await page.goto(NEWS);
  expect(await injectAndSend(context, { type: 'ping' })).toEqual({ ok: true });
  await expect(icons(page)).toHaveCount(11);
});

test('turning a site on while LinkPeek is already on the page starts Smart mode there ("refresh")', async ({ page, context }) => {
  await siteTurnedOn(context, false);
  await page.goto(NEWS);
  await injectAndSend(context, { type: 'ping' });
  await page.waitForTimeout(800);
  await expect(icons(page)).toHaveCount(0);
  await siteTurnedOn(context, true);
  expect(await injectAndSend(context, { type: 'refresh' })).toEqual({ ok: true });
  await expect(icons(page)).toHaveCount(11);
});

test('a page element named __linkpeekLoaded cannot stop LinkPeek; old leftover icons are removed', async ({ page, context }) => {
  await setSettings(context, { mode: 'scan' });
  await page.goto(`${TEST_SERVER}/clobber.html`);
  // Playwright's own locators trip over this page's crafted forms, so wait plainly. (The page adds a third story after 1.5 s.)
  await page.waitForFunction(() => Boolean(document.getElementById('late')?.querySelector('a')));
  expect(await injectAndSend(context, { type: 'ping' })).toEqual({ ok: true });
  expect(await injectAndSend(context, { type: 'scan' })).toEqual({ ok: true, found: 3 });
  await expect(page.locator('.leftover')).toHaveCount(0);
  await expect(icons(page)).toHaveCount(3);
});

test('injecting twice is harmless: no duplicate icons', async ({ page, context }) => {
  await setSettings(context, { mode: 'scan' });
  await page.goto(NEWS);
  await injectAndSend(context, { type: 'scan' });
  expect(await injectAndSend(context, { type: 'scan' })).toEqual({ ok: true, found: 11 });
  await expect(icons(page)).toHaveCount(11);
});

test('demo markup is ignored on a site that is not LinkPeek’s test server', async ({ page, context }) => {
  await setSettings(context, { mode: 'manual' });
  await page.goto(`${OTHER_SITE}/news-front.html`);
  // The page marks this link as a "passed" demo result. On a real site that must mean nothing.
  const res = await injectAndSend(context, { type: 'peek', url: `${OTHER_SITE}/articles/cycle-lanes.html` });
  expect(res).toEqual({ ok: true });
  await expect(card(page)).toContainText("can't read articles yet");
  await expect(card(page)).not.toContainText('Headline check passed');
  await expect(card(page)).not.toContainText('Demo data');
});

// ---------- Frames ----------

/** Frame ids by page address, after adding LinkPeek to every frame (as the shortcut does). */
async function frameIds(context: BrowserContext): Promise<Record<string, number>> {
  return inWorker(
    context,
    async () => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      await chrome.scripting.executeScript({ target: { tabId: tab!.id!, allFrames: true }, files: ['content.js'] });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab!.id!, allFrames: true },
        func: () => location.pathname,
      });
      return Object.fromEntries(results.map((r) => [r.result as string, r.frameId]));
    },
    null,
  );
}

function sendToFrame(context: BrowserContext, msg: unknown, frameId?: number) {
  return inWorker(
    context,
    async ([m, f]) => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      const options = f === undefined ? {} : { frameId: f as number };
      return chrome.tabs.sendMessage(tab!.id!, m, options).catch(() => null);
    },
    [msg, frameId] as const,
  );
}

const frameCard = (page: Page) => page.frameLocator('#frame').locator('[data-linkpeek="card"] .card');

test('frames: only one card is open in a tab at a time, across frames', async ({ page, context }) => {
  await setSettings(context, { mode: 'manual' });
  await page.goto(`${TEST_SERVER}/frames.html`);
  await page.frameLocator('#frame').locator('#frame-story').waitFor();
  const ids = await frameIds(context);
  const inner = ids['/frame-inner.html']!;
  expect(inner).toBeGreaterThan(0);

  // Peek in the top page.
  expect(await sendToFrame(context, { type: 'peek', url: `${TEST_SERVER}/2026/10/14/top-page-story-about-bin-collections` }, 0)).toEqual({ ok: true });
  await expect(card(page)).toBeVisible();

  // Then in the frame: the service worker closes cards everywhere first.
  await sendToFrame(context, { type: 'close-card' });
  expect(
    await sendToFrame(context, { type: 'peek', url: `${TEST_SERVER}/2026/10/14/framed-story-about-the-harbour-wall-repairs` }, inner),
  ).toEqual({ ok: true });
  await expect(frameCard(page)).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test('frames: the shortcut peeks at a focused link inside a frame; other frames stay silent', async ({ page, context }) => {
  await setSettings(context, { mode: 'manual' });
  await page.goto(`${TEST_SERVER}/frames.html`);
  const frameLink = page.frameLocator('#frame').locator('#frame-story');
  await frameLink.waitFor();
  await frameIds(context); // LinkPeek in every frame, as the shortcut handler does
  await frameLink.focus();
  // Sent to the whole tab, like the shortcut. Only the frame with the focused link answers.
  expect(await sendToFrame(context, { type: 'peek-focused' })).toEqual({ ok: true });
  await expect(frameCard(page)).toContainText("can't read articles yet");
  await expect(card(page)).toHaveCount(0);
});
