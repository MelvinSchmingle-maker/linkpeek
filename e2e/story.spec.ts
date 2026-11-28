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
  for (const h of ['Key details', 'What is confirmed?', 'Reported, not confirmed', 'What remains unclear?', 'Supporting sources']) {
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

test('each claim’s evidence is behind a closed “Show evidence”; opening it shows the quoted passages', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK);
  const card = storyCard(page);
  await expect(card.getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  const first = card.locator('.what-happened .story-evidence').first();
  // Closed by default: the passages are there but not shown, so the card stays short.
  await expect(first).not.toHaveAttribute('open', /.*/);
  await expect(first.getByText('Harbour Ferries workers will not strike on 1 December, the union said.')).toBeHidden();
  await first.getByText('Show evidence').click();
  await expect(first).toHaveAttribute('open', /.*/);
  await expect(first.getByText('Harbour Ferries workers will not strike on 1 December, the union said.')).toBeVisible();
  await expect(first).toContainText('[1]');
  await expect(first).toContainText('[2]');
  // A weak claim says so inside its evidence; nothing shows until it's opened.
  const weak = card.locator('.story-evidence').filter({ hasText: 'a pay offer the union described as fair' });
  await weak.getByText('Show evidence').click();
  await expect(weak).toContainText("The quoted passages don't show all of this. Check the source.");
  // Opening evidence never opens the link.
  expect(page.url()).toBe(PAGE);
});

test('the headline verdict: what the reporting says about the headline, with its evidence', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK);
  const card = storyCard(page);
  await expect(card.getByRole('heading', { name: 'Is the headline accurate?' })).toBeVisible({ timeout: 10_000 });
  const section = card.locator('.story-headline-check');
  await expect(section).toContainText('Accurate');
  await expect(section).toContainText('Both reports say the strike was called off after talks.');
  await expect(section.locator('.story-evidence')).not.toHaveAttribute('open', /.*/);
  // Sources say when they were updated or corrected.
  await expect(card.locator('.story-source').nth(1)).toContainText('Corrected by its publisher');
  await expect(card.locator('.story-source').nth(1)).toContainText('updated');
});

test('the sources say how many independent reports there are, what LinkPeek read, and whether the linked article was found', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, HEADLINE_LINK);
  const card = storyCard(page);
  await expect(card.getByRole('heading', { name: 'Supporting sources' })).toBeVisible({ timeout: 10_000 });
  const summary = card.locator('.story-sources-summary');
  await expect(summary).toContainText('2 sources: 2 news organisations.');
  await expect(summary).toContainText('LinkPeek read the full text of 1 and a short excerpt of 1.');
  await expect(summary).toContainText("The linked article itself wasn't among the results");
  await expect(card.locator('.story-source').nth(0)).toContainText('Full text');
  await expect(card.locator('.story-source').nth(1)).toContainText('Short excerpt');
  // A weak claim is tagged where it can be seen.
  await expect(card.locator('.reported .story-weak-tag')).toHaveText('Weak evidence');
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

test('when the free searches are used up, it says so plainly and offers no pointless retry', async ({ page, context }) => {
  await agreeOnce(context);
  await story(context, `${TEST_SERVER}/2026/11/25/free-searches-used-up-story-about-the-harbour`);
  const card = storyCard(page);
  await expect(card).toContainText("Story Search has used this month's free searches. It works again when they renew at the start of next month.", { timeout: 10_000 });
  await expect(card.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(card.getByRole('heading', { name: 'What happened?' })).toHaveCount(0);
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

// ---------- Every state the card can be in (Part 7 of the evaluation brief) ----------

/** These links sit lower on the page: like a person, look at the link before right-clicking it. */
async function storyFor(page: Page, context: BrowserContext, which: string, url: string) {
  await page.locator(`a[data-case="${which}"]`).scrollIntoViewIfNeeded();
  return story(context, url);
}

test('a vague link: possible matches only, nobody named as the subject, and the reason first', async ({ page, context }) => {
  await agreeOnce(context);
  const pagesBefore = context.pages().length;
  await storyFor(page, context, 'vague', 'https://celeb.example.com/p/1');
  const card = storyCard(page);
  await expect(card.locator('.story-caution')).toHaveText(
    "This link doesn't say who was involved or when, so LinkPeek can't tell which story it means. The reports below are possible matches only and may be about a different story.",
    { timeout: 10_000 },
  );
  await expect(card.locator('.story-subject')).toHaveCount(0);
  await expect(card.locator('.story-tag')).toHaveText(['Possible match', 'Insufficient information']);
  // Nothing written about any one story, so no old case reads as this one (D68).
  for (const h of ['What happened?', 'Key details', 'What is confirmed?', 'Reported, not confirmed']) await expect(card.getByRole('heading', { name: h })).toHaveCount(0);
  await expect(card).not.toContainText('Written by AI');
  // The explanation isn't repeated at the end.
  await expect(card.locator('.story-notes')).toHaveCount(0);
  // The closest results, each marked possible and with its own date.
  await expect(card.getByRole('heading', { name: 'Possibly related sources' })).toBeVisible();
  await expect(card.locator('.story-source-tag', { hasText: 'Possible match' })).toHaveCount(2);
  await expect(card.locator('.story-source-meta')).toContainText(['12 February 2012', '22 November 1997']);
  expect(page.url()).toBe(PAGE);
  expect(context.pages()).toHaveLength(pagesBefore);
});

test('no results: says so, with no report and no sources', async ({ page, context }) => {
  await agreeOnce(context);
  await storyFor(page, context, 'no-results', `${TEST_SERVER}/2026/11/25/nothing-turned-up-for-the-lighthouse-keeper`);
  const card = storyCard(page);
  await expect(card).toContainText('No reports about this story were found.', { timeout: 10_000 });
  await expect(card.locator('.story-tag')).toHaveText(['No reliable match']);
  await expect(card.getByRole('heading', { name: 'What happened?' })).toHaveCount(0);
  await expect(card.locator('.story-source-link')).toHaveCount(0);
  await expect(card).toContainText('Searched for: “Nothing turned up for the lighthouse keeper”');
});

test('the backend failing outright (HTTP 500) is a failure with Try again, never a report', async ({ page, context }) => {
  await agreeOnce(context);
  await storyFor(page, context, 'server-down', `${TEST_SERVER}/2026/11/25/server-down-story-about-the-quay`);
  const card = storyCard(page);
  await expect(card).toContainText("LinkPeek's server couldn't be reached. Try again later.", { timeout: 10_000 });
  await expect(card.getByRole('heading', { name: 'What happened?' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Try again' }).click();
  await expect(card).toContainText("LinkPeek's server couldn't be reached.", { timeout: 10_000 });
  expect(await sent(page)).toHaveLength(2);
});

test('the AI failing: the closest sources as possible matches only, no claims, and Try again', async ({ page, context }) => {
  await agreeOnce(context);
  await storyFor(page, context, 'ai-down', `${TEST_SERVER}/2026/11/25/ai-down-story-about-the-dock-cranes`);
  const card = storyCard(page);
  await expect(card).toContainText("Couldn't write a report. These sources may be about the same story:", { timeout: 10_000 });
  await expect(card.locator('.story-tag')).toHaveText(['Possible match']);
  await expect(card.getByRole('heading', { name: 'Possibly related sources' })).toBeVisible();
  await expect(card.locator('.story-source-link')).toHaveCount(2);
  for (const h of ['What happened?', 'What is confirmed?', 'Reported, not confirmed']) await expect(card.getByRole('heading', { name: h })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('many sources: each listed with site, date and kind; repeats and the linked article marked; nothing overflows', async ({ page, context }) => {
  await agreeOnce(context);
  await storyFor(page, context, 'many', `${TEST_SERVER}/2026/11/25/many-sources-story-about-the-harbour-festival`);
  const card = storyCard(page);
  await expect(card.locator('.story-source-link')).toHaveCount(6, { timeout: 10_000 });
  const items = card.locator('.story-source');
  await expect(items.nth(0)).toContainText('The linked article');
  await expect(items.nth(1).locator('.story-source-meta')).toHaveText('Example Wire · 25 November 2026 · News agency');
  await expect(items.nth(2)).toContainText('Repeats source 2');
  await expect(items.nth(4).locator('.story-source-meta')).toContainText('Opinion');
  await expect(items.nth(5).locator('.story-source-meta')).toContainText('Social media post');
  await expect(items.nth(5)).toContainText('Possible match');
  await expect(card).toContainText('Some sources repeat the same report. Repeats count once.');
  // A long source title wraps inside the card rather than pushing it sideways.
  expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const box = (await card.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('a very long headline is shown in full before sending, and the card stays inside the window', async ({ page, context }) => {
  await storyFor(page, context, 'long', `${TEST_SERVER}/2026/11/25/harbour-redevelopment-to-begin`);
  const card = storyCard(page);
  await expect(card.locator('.story-preview')).toContainText('after years of delays, funding disputes and two public inquiries');
  const fits = async () => {
    expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const box = (await card.boundingBox())!;
    const view = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  };
  await fits();
  await card.getByRole('button', { name: 'Search' }).click();
  await expect(card.locator('.story-stages')).toBeVisible();
  await fits();
  await expect(card.getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  await fits();
});

test('a link with no description: only its own clues are sent, and the search works', async ({ page, context }) => {
  await storyFor(page, context, 'no-description', `${TEST_SERVER}/2026/11/25/harbour-lights-switched-on-for-winter`);
  const card = storyCard(page);
  // No description line. (The publisher is the page's own site name: this link is on the same site.)
  await expect(card.locator('.story-preview dt')).toHaveText(['Headline', 'Link address', 'Date', 'Publisher']);
  await card.getByRole('button', { name: 'Search' }).click();
  await expect(card.getByRole('heading', { name: 'What happened?' })).toBeVisible({ timeout: 10_000 });
  const [body] = await sent(page);
  expect(body).toMatchObject({ headline: { text: 'Harbour lights switched on for winter' }, date: '2026-11-25' });
  expect(body!.description).toBeUndefined();
  // Neighbouring stories in the same list aren't mixed in.
  expect(JSON.stringify(body)).not.toMatch(/lighthouse|quay|dock cranes|festival|redevelopment/);
});
