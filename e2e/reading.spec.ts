/**
 * Part 12: reading mode, in Chromium (test-pages/reading.html). "Read here"
 * shows a full article's own text in LinkPeek's panel. A paywalled page or a
 * short item never gets the button, and nothing is kept after the panel closes.
 */
import type { Page } from '@playwright/test';
import { DEFAULT_ANNOYANCE } from '../src/core/storage/settings';
import { expect, setSettings, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/reading.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');
const icon = (page: Page, key: string) => page.locator(`a[data-case="${key}"] + [data-linkpeek="icon"]`).getByRole('button');

async function openCard(page: Page, key: string) {
  await page.goto(PAGE);
  await expect(icon(page, key)).toBeVisible();
  await icon(page, key).click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  return card(page);
}

test('with reading mode on, "Read here" shows the article in a panel, and Escape closes it', async ({ page, context }) => {
  await setSettings(context, { annoyance: { ...DEFAULT_ANNOYANCE, readingMode: true } });
  const c = await openCard(page, 'full');
  await c.getByRole('button', { name: 'Read here' }).click();
  const panel = page.locator('[data-linkpeek="reader"] [role="dialog"][aria-label="Reading mode"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Millbrook council has approved two kilometres');
  await expect(panel).toContainText('Open the original article');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('with reading mode off (the default), there is no "Read here" button', async ({ page }) => {
  const c = await openCard(page, 'full');
  await expect(c.getByRole('button', { name: 'Read here' })).toHaveCount(0);
});

test('a paywalled page never gets "Read here", even with reading mode on', async ({ page, context }) => {
  await setSettings(context, { annoyance: { ...DEFAULT_ANNOYANCE, readingMode: true } });
  const c = await openCard(page, 'paywall');
  await expect(c.getByRole('button', { name: 'Read here' })).toHaveCount(0);
});

test('a short item (a preview, not the full article) gets no "Read here" either', async ({ page, context }) => {
  await setSettings(context, { annoyance: { ...DEFAULT_ANNOYANCE, readingMode: true } });
  const c = await openCard(page, 'short');
  await expect(c.getByRole('button', { name: 'Read here' })).toHaveCount(0);
});
