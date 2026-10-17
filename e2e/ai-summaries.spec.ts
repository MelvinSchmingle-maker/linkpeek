/**
 * Part 06: AI summaries through LinkPeek's backend. Test builds point at a
 * stand-in backend on the local test server (scripts/serve-test-pages.mjs),
 * so no test reaches the real backend or an AI, and none costs money.
 */
import type { Page } from '@playwright/test';
import { expect, setSettings, test, TEST_SERVER } from './fixtures';

const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

async function openCase(page: Page, name: string) {
  await page.locator(`a[data-case="${name}"] + [data-linkpeek="icon"]`).getByRole('button').click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText('Reading the article...', { timeout: 15_000 });
  return card(page);
}

const sent = async (page: Page) => (await (await page.request.get(`${TEST_SERVER}/api/summarise/sent`)).json()) as Record<string, unknown>[];

test.beforeEach(async ({ page, context }) => {
  await page.request.get(`${TEST_SERVER}/hits/reset`);
  await setSettings(context, { summaryEngine: 'remote' });
  await page.goto(`${TEST_SERVER}/retrieval.html`);
  await expect(page.locator('a[data-case="full"] + [data-linkpeek="icon"]')).toHaveCount(1);
});

test('with AI summaries on, the card shows the AI summary and says who wrote it', async ({ page }) => {
  const c = await openCase(page, 'full');
  await expect(c.locator('.summary-label')).toHaveText('Summary by AI (Claude):');
  await expect(c.locator('.summary')).toHaveText('Councillors approved protected cycle lanes on High Street by seven votes to five.');
});

test('what is sent: article text, link text and a random install ID, never the page address or cookies', async ({ page }) => {
  await openCase(page, 'full');
  const [body] = await sent(page);
  expect(Object.keys(body!).sort()).toEqual(['evidence', 'headline', 'installId', 'language', 'task', 'text']);
  expect(body!.installId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  expect(JSON.stringify(body)).not.toMatch(/127\.0\.0\.1|cycle-lanes\.html|retrieval\.html/);
});

test('an over-long AI summary is shortened once, never shown over 20 words', async ({ page }) => {
  const c = await openCase(page, 'full-blog');
  await expect(c.locator('.summary')).toHaveText('A balcony gardener shares three summers of lessons from growing tomatoes.');
  expect((await sent(page)).map((b) => b.task)).toEqual(['summarise', 'shorten']);
});

test('backend down: the card falls back to the free summary', async ({ page }) => {
  const c = await openCase(page, 'full-divs');
  await expect(c.locator('.summary-label')).toHaveText("In the article's own words:");
  await expect(c.locator('.summary')).toHaveText("A review of Millbrook's library service has recommended longer opening hours at weekends.");
});

test('a paywalled page is never sent to the AI', async ({ page }) => {
  await openCase(page, 'paywall');
  expect(await sent(page)).toEqual([]);
});

test('switching AI summaries off stops sending and deletes the install ID', async ({ page, context }) => {
  await openCase(page, 'full');
  expect(await sent(page)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await setSettings(context, { summaryEngine: 'extractive' });
  await expect
    .poll(async () => {
      const [w] = context.serviceWorkers();
      return w!.evaluate(async () => (await chrome.storage.local.get('installId')).installId ?? null);
    })
    .toBeNull();
  const c = await openCase(page, 'full');
  await expect(c.locator('.summary-label')).toHaveText("In the article's own words:");
  expect(await sent(page)).toHaveLength(1);
});

test('Settings: three choices, the AI one says what it sends', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  await expect(page.locator('input[name="engine"][value="remote"]')).toBeChecked();
  await expect(page.locator('#remote-option')).toContainText("Not the page's address, your cookies or anything about you.");
  await page.locator('input[name="engine"][value="extractive"]').check();
  await expect
    .poll(async () => {
      const [w] = context.serviceWorkers();
      return w!.evaluate(async () => ((await chrome.storage.local.get('settings')).settings as { summaryEngine?: string }).summaryEngine);
    })
    .toBe('extractive');
});
