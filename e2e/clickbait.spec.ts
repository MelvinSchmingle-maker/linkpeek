/**
 * Part 07: the headline check, end to end in Chromium, against the local test
 * server (test-pages/clickbait.html and the articles it links to).
 */
import type { Page } from '@playwright/test';
import { expect, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/clickbait.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

async function openCase(page: Page, name: string) {
  await page.locator(`a[data-case="${name}"] + [data-linkpeek="icon"]`).getByRole('button').click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  return card(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('a[data-case="withheld"] + [data-linkpeek="icon"]')).toHaveCount(1);
});

test('a headline that holds back its point is a cross, and the reason says so', async ({ page }) => {
  const c = await openCase(page, 'withheld');
  await expect(c.locator('[data-status="fail"]')).toHaveText('Possible clickbait');
  await expect(c.locator('.reason')).toHaveText('The headline holds back its main point to make you click.');
});

test('an overstated headline is crossed against the article: the study says "in mice" and "preliminary"', async ({ page }) => {
  const c = await openCase(page, 'overstated');
  await expect(c.locator('[data-status="fail"]')).toHaveText('Possible clickbait');
  await expect(c.locator('.reason')).toHaveText('The headline says "cures", but the article describes a study in animals.');
});

test('a plain headline is not a cross, and gets no rewrite', async ({ page }) => {
  const c = await openCase(page, 'plain');
  await expect(c.locator('[data-status="fail"]')).toHaveCount(0);
  await expect(c.locator('[data-status="unknown"]')).toHaveText('No headline verdict');
  await expect(c.locator('.rewrite')).toHaveCount(0);
});

test('"What does this mean?" explains the three outcomes, and stays shut until asked', async ({ page }) => {
  const c = await openCase(page, 'withheld');
  const toggle = c.locator('.definitions-toggle');
  await expect(c.locator('.definitions')).toBeHidden();
  await toggle.click();
  await expect(c.locator('.definitions')).toBeVisible();
  await expect(c.locator('.definitions')).toContainText("It doesn't mean the story is false.");
  await toggle.click();
  await expect(c.locator('.definitions')).toBeHidden();
});
