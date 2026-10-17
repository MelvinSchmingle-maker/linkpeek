/**
 * Part 11: the link check, end to end in Chromium (test-pages/link-check.html).
 * The links are made up. None of them is followed: the card only reads their
 * addresses, and "Check where this link goes" is asked of a site with no
 * access, so it answers "needs permission" without any request leaving.
 */
import type { Page } from '@playwright/test';
import { expect, inWorker, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/link-check.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');
const iconFor = (page: Page, key: string) =>
  page.locator(`a[data-case="${key}"] + [data-linkpeek="icon"]`).getByRole('button');

async function openCase(page: Page, key: string) {
  await page.goto(PAGE);
  await expect(iconFor(page, key)).toBeVisible();
  await iconFor(page, key).click();
  await expect(card(page)).toBeVisible();
  return card(page);
}

test('a lookalike address gets a warning that names the brand, and the way out', async ({ page }) => {
  const c = await openCase(page, 'lookalike');
  await expect(c.locator('.warning')).toContainText('Suspicious destination');
  await expect(c.locator('.warning-detail')).toContainText("looks like PayPal's address, with letters swapped");
  await expect(c.getByRole('button', { name: "Don't warn me on this site" })).toBeVisible();
  await expect(c.locator('a.open')).toHaveText('Open link anyway');
});

test('link text that names another site is a mismatch warning', async ({ page }) => {
  const c = await openCase(page, 'mismatch');
  await expect(c.locator('.warning')).toContainText('Goes somewhere different from what it shows');
  await expect(c.locator('.warning-detail')).toContainText('The link says "Sign in to PayPal now" but goes to example-shop.example.');
});

test('a link shortener is "Not checked", with a button that asks where it goes', async ({ page }) => {
  const c = await openCase(page, 'shortener');
  await expect(c.locator('.warning')).toHaveCount(0);
  await expect(c.locator('.link-check-label')).toContainText('Link check: Not checked. This is a link shortener, so the real destination is hidden');
  await c.getByRole('button', { name: 'Check where this link goes' }).click();
  // No access to bit.ly, so LinkPeek says so instead of asking anyone.
  await expect(c.locator('.link-check')).toContainText('LinkPeek needs your permission to check where this link goes on bit.ly.');
});

test('an ordinary link says "No known warning", and that this is not a guarantee', async ({ page }) => {
  const c = await openCase(page, 'clean');
  await expect(c.locator('.warning')).toHaveCount(0);
  await expect(c.locator('.link-check-label')).toHaveText("Link check: No known warning. This isn't a guarantee of safety.");
  await expect(c).not.toContainText(/\bsafe\b/i);
});

test("\"Don't warn me on this site\" hides that site's warning, keeps the check, and can be undone in Settings", async ({ page, context, extensionId }) => {
  const c = await openCase(page, 'lookalike');
  await c.getByRole('button', { name: "Don't warn me on this site" }).click();
  await expect(c.locator('.warning')).toHaveCount(0);
  await expect(c.locator('.link-check')).toContainText('Warnings are off for links to paypa1.com.');

  // Closed and reopened: still no warning, and the setting is on the device.
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await iconFor(page, 'lookalike').click();
  await expect(card(page).locator('.warning')).toHaveCount(0);
  const stored = await inWorker(context, () => chrome.storage.local.get('settings'), undefined);
  expect((stored as { settings: { overruledWarnings: string[] } }).settings.overruledWarnings).toEqual(['paypa1.com']);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await options.getByRole('button', { name: 'Show warnings again: paypa1.com' }).click();
  await expect(options.locator('#overruled-list')).toContainText('None.');
  await page.keyboard.press('Escape');
  await iconFor(page, 'lookalike').click();
  await expect(card(page).locator('.warning')).toContainText('Suspicious destination');
});
