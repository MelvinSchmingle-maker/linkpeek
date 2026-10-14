/** Regression tests for problems found in the Oct 2026 code review. */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, inWorker, setSettings, test, TEST_SERVER } from './fixtures';

const icons = (page: Page) => page.locator('[data-linkpeek="icon"]');
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

function sendToPage(context: BrowserContext, msg: unknown) {
  return inWorker(
    context,
    async (m) => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      return chrome.tabs.sendMessage(tab!.id!, m);
    },
    msg,
  );
}

/** Every link marked data-expect="icon" has exactly one icon right after it; no other icons anywhere. */
async function expectIconsExactlyOnExpected(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const problems: string[] = [];
        // Prototype methods: the hostile test page shadows document.querySelectorAll.
        const qsa = (sel: string) => [...Document.prototype.querySelectorAll.call(document, sel)];
        const hosts = qsa('[data-linkpeek="icon"]');
        for (const h of hosts) {
          const prev = h.previousElementSibling;
          if (!(prev instanceof HTMLAnchorElement) || prev.dataset.expect !== 'icon') problems.push(`stray icon after ${prev?.textContent}`);
        }
        for (const a of qsa('a[data-expect="icon"]') as HTMLAnchorElement[]) {
          if (a.nextElementSibling?.getAttribute('data-linkpeek') !== 'icon') problems.push(`missing: ${a.textContent}`);
        }
        return problems;
      }),
    )
    .toEqual([]);
}

test('icons use their own element names, so page frameworks cannot reuse them', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/news-front.html`);
  await expect(icons(page).first()).toBeVisible();
  expect(await icons(page).first().evaluate((e) => e.localName)).toBe('linkpeek-icon');
});

test('a hostile page’s !important CSS cannot hide or move the icon or the card', async ({ page }) => {
  // news-front.html sets opacity:0, top:-9999px and display:none !important on our elements.
  await page.goto(`${TEST_SERVER}/news-front.html`);
  const icon = page.locator('a[data-linkpeek-demo="full"] + [data-linkpeek="icon"]');
  await expect(icon).toBeVisible();
  expect(await icon.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  await icon.getByRole('button').click();
  await expect(card(page)).toBeVisible();
  const linkBox = (await page.locator('a[data-linkpeek-demo="full"]').boundingBox())!;
  const cardBox = (await card(page).boundingBox())!;
  expect(Math.abs(cardBox.y - (linkBox.y + linkBox.height))).toBeLessThan(20);
});

test('re-ordered list: each link keeps exactly one icon, right next to it', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/spa.html`);
  await expect(icons(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Reverse the order' }).click();
  await expectIconsExactlyOnExpected(page);
  await expect(icons(page)).toHaveCount(3);
});

test('a link swapped for a new element: new icon, no dead icon left behind', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/spa.html`);
  await expect(icons(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Replace the first link with a new element' }).click();
  await expectIconsExactlyOnExpected(page);
  await expect(icons(page)).toHaveCount(3);
});

test('a headline whose text arrives after the link is added still gets an icon', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/spa.html`);
  await expect(icons(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Add a headline that fills in later' }).click();
  await expect(icons(page)).toHaveCount(4);
  await expectIconsExactlyOnExpected(page);
});

test('SVG links are ignored safely (no broken icon, no broken "Open" link)', async ({ page, context }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await expect(icons(page).first()).toBeVisible();
  await expect(page.locator('svg [data-linkpeek]')).toHaveCount(0);
  await page.locator('svg a').focus();
  expect(await sendToPage(context, { type: 'peek-focused' })).toEqual({ ok: false });
});

test('Escape belongs to the page when the page has focus; focus moving to the page closes the card', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await page.locator('#top-link + [data-linkpeek="icon"]').getByRole('button').click();
  await expect(card(page)).toBeVisible();
  // The page moves focus to its own search box (as sites do for dialogs).
  await page.evaluate(() => document.getElementById('site-search')!.focus());
  await expect(card(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as unknown as { pageEscapes: number }).pageEscapes)).toBe(1);
  await expect(page.locator('#site-search')).toBeFocused();
});

test('Escape inside the card still closes it and returns focus', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  const button = page.locator('#top-link + [data-linkpeek="icon"]').getByRole('button');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { pageEscapes: number }).pageEscapes)).toBe(0);
});

test('the card closes when its link is hidden (a carousel moves on), instead of floating in a corner', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await page.locator('#slide-link + [data-linkpeek="icon"]').getByRole('button').click();
  await expect(card(page)).toBeVisible();
  await page.evaluate(() => document.getElementById('slide')!.classList.add('hidden'));
  await page.mouse.wheel(0, 40);
  await expect(card(page)).toHaveCount(0);
});

test('Manual: peeking the same link twice keeps one card and leaves no stray icon', async ({ page, context }) => {
  await page.goto(`${TEST_SERVER}/news-front.html`);
  await setSettings(context, { mode: 'manual' });
  await expect(icons(page)).toHaveCount(0);
  const link = page.locator('a[data-linkpeek-demo="clickbait"]');
  await link.focus();
  expect(await sendToPage(context, { type: 'peek-focused' })).toEqual({ ok: true });
  await link.focus();
  expect(await sendToPage(context, { type: 'peek-focused' })).toEqual({ ok: true });
  await expect(card(page)).toBeVisible();
  await expect(icons(page)).toHaveCount(1);
  await page.locator('[data-linkpeek="card"]').getByRole('button', { name: 'Close preview' }).click();
  await expect(icons(page)).toHaveCount(0);
});

test('right-click peek opens on the link that was right-clicked, even when the URL appears twice', async ({ page, context }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await setSettings(context, { mode: 'manual' });
  const bottom = page.locator('#bottom-link');
  await bottom.scrollIntoViewIfNeeded();
  await bottom.click({ button: 'right' });
  await page.keyboard.press('Escape'); // dismiss the browser's own menu, if shown
  const url = await bottom.evaluate((a) => (a as HTMLAnchorElement).href);
  expect(await sendToPage(context, { type: 'peek', url })).toEqual({ ok: true });
  await expect(page.locator('#bottom-link + [data-linkpeek="icon"]')).toHaveCount(1);
  const box = (await card(page).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(700);
});

test('peek by URL without a right-click prefers the copy that is on screen', async ({ page, context }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await setSettings(context, { mode: 'manual' });
  await page.locator('#bottom-link').scrollIntoViewIfNeeded();
  const url = await page.locator('#bottom-link').evaluate((a) => (a as HTMLAnchorElement).href);
  expect(await sendToPage(context, { type: 'peek', url })).toEqual({ ok: true });
  await expect(page.locator('#bottom-link + [data-linkpeek="icon"]')).toHaveCount(1);
  await expect(page.locator('#top-link + [data-linkpeek="icon"]')).toHaveCount(0);
});

test('a page element named __linkpeekLoaded cannot stop LinkPeek; leftover old icons are cleared', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/clobber.html`);
  await expect(icons(page)).toHaveCount(2);
  await expect(page.locator('.leftover')).toHaveCount(0);
  await expectIconsExactlyOnExpected(page);
});
