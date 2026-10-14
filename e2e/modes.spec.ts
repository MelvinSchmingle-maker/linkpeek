import type { BrowserContext, Page } from '@playwright/test';
import { expect, setSettings, test, TEST_SERVER } from './fixtures';

const NEWS = `${TEST_SERVER}/news-front.html`;
const icons = (page: Page) => page.locator('[data-linkpeek="icon"]');

/** Send a message to the test page's content script, as the popup or service worker would. */
async function sendToPage(context: BrowserContext, msg: unknown) {
  const [worker] = context.serviceWorkers();
  return worker!.evaluate(async (m) => {
    const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
    // null = no frame answered (what the service worker treats as "couldn't peek").
    return chrome.tabs.sendMessage(tab!.id!, m).catch(() => null);
  }, msg);
}

async function openPopupFor(context: BrowserContext, extensionId: string) {
  const [worker] = context.serviceWorkers();
  const tabId = await worker!.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0]!.id);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
  return popup;
}

test('Smart is the default and shows icons by itself', async ({ page }) => {
  await page.goto(NEWS);
  await expect(icons(page)).toHaveCount(11);
});

test('Scan mode: no icons until "Scan this page"', async ({ page, context, extensionId }) => {
  await page.goto(NEWS);
  await expect(icons(page)).toHaveCount(11);
  const popup = await openPopupFor(context, extensionId);
  await popup.getByLabel(/Scan/).first().check();
  await expect(icons(page)).toHaveCount(0);

  await popup.getByRole('button', { name: 'Scan this page' }).click();
  await expect(popup.getByText('Found 11 article links')).toBeVisible();
  await expect(icons(page)).toHaveCount(11);
});

test('Scan mode on a fresh page load shows nothing by itself', async ({ page, context }) => {
  await page.goto(NEWS);
  await setSettings(context, { mode: 'scan' });
  await page.reload();
  await page.waitForTimeout(500);
  await expect(icons(page)).toHaveCount(0);
  await expect((await sendToPage(context, { type: 'scan' })) as { found: number }).toEqual({ ok: true, found: 11 });
});

test('Manual mode: no icons; "peek" opens the card for one link, and closing removes its icon', async ({ page, context }) => {
  await page.goto(NEWS);
  await setSettings(context, { mode: 'manual' });
  await expect(icons(page)).toHaveCount(0);

  const res = await sendToPage(context, { type: 'peek', url: `${TEST_SERVER}/articles/cycle-lanes.html` });
  expect(res).toEqual({ ok: true });
  const card = page.locator('[data-linkpeek="card"] .card');
  await expect(card).toContainText('Millbrook council approved');
  await expect(icons(page)).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(icons(page)).toHaveCount(0);
  // Focus goes back to the link itself.
  await expect(page.locator('a[data-linkpeek-demo="full"]')).toBeFocused();
});

test('keyboard shortcut path: peek at the focused link', async ({ page, context }) => {
  await page.goto(NEWS);
  await setSettings(context, { mode: 'manual' });
  await page.locator('a[data-linkpeek-demo="clickbait"]').focus();
  expect(await sendToPage(context, { type: 'peek-focused' })).toEqual({ ok: true });
  await expect(page.locator('[data-linkpeek="card"] .card')).toContainText('Possible clickbait');
});

test('peek with nothing focused or an unknown URL fails quietly', async ({ page, context }) => {
  await page.goto(NEWS);
  // Nothing focused: no frame answers, so the service worker shows its "?" badge.
  expect((await sendToPage(context, { type: 'peek-focused' })) ?? null).toBeNull();
  expect(await sendToPage(context, { type: 'peek', url: 'https://nowhere.example/' })).toEqual({ ok: false });
});

test('mode choice persists after a reload', async ({ page, context, extensionId }) => {
  await page.goto(NEWS);
  const popup = await openPopupFor(context, extensionId);
  await popup.getByLabel(/Manual/).check();
  await page.reload();
  await page.waitForTimeout(500);
  await expect(icons(page)).toHaveCount(0);
  await popup.reload();
  await expect(popup.getByLabel(/Manual/)).toBeChecked();
});

test('turning LinkPeek off for a site removes icons at once, and on brings them back', async ({ page, context, extensionId }) => {
  await page.goto(NEWS);
  await expect(icons(page)).toHaveCount(11);
  const popup = await openPopupFor(context, extensionId);
  await expect(popup.locator('#site-name')).toHaveText('127.0.0.1');
  await popup.getByRole('button', { name: /Turn off LinkPeek for 127\.0\.0\.1/ }).click();
  await expect(icons(page)).toHaveCount(0);
  await expect(popup.locator('#site-state')).toContainText('Off');

  await page.reload();
  await page.waitForTimeout(500);
  await expect(icons(page)).toHaveCount(0);

  await popup.getByRole('button', { name: /Turn on LinkPeek for 127\.0\.0\.1/ }).click();
  await expect(icons(page)).toHaveCount(11);
});

test('settings page lists a turned-off site and can turn it back on', async ({ page, context, extensionId }) => {
  await page.goto(NEWS);
  await setSettings(context, { disabledSites: ['127.0.0.1'] });
  await expect(icons(page)).toHaveCount(0);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await options.getByRole('button', { name: 'Turn back on: 127.0.0.1' }).click();
  await expect(icons(page)).toHaveCount(11);
  await expect(options.locator('#disabled-list')).toContainText('None.');
});
