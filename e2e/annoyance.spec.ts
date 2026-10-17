/**
 * Part 12: the annoyance tools, in Chromium, on test-pages/annoyance.html.
 * Each tool is tried alone, then undone. The login box and the cookie notice
 * on the page must never be hidden, whatever is switched on.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { DEFAULT_ANNOYANCE } from '../src/core/storage/settings';
import { expect, inWorker, setSettings, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/annoyance.html`;
const ALL_ON = Object.fromEntries(Object.keys(DEFAULT_ANNOYANCE).map((k) => [k, true])) as unknown as typeof DEFAULT_ANNOYANCE;
const shown = (page: Page, sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).display !== 'none');

async function openPage(page: Page, context: BrowserContext, tools: Partial<typeof DEFAULT_ANNOYANCE>) {
  await setSettings(context, { annoyance: { ...DEFAULT_ANNOYANCE, ...tools } });
  await page.goto(PAGE);
  // The page's own script locks scrolling with the sign-up box. Wait for LinkPeek to be running.
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete');
}

test('sign-up boxes are hidden, the page scrolls again, and the login box and cookie notice stay', async ({ page, context }) => {
  await openPage(page, context, { signUpOverlays: true });
  await expect.poll(() => shown(page, '#signup')).toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  expect(await shown(page, '#login')).toBe(true);
  expect(await shown(page, '#cookie-banner')).toBe(true);
});

test('floating videos are hidden, but the video in the article is not', async ({ page, context }) => {
  await openPage(page, context, { floatingVideo: true });
  await expect.poll(() => shown(page, '#float-video')).toBe(false);
  expect(await shown(page, '#sound-video')).toBe(true);
});

test('large sticky bars are hidden; a cookie notice at the bottom is never one of them', async ({ page, context }) => {
  await openPage(page, context, { stickyBars: true });
  await expect.poll(() => shown(page, '#sticky-header')).toBe(false);
  expect(await shown(page, '#cookie-banner')).toBe(true);
});

test('urgency claims get a note, and nothing is hidden', async ({ page, context }) => {
  await openPage(page, context, { urgencyLabels: true });
  const note = page.locator('[data-linkpeek-annoyance-label]').first();
  await expect(note).toHaveText("Urgency claim: LinkPeek can't verify this.");
  await expect(page.locator('p.urgency')).toBeVisible();
  await expect(page.locator('p.timer')).toBeVisible();
});

test('a video with sound that starts by itself is paused; a muted one is left alone', async ({ page, context }) => {
  await openPage(page, context, { autoplayPause: true });
  await expect.poll(() => page.evaluate(() => (document.getElementById('sound-video') as HTMLVideoElement).autoplay)).toBe(false);
  expect(await page.evaluate(() => (document.getElementById('muted-video') as HTMLVideoElement).autoplay)).toBe(true);
});

test('undo on this page puts back everything the tools changed', async ({ page, context, extensionId }) => {
  await openPage(page, context, ALL_ON);
  await expect.poll(() => shown(page, '#signup')).toBe(false);
  await expect(page.locator('[data-linkpeek-annoyance-label]').first()).toBeVisible();

  const tabId = await inWorker(context, async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0]!.id, null);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
  await popup.getByRole('button', { name: 'Undo on this page' }).click();
  await expect(popup.locator('#annoyance-status')).toContainText('Put back');

  await expect.poll(() => shown(page, '#signup')).toBe(true);
  await expect.poll(() => shown(page, '#sticky-header')).toBe(true);
  await expect.poll(() => shown(page, '#float-video')).toBe(true);
  expect(await page.locator('[data-linkpeek-annoyance-label]').count()).toBe(0);
  expect(await page.evaluate(() => (document.getElementById('sound-video') as HTMLVideoElement).autoplay)).toBe(true);
});

test('the popup switches a tool on for this site only, and the options page shows it', async ({ page, context, extensionId }) => {
  await page.goto(PAGE);
  const tabId = await inWorker(context, async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0]!.id, null);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
  await popup.getByRole('checkbox', { name: /Sign-up boxes/ }).check();
  await expect.poll(() => shown(page, '#signup')).toBe(false);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await expect(options.locator('#annoyance-sites')).toContainText('127.0.0.1 (Sign-up boxes: on)');
  // The global default is still off: the choice is for this site only.
  await expect(options.getByRole('checkbox', { name: /Sign-up boxes/ })).not.toBeChecked();
});
