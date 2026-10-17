/**
 * Part 08: "About this source", end to end in Chromium, against the local test
 * server (test-pages/source.html and the articles it links to).
 */
import type { Page } from '@playwright/test';
import { expect, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/source.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

async function openCase(page: Page, name: string) {
  await page.locator(`a[data-case="${name}"] + [data-linkpeek="icon"]`).getByRole('button').click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  return card(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('a[data-case="source"] + [data-linkpeek="icon"]')).toHaveCount(1);
});

test('"About this source" lists each fact with where it came from, and the note', async ({ page }) => {
  const c = await openCase(page, 'source');
  await expect(c.locator('.source')).toBeHidden();
  await c.locator('.source-toggle').click();
  await expect(c.locator('.source')).toContainText('This shows what the page discloses. It isn\'t a rating of accuracy.');
  await expect(c.locator('.source')).toContainText('Publisher');
  await expect(c.locator('.source')).toContainText('The Millbrook Gazette');
  await expect(c.locator('.source')).toContainText("(from the page's meta tags)");
  await expect(c.locator('.source')).toContainText('Priya Nair');
  await expect(c.locator('.source')).toContainText('News');
  await expect(c.locator('.source')).toContainText('1 link to a government site, 1 link to a PDF');
});

test('a sponsored guide says so, from its own label', async ({ page }) => {
  const c = await openCase(page, 'sponsored');
  await c.locator('.source-toggle').click();
  await expect(c.locator('.source')).toContainText('Sponsored content');
});

test('the corrections page check runs when asked, and finds the page at the usual address', async ({ page }) => {
  const c = await openCase(page, 'source');
  await c.locator('.source-toggle').click();
  await expect(c.locator('.corrections-status')).toHaveText('Not checked yet.');
  await c.locator('.corrections-look').click();
  await expect(c.locator('.corrections-status a')).toHaveAttribute('href', `${TEST_SERVER}/corrections`);
  await expect(c.locator('.corrections-status')).toContainText('Found:');
});
