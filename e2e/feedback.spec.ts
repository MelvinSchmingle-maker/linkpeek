/**
 * Part 09: feedback, end to end in Chromium. Thumbs down, then a reason (or
 * skip); the headline "Disagree" control; the options page's counts, export
 * and two-press delete. Uses the demo cards and the clickbait test page.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, inWorker, test, TEST_SERVER } from './fixtures';

const NEWS = `${TEST_SERVER}/news-front.html`;
const CLICKBAIT = `${TEST_SERVER}/clickbait.html`;
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');
const iconFor = (page: Page, key: string) =>
  page.locator(`a[data-linkpeek-demo="${key}"] + [data-linkpeek="icon"]`).getByRole('button');

async function openDemo(page: Page, key: string) {
  await page.goto(NEWS);
  await expect(iconFor(page, key)).toBeVisible();
  await iconFor(page, key).click();
  await expect(card(page)).toBeVisible();
}

interface StoredEntry {
  resultId: string;
  signal: string;
  value: string;
  reason?: string;
  verdict?: string;
}

async function storedFeedback(context: import('@playwright/test').BrowserContext): Promise<StoredEntry[]> {
  const stored = await inWorker(context, () => chrome.storage.local.get('feedback'), undefined);
  return (stored as { feedback?: StoredEntry[] }).feedback ?? [];
}

test('thumbs down, then a reason: the reason is saved with the vote', async ({ page, context }) => {
  await openDemo(page, 'full');
  await card(page).getByRole('button', { name: 'No, not useful' }).click();
  // The reasons appear straight after the vote, and the card keeps focus.
  const reasons = card(page).getByRole('group', { name: 'What was wrong? (optional)' });
  await expect(reasons).toBeVisible();
  await reasons.getByRole('button', { name: 'Too vague' }).click();
  await expect(card(page)).toContainText('Thanks for the feedback.');
  await expect(reasons).toHaveCount(0);

  const [entry] = await storedFeedback(context);
  if (!entry) throw new Error('no vote was stored');
  expect(entry).toMatchObject({ resultId: 'demo-full', signal: 'summary-usefulness', value: 'down', reason: 'too-vague' });
});

test('thumbs down, then skip: the vote is kept with no reason', async ({ page, context }) => {
  await openDemo(page, 'full');
  await card(page).getByRole('button', { name: 'No, not useful' }).click();
  await card(page).getByRole('button', { name: 'Skip' }).click();
  await expect(card(page)).toContainText('Thanks for the feedback.');
  const [entry] = await storedFeedback(context);
  if (!entry) throw new Error('no vote was stored');
  expect(entry.value).toBe('down');
  expect(entry.reason).toBeUndefined();
});

test('the reasons work from the keyboard alone', async ({ page, context }) => {
  await openDemo(page, 'full');
  await card(page).getByRole('button', { name: 'No, not useful' }).focus();
  await page.keyboard.press('Enter');
  // Focus moves to the first reason on its own: "Missed the main point".
  await expect(card(page).getByRole('button', { name: 'Missed the main point' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card(page)).toContainText('Thanks for the feedback.');
  const [entry] = await storedFeedback(context);
  if (!entry) throw new Error('no vote was stored');
  expect(entry.reason).toBe('missed-main-point');
});

test('a double press on thumbs up is one vote', async ({ page, context }) => {
  await openDemo(page, 'full');
  const up = card(page).getByRole('button', { name: 'Yes, useful' });
  await up.dblclick();
  await expect(card(page)).toContainText('Thanks for the feedback.');
  const stored = await storedFeedback(context);
  expect(stored.filter((e) => e.resultId === 'demo-full')).toHaveLength(1);
});

test('"Disagree with this rating?" is saved as its own signal, not as a summary vote', async ({ page, context }) => {
  await page.goto(CLICKBAIT);
  await page.locator('a[data-case="withheld"] + [data-linkpeek="icon"]').getByRole('button').click();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  // The control sits in the "What does this mean?" panel, so the card keeps its height.
  await card(page).getByRole('button', { name: 'What does this mean?' }).click();
  await card(page).getByRole('button', { name: 'Disagree with this rating?' }).click();
  await expect(card(page)).toContainText('Thanks. Noted on this device only.');
  const stored = await storedFeedback(context);
  expect(stored).toEqual([expect.objectContaining({ signal: 'clickbait', value: 'disagree', verdict: 'fail' })]);
});

test('the options page counts votes, exports them as a file, and deletes them in two presses', async ({ page, context, extensionId }) => {
  await openDemo(page, 'full');
  await card(page).getByRole('button', { name: 'No, not useful' }).click();
  await card(page).getByRole('button', { name: 'Too vague' }).click();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  const counts = options.locator('#feedback-counts');
  await expect(counts).toContainText('Summaries: 0 thumbs up, 1 thumbs down.');
  await expect(counts).toContainText('Too vague: 1');

  const download = options.waitForEvent('download');
  await options.getByRole('button', { name: 'Export feedback as a file' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('linkpeek-feedback.json');
  const text = readFileSync(await file.path(), 'utf8');
  const parsed = JSON.parse(text);
  expect(parsed.feedback).toHaveLength(1);
  expect(parsed.feedback[0]).toMatchObject({ hostname: '127.0.0.1', reason: 'too-vague', value: 'down' });
  expect(text).not.toContain('/news-front');

  // Delete is two presses: the first only asks.
  const del = options.getByRole('button', { name: 'Delete all feedback' });
  await del.click();
  await expect(options.locator('#feedback-status')).toContainText('Nothing is deleted until you press it a second time.');
  expect(await storedFeedback(context)).toHaveLength(1);
  await options.getByRole('button', { name: 'Press again to delete every vote' }).click();
  await expect(options.locator('#feedback-status')).toContainText('All feedback deleted.');
  expect(await storedFeedback(context)).toHaveLength(0);
  await expect(counts).toContainText('Summaries: 0 thumbs up, 0 thumbs down.');
});
