import type { Page } from '@playwright/test';
import { expect, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/news-front.html`;
const DEMO_KEYS = [
  'full',
  'clickbait',
  'partial',
  'insufficient',
  'headline-only',
  'inaccessible',
  'summary-failed',
  'link-warning',
  'unsupported',
  'loading',
] as const;

const iconFor = (page: Page, key: string) =>
  page.locator(`a[data-linkpeek-demo="${key}"] + [data-linkpeek="icon"]`).getByRole('button');
const card = (page: Page) => page.locator('[data-linkpeek="card"] .card');

async function open(page: Page) {
  await page.goto(PAGE);
  await expect(iconFor(page, 'full')).toBeVisible();
}

test('puts an icon on each demo link and the one real headline, nowhere else', async ({ page }) => {
  await open(page);
  // 10 demo links + 1 ordinary headline found by real detection.
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(DEMO_KEYS.length + 1);
  await expect(page.locator('nav [data-linkpeek="icon"], footer [data-linkpeek="icon"]')).toHaveCount(0);
});

test('a real (non-demo) link is actually read and summarised, never tagged as demo', async ({ page }) => {
  await open(page);
  await page.locator('a[href="/articles/ordinary.html"] + [data-linkpeek="icon"]').getByRole('button').click();
  await expect(card(page).locator('.summary-label')).toHaveText("In the article's own words:");
  await expect(card(page).locator('.summary')).toContainText("A review of Millbrook's library service");
  await expect(card(page)).not.toContainText('Demo data');
});

test('clicking the icon opens the card under the link; clicking again closes it', async ({ page }) => {
  await open(page);
  const icon = iconFor(page, 'full');
  await icon.click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText('Millbrook council approved');
  await expect(icon).toHaveAttribute('aria-expanded', 'true');

  const linkBox = (await page.locator('a[data-linkpeek-demo="full"]').boundingBox())!;
  const cardBox = (await card(page).boundingBox())!;
  expect(cardBox.y).toBeGreaterThanOrEqual(linkBox.y + linkBox.height);
  expect(cardBox.y - (linkBox.y + linkBox.height)).toBeLessThan(20);

  await icon.click();
  await expect(card(page)).toHaveCount(0);
  await expect(icon).toHaveAttribute('aria-expanded', 'false');
});

test('opening the card does not move page content', async ({ page }) => {
  await open(page);
  const before = await page.locator('a[data-linkpeek-demo="partial"]').boundingBox();
  await iconFor(page, 'full').click();
  await expect(card(page)).toBeVisible();
  expect(await page.locator('a[data-linkpeek-demo="partial"]').boundingBox()).toEqual(before);
});

test('keyboard: Enter opens, focus moves into the card, Escape closes and returns focus', async ({ page }) => {
  await open(page);
  const icon = iconFor(page, 'full');
  await icon.focus();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-linkpeek="card"]').getByRole('button', { name: 'Close preview' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(icon).toBeFocused();
});

test('the close button closes and returns focus', async ({ page }) => {
  await open(page);
  await iconFor(page, 'clickbait').click();
  await page.locator('[data-linkpeek="card"]').getByRole('button', { name: 'Close preview' }).click();
  await expect(card(page)).toHaveCount(0);
  await expect(iconFor(page, 'clickbait')).toBeFocused();
});

test('clicking elsewhere on the page closes the card', async ({ page }) => {
  await open(page);
  await iconFor(page, 'full').click();
  await expect(card(page)).toBeVisible();
  await page.locator('aside p').first().click();
  await expect(card(page)).toHaveCount(0);
});

test('the icon does not trigger the page’s own click handlers', async ({ page }) => {
  await open(page);
  await iconFor(page, 'headline-only').click();
  await expect(card(page)).toBeVisible();
  expect(page.url()).toBe(PAGE);
});

test('page CSS cannot restyle LinkPeek', async ({ page }) => {
  await open(page);
  // The test page sets `button { background: yellow !important }` and `span { display: block }`.
  const bg = await iconFor(page, 'full').evaluate((b) => getComputedStyle(b).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 0)');
  const hostDisplay = await page
    .locator('a[data-linkpeek-demo="full"] + [data-linkpeek="icon"]')
    .evaluate((h) => getComputedStyle(h).display);
  expect(hostDisplay).toBe('inline-block');
});

const expected: Record<(typeof DEMO_KEYS)[number], RegExp> = {
  full: /Headline check passed[\s\S]*Millbrook council approved/,
  clickbait: /Possible clickbait[\s\S]*withholds the main event/,
  partial: /Preview only[\s\S]*Full article unavailable\. Showing a preview/,
  // A full article with no verdict: the label only, no extra reason (LinkPeek did read it).
  insufficient: /^No headline verdict/,
  'headline-only': /Headline only[\s\S]*Only the headline was available/,
  inaccessible: /Couldn't open this article\. The site asks you to log in\./,
  'summary-failed': /Couldn't write a summary for this article/,
  'link-warning': /Goes somewhere different from what it shows[\s\S]*millbrook-gov-refunds\.example[\s\S]*Open link anyway/,
  unsupported: /can't preview this type of link yet/,
  loading: /Reading the article\.\.\./,
};

for (const key of DEMO_KEYS) {
  test(`state: ${key}`, async ({ page }) => {
    await open(page);
    await iconFor(page, key).click();
    await expect(card(page)).toContainText(expected[key]);
    await expect(card(page)).toContainText('Demo data');
  });
}

test('feedback is saved on the device and acknowledged', async ({ page, context }) => {
  await open(page);
  await iconFor(page, 'full').click();
  await page.locator('[data-linkpeek="card"]').getByRole('button', { name: 'Yes, useful' }).click();
  await expect(card(page)).toContainText('Thanks for the feedback.');

  const [worker] = context.serviceWorkers();
  const stored = await worker!.evaluate(() => chrome.storage.local.get('feedback'));
  expect(stored.feedback).toEqual([
    expect.objectContaining({ resultId: 'demo-full', value: 'up', hostname: '127.0.0.1', isDemo: true }),
  ]);
  // Hostname only, never the full URL.
  expect(JSON.stringify(stored)).not.toContain('/articles/');
});

test('turning demo results off in settings removes the demo icons', async ({ page, context, extensionId }) => {
  await open(page);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await options.getByLabel(/Show demo results/).uncheck();
  // Demo links are now judged like any other link: headlines keep an icon
  // (the .zip download doesn't), and their cards are real, not demo.
  await expect(page.locator('a[data-linkpeek-demo="unsupported"] + [data-linkpeek="icon"]')).toHaveCount(0);
  await iconFor(page, 'full').click();
  await expect(card(page)).toContainText('Millbrook council has approved two kilometres');
  await expect(card(page)).not.toContainText('Demo data');
  await page.keyboard.press('Escape');
  await options.getByLabel(/Show demo results/).check();
  await expect(page.locator('[data-linkpeek="icon"]')).toHaveCount(DEMO_KEYS.length + 1);
});

// Browser zoom changes the CSS viewport size, so a small viewport ≈ zoomed
// in (200%) and a large one ≈ zoomed out (50%).
for (const [label, size] of [
  ['about 200% zoom', { width: 640, height: 400 }],
  ['about 50% zoom', { width: 2560, height: 1440 }],
  ['phone width', { width: 360, height: 640 }],
] as const) {
  test(`card stays on screen and near its link at ${label}`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page);
    const link = page.locator('a[data-linkpeek-demo="full"]');
    await iconFor(page, 'full').click();
    const box = (await card(page).boundingBox())!;
    const linkBox = (await link.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    // Below the link, or above it when there's no room below. Never on top of it.
    const below = box.y >= linkBox.y + linkBox.height;
    const above = box.y + box.height <= linkBox.y;
    expect(below || above).toBe(true);
  });
}

test('the card follows its link when the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 });
  await open(page);
  const link = page.locator('a[data-linkpeek-demo="partial"]');
  await iconFor(page, 'partial').click();
  const offset = async () => {
    const c = (await card(page).boundingBox())!;
    const l = (await link.boundingBox())!;
    return Math.round(c.y - l.y);
  };
  const before = await offset();
  const linkYBefore = (await link.boundingBox())!.y;
  await page.mouse.wheel(0, 60);
  await expect.poll(async () => (await link.boundingBox())!.y).toBeLessThan(linkYBefore);
  await expect.poll(offset).toBe(before);
});
