/**
 * Story Search in a real Chromium, with the test build. Its server is a
 * stand-in on the local test server (scripts/serve-test-pages.mjs): it never
 * searches the web or calls an AI, and no test costs money.
 *
 * The right-click menu itself can't be clicked by Playwright, so the tests
 * send the content script the same message the menu sends ({ type: 'story' }),
 * as the right-click peek tests do.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, inWorker, setSettings, test, TEST_SERVER } from './fixtures';

const PAGE = `${TEST_SERVER}/story.html`;
const HEADLINE_LINK = `${TEST_SERVER}/2026/11/25/ferry-strike-called-off-after-late-night-talks?utm_source=home&session=abc123`;
const storyCard = (page: Page) => page.locator('[data-linkpeek="card"] .card.story');
const sent = async (page: Page) => (await (await page.request.get(`${TEST_SERVER}/api/story/sent`)).json()) as Record<string, unknown>[];

/** What the right-click menu item does: message the content script in the tab. */
function story(context: BrowserContext, url: string, selection?: string) {
  return inWorker(
    context,
    async ({ u, s }) => {
      const [tab] = await chrome.tabs.query({ url: ['http://127.0.0.1/*'] });
      await chrome.scripting.executeScript({ target: { tabId: tab!.id!, frameIds: [0] }, files: ['content.js'] });
      return chrome.tabs.sendMessage(tab!.id!, { type: 'story', url: u, ...(s ? { selection: s } : {}) }, { frameId: 0 });
    },
    { u: url, s: selection },
  );
}

async function agreeOnce(context: BrowserContext) {
  await inWorker(context, () => chrome.storage.local.set({ storySearchConsent: true }), undefined);
}

test.beforeEach(async ({ page }) => {
  await page.request.get(`${TEST_SERVER}/hits/reset`);
  await page.goto(PAGE);
});

test('the first Story Search shows exactly what will be sent, and sends nothing until Search is pressed', async ({ page, context }) => {
  expect(await story(context, HEADLINE_LINK)).toEqual({ ok: true });
  const card = storyCard(page);
  await expect(card).toBeVisible();
  const preview = card.locator('.story-preview');
  await expect(preview).toContainText('Ferry strike called off after late-night talks');
  await expect(preview).toContainText('from the link');
  // The address without its query string.
  await expect(preview).toContainText('http://127.0.0.1:4173/2026/11/25/ferry-strike-called-off-after-late-night-talks');
  await expect(preview).not.toContainText('session=abc123');
  await expect(card).toContainText("Not sent: this page's address, your cookies, or anything you've typed.");
  await page.waitForTimeout(400);
  expect(await sent(page)).toEqual([]);

  await card.getByRole('button', { name: 'Search' }).click();
  await expect(card.locator('.story-stages')).toBeVisible();
  await expect(card.getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  expect(await sent(page)).toHaveLength(1);
});

test('the report: stages, then every section with sources, and the link is never opened', async ({ page, context }) => {
  await agreeOnce(context);
  await page.locator('#typed').fill('my-private-typed-text');
  const pagesBefore = context.pages().length;
  await story(context, HEADLINE_LINK);
  const card = storyCard(page);
  // The stages show while the stand-in works.
  await expect(card.locator('.stage.active')).toContainText(/Searching for matching stories|Analysing relevant sources/);
  await expect(card.getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  await expect(card.locator('.story-tag')).toHaveText(['Strong match', 'Strong evidence']);
  for (const h of ['Key details', 'What is confirmed?', 'Reported by one source', 'What remains unclear?', 'Supporting sources']) {
    await expect(card.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(card.locator('.what-happened .ref')).toHaveText(['[1]', '[2]']);
  const sources = card.locator('.story-source-link');
  await expect(sources).toHaveCount(2);
  await expect(sources.first()).toHaveAttribute('target', '_blank');
  await expect(sources.first()).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(card).toContainText('Searched for: “Ferry strike called off after late-night talks”');
  await expect(card).toContainText('2 search results set aside as not about this story.');
  await expect(card.locator('.open')).toHaveText('Open link');

  // Nothing opened by itself.
  expect(page.url()).toBe(PAGE);
  expect(context.pages()).toHaveLength(pagesBefore);

  // What was sent: the link's clues and a random ID. Never the page address, the query string or typed text.
  const [body] = await sent(page);
  expect(body!.url).toBe('http://127.0.0.1:4173/2026/11/25/ferry-strike-called-off-after-late-night-talks');
  expect(body!.headline).toEqual({ text: 'Ferry strike called off after late-night talks', from: 'link-text', confidence: 'high' });
  expect(body!.installId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  const raw = JSON.stringify(body);
  for (const secret of ['story.html', 'session=abc123', 'utm_source', 'my-private-typed-text']) expect(raw).not.toContain(secret);
});

test('asking about the same link again uses the report kept on this computer', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK);
  await expect(storyCard(page).getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  await storyCard(page).getByRole('button', { name: 'Close preview' }).click();
  await story(context, HEADLINE_LINK);
  await expect(storyCard(page).getByRole('heading', { name: 'What happened?' })).toBeVisible();
  expect(await sent(page)).toHaveLength(1);
});

test('"Read more" in an article card searches with the card\'s headline', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, `${TEST_SERVER}/p/889123`);
  const card = storyCard(page);
  // The stand-in answers "no match" for this one: no report sections, and it says why.
  await expect(card).toContainText("The search found results, but none clearly about this story. LinkPeek won't guess.", { timeout: 10_000 });
  await expect(card.getByRole('heading', { name: 'What happened?' })).toHaveCount(0);
  await expect(card.locator('.story-tag')).toHaveText(['No reliable match']);
  await expect(card).toContainText('Some results were about an earlier story with similar wording.');
  const [body] = await sent(page);
  expect(body!.headline).toMatchObject({ text: 'Unknown harbour wall story from long ago', from: 'card-heading' });
  expect(JSON.stringify(body)).not.toContain('Read more');
});

test('a link with almost nothing to go on sends nothing, and says why', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, 'https://example.com/p/12345');
  await expect(storyCard(page)).toContainText("There isn't enough information about this link to search for it.");
  await page.waitForTimeout(400);
  expect(await sent(page)).toEqual([]);
});

test('a search failure is shown as a failure, and Try again really tries again', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, `${TEST_SERVER}/2026/11/25/search-broken-story-about-the-pier`);
  const card = storyCard(page);
  await expect(card).toContainText("The search service didn't answer. Try again in a minute.", { timeout: 10_000 });
  await expect(card.getByRole('heading', { name: 'What happened?' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Try again' }).click();
  await expect(card).toContainText("The search service didn't answer.", { timeout: 10_000 });
  expect(await sent(page)).toHaveLength(2);
});

test('a report on possible matches says so before anything else', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, `${TEST_SERVER}/2026/11/24/possible-bridge-closure-for-repairs`);
  const card = storyCard(page);
  await expect(card.locator('.story-caution')).toHaveText('These sources may be about a different story. Check them before relying on this.', { timeout: 10_000 });
  await expect(card.locator('.story-tag').first()).toHaveText('Possible match');
  await expect(card).toContainText('Only one independent source was found.');
});

test('"Not now" closes the card and sends nothing', async ({ page, context }) => {
  await story(context, HEADLINE_LINK);
  await storyCard(page).getByRole('button', { name: 'Not now' }).click();
  await expect(storyCard(page)).toHaveCount(0);
  expect(await sent(page)).toEqual([]);
});

test('text the user selected is sent only when they had selected it', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK, 'The union said members would vote on the offer next week.');
  await expect(storyCard(page).getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  const [body] = await sent(page);
  expect(body!.selection).toBe('The union said members would vote on the offer next week.');
});

test('with Story Search switched off in Settings, it says it is off and sends nothing', async ({ page, context }) => {
  await agreeOnce(context);
  await setSettings(context, { storySearch: false });
  await page.reload();
  await story(context, HEADLINE_LINK);
  await expect(storyCard(page)).toContainText("Story Search isn't set up in this version of LinkPeek.", { timeout: 10_000 });
  expect(await sent(page)).toEqual([]);
});

test('the ordinary preview card is unchanged next to Story Search', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK);
  await expect(storyCard(page).getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  await storyCard(page).getByRole('button', { name: 'Close preview' }).click();
  const icon = page.locator('a[data-case="headline"] + [data-linkpeek="icon"]').getByRole('button');
  await icon.click();
  const preview = page.locator('[data-linkpeek="card"] .card:not(.story)');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('aria-label', 'LinkPeek preview');
});
