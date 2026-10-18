/**
 * Saves a screenshot of every card state, light and dark, into
 * docs/screenshots/part-02/. Skipped in normal test runs.
 * Run with: npm run screenshots
 */
import { expect, linkPeekWorker, test, TEST_SERVER } from './fixtures';

const KEYS = ['full', 'clickbait', 'partial', 'insufficient', 'headline-only', 'inaccessible', 'summary-failed', 'link-warning', 'unsupported', 'loading'];

test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture screenshots');

for (const scheme of ['light', 'dark'] as const) {
  test(`screenshots (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`${TEST_SERVER}/news-front.html`);
    const dir = 'docs/screenshots/part-02';

    await page.locator('a[data-linkpeek-demo="full"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/idle-${scheme}.png`, clip: { x: 0, y: 0, width: 1100, height: 330 } });

    for (const key of KEYS) {
      const link = page.locator(`a[data-linkpeek-demo="${key}"]`);
      await link.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -60));
      await page.locator(`a[data-linkpeek-demo="${key}"] + [data-linkpeek="icon"]`).getByRole('button').click();
      const card = page.locator('[data-linkpeek="card"] .card');
      await expect(card).toBeVisible();
      const l = (await link.boundingBox())!;
      const c = (await card.boundingBox())!;
      const x = Math.max(0, Math.min(l.x, c.x) - 16);
      const y = Math.max(0, Math.min(l.y, c.y) - 16);
      await page.screenshot({
        path: `${dir}/${key}-${scheme}.png`,
        clip: { x, y, width: Math.max(l.x + l.width, c.x + c.width) - x + 16, height: Math.max(l.y + l.height, c.y + c.height) - y + 16 },
      });
      await page.keyboard.press('Escape');
    }

    // Feedback received.
    await page.locator('a[data-linkpeek-demo="full"] + [data-linkpeek="icon"]').getByRole('button').click();
    await page.locator('[data-linkpeek="card"]').getByRole('button', { name: 'Yes, useful' }).click();
    const card = page.locator('[data-linkpeek="card"] .card');
    await expect(card).toContainText('Thanks');
    const c = (await card.boundingBox())!;
    await page.screenshot({ path: `${dir}/feedback-received-${scheme}.png`, clip: { x: c.x - 16, y: c.y - 16, width: c.width + 32, height: c.height + 32 } });
  });
}

test('screenshots: popup and settings (Part 03)', async ({ page, context, extensionId }) => {
  const dir = 'docs/screenshots/part-03';
  await page.goto(`${TEST_SERVER}/news-front.html`);
  const worker = await linkPeekWorker(context);
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0]!.id);
  for (const scheme of ['light', 'dark'] as const) {
    const popup = await context.newPage();
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.setViewportSize({ width: 340, height: 600 });
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
    await expect(popup.locator('#site-name')).toHaveText('127.0.0.1');
    await popup.getByRole('button', { name: 'Scan this page' }).click();
    await expect(popup.getByText(/Found/)).toBeVisible();
    await popup.screenshot({ path: `${dir}/popup-${scheme}.png`, fullPage: true });
    await popup.close();
  }
  const options = await context.newPage();
  await options.setViewportSize({ width: 900, height: 900 });
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await expect(options.getByText('Sites you turned on')).toBeVisible();
  await options.screenshot({ path: `${dir}/settings-light.png`, fullPage: true });
});
