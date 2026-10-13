import type { Page } from '@playwright/test';
import { expect, test, TEST_SERVER } from './fixtures';

/** Every link marked data-expect="icon" has exactly one icon, and no other link has one. */
async function expectIconsExactlyOnExpected(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const problems: string[] = [];
        for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
          const icons = [];
          let next = a.nextElementSibling;
          while (next?.getAttribute('data-linkpeek') === 'icon') {
            icons.push(next);
            next = next.nextElementSibling;
          }
          const expected = a.dataset.expect === 'icon';
          if (expected && icons.length !== 1) problems.push(`missing: ${a.textContent}`);
          if (!expected && icons.length > 0) problems.push(`unexpected: ${a.textContent}`);
          if (icons.length > 1) problems.push(`duplicate: ${a.textContent}`);
        }
        return problems;
      }),
    )
    .toEqual([]);
}

for (const pageName of ['nav-heavy', 'blog']) {
  test(`${pageName}: icons only on the expected links`, async ({ page }) => {
    await page.goto(`${TEST_SERVER}/${pageName}.html`);
    await expect(page.locator('[data-linkpeek="icon"]').first()).toBeVisible();
    await expectIconsExactlyOnExpected(page);
  });
}

test('infinite feed: new items get icons as they load', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/infinite-feed.html`);
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(10);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(20);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(30);
  await expectIconsExactlyOnExpected(page);
});

test('single-page app: route changes, re-renders and changed links, with no duplicates', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/spa.html`);
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(3);

  await page.getByRole('button', { name: 'World' }).click();
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(2);
  await expectIconsExactlyOnExpected(page);

  await page.getByRole('button', { name: 'Front page' }).click();
  await page.getByRole('button', { name: 'Re-render same content' }).click();
  await page.getByRole('button', { name: 'Re-render same content' }).click();
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(3);
  await expectIconsExactlyOnExpected(page);

  await page.getByRole('button', { name: "Change first link's address" }).click();
  await expectIconsExactlyOnExpected(page);
  // The card for the changed link opens with its new address.
  await page.locator('#app a').first().locator('+ [data-linkpeek="icon"]').getByRole('button').click();
  await expect(page.locator('[data-linkpeek="card"] a.open')).toHaveAttribute('href', /updated-story-address/);
});

test('1,200 links: right icons, and the page stays responsive', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { longTasks: number[] }).longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { longTasks: number[] }).longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${TEST_SERVER}/many-links.html`);
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(200, { timeout: 15_000 });
  const elapsed = Date.now() - t0;
  const maxBatch = Number(await page.locator('html').getAttribute('data-linkpeek-max-batch-ms'));
  const longTasks = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks);
  console.log(`1,200 links: all icons in ${elapsed} ms, slowest LinkPeek batch ${maxBatch} ms, long tasks: ${JSON.stringify(longTasks.map(Math.round))}`);
  // A batch over 50 ms is a "long task" that can make the page feel sluggish.
  expect(maxBatch).toBeLessThan(50);
  await expectIconsExactlyOnExpected(page);
});
