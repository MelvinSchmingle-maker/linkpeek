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
  expect(await injectAndSend(context, { type: 'ping' })).toEqual({ ok: true });
  expect(await injectAndSend(context, { type: 'scan' })).toEqual({ ok: true, found: 2 });
  await expect(page.locator('.leftover')).toHaveCount(0);
  await expect(icons(page)).toHaveCount(2);
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
