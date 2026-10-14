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
      // null = no frame answered (what the service worker treats as "couldn't peek").
      return chrome.tabs.sendMessage(tab!.id!, m).catch(() => null);
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

test('icons use their own, unpredictable element names that no page has defined', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/news-front.html`);
  await expect(icons(page).first()).toBeVisible();
  const { name, defined } = await icons(page)
    .first()
    .evaluate((e) => ({ name: e.localName, defined: e.matches(':defined') }));
  expect(name).toMatch(/^linkpeek-icon-[a-z][a-z0-9]*$/);
  expect(defined).toBe(false);
});

test('a page that defines our element name cannot get into new icons; LinkPeek switches names', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/infinite-feed.html`);
  await expect(icons(page)).toHaveCount(10);
  // The page registers the name it sees, trying to grab the shadow root of icons made from now on.
  const taken = await page.evaluate(() => {
    const name = document.querySelector('[data-linkpeek="icon"]')!.localName;
    const w = window as unknown as { stolen: number };
    w.stolen = 0;
    customElements.define(
      name,
      class extends HTMLElement {
        constructor() {
          super();
          try {
            if (this.attachInternals().shadowRoot) w.stolen++;
          } catch {
            // attachInternals not allowed here
          }
        }
      },
    );
    return name;
  });
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(icons(page)).toHaveCount(20);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('[data-linkpeek="icon"]')].map((e) => e.localName),
  );
  expect(names.slice(10).every((n) => n !== taken && n.startsWith('linkpeek-icon-'))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { stolen: number }).stolen)).toBe(0);
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
  // The page also sets our colour variables to transparent and hangs a
  // pink ::after "cover" off our elements. Neither may take effect.
  const looks = await page.locator('[data-linkpeek="card"]').evaluate((host) => {
    const summary = host.shadowRoot!.querySelector('.summary')!;
    const box = host.shadowRoot!.querySelector('.card')!;
    return {
      text: getComputedStyle(summary).color,
      background: getComputedStyle(box).backgroundColor,
      cover: getComputedStyle(host, '::after').content,
    };
  });
  expect(looks.text).not.toBe('rgba(0, 0, 0, 0)');
  expect(looks.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(looks.cover).toBe('none');
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
  // An SVG link isn't a link LinkPeek can preview: no frame answers.
  expect((await sendToPage(context, { type: 'peek-focused' })) ?? null).toBeNull();
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
  await expect(page.locator('.leftover')).toHaveCount(0);
  // The page also has forms whose inputs are named "matches", "contains" and
  // (added later) "localName". They must not stop the scanner, and the menu
  // links inside them must not get icons.
  await expect(icons(page)).toHaveCount(3);
  await expectIconsExactlyOnExpected(page);
});

test('a crafted form cannot make "Scan this page" hang', async ({ page, context }) => {
  await page.goto(`${TEST_SERVER}/clobber.html`);
  // Playwright's own locators trip over this page's crafted forms, so wait plainly.
  await page.waitForFunction(() => Boolean(document.getElementById('late')?.querySelector('a')));
  await setSettings(context, { mode: 'scan' });
  await expect(icons(page)).toHaveCount(0);
  expect(await sendToPage(context, { type: 'scan' })).toEqual({ ok: true, found: 3 });
});

test('an icon stays hidden when its link is in a hidden (faded-out) slide', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  const icon = page.locator('#faded-link + [data-linkpeek="icon"]');
  await expect(icon).toHaveCount(1);
  expect(await icon.evaluate((e) => getComputedStyle(e).visibility)).toBe('hidden');
  await expect(icon).toBeHidden();
});

test('a ticking "updated N min ago" inside a headline does not rebuild its icon or steal focus', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  const icon = page.locator('#live-link + [data-linkpeek="icon"]');
  await expect(icon).toHaveCount(1);
  await page.evaluate(() => {
    (window as unknown as { liveIcon: Element }).liveIcon = document.querySelector(
      '#live-link + [data-linkpeek="icon"]',
    )!;
  });
  await icon.getByRole('button').focus();
  await page.waitForTimeout(1500); // about 7 ticks
  const same = await page.evaluate(() => {
    const before = (window as unknown as { liveIcon: Element }).liveIcon;
    return before.isConnected && document.querySelector('#live-link + [data-linkpeek="icon"]') === before;
  });
  expect(same).toBe(true);
  await expect(icon.getByRole('button')).toBeFocused();
});

test('page code that keeps its own badge right after a link does not make LinkPeek loop', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/dupes.html`);
  await expect(page.locator('#badge-link ~ [data-linkpeek="icon"]')).toHaveCount(1);
  // Count icon insertions next to that link over two seconds.
  const inserted = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const parent = document.getElementById('badge-link')!.parentElement!;
        const obs = new MutationObserver((records) => {
          for (const r of records)
            for (const node of r.addedNodes)
              if ((node as Element).getAttribute?.('data-linkpeek') === 'icon') n++;
        });
        obs.observe(parent, { childList: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(n);
        }, 2000);
      }),
  );
  expect(inserted).toBeLessThanOrEqual(1);
  await expect(page.locator('#badge-link ~ [data-linkpeek="icon"]')).toHaveCount(1);
});

test('Smart mode still starts on a page that never finishes loading (a stuck image)', async ({ page }) => {
  await page.goto(`${TEST_SERVER}/never-loads.html`, { waitUntil: 'domcontentloaded' });
  await expect(icons(page)).toHaveCount(2, { timeout: 8000 });
  expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
});

test('the popup updates while open when the site is turned off elsewhere', async ({ page, context, extensionId }) => {
  await page.goto(`${TEST_SERVER}/news-front.html`);
  const tabId = await inWorker(
    context,
    async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0]!.id,
    null,
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
  await expect(popup.locator('#site-state')).toContainText('On.');
  await setSettings(context, { disabledSites: ['127.0.0.1'] });
  await expect(popup.locator('#site-state')).toContainText('Off.');
  await setSettings(context, { disabledSites: [] });
  await expect(popup.locator('#site-state')).toContainText('On.');
});

test('after an extension update, the old copy removes its icons within seconds (Scan mode, no page changes)', async ({
  page,
  context,
}) => {
  await page.goto(`${TEST_SERVER}/news-front.html`);
  await setSettings(context, { mode: 'scan' });
  expect(await sendToPage(context, { type: 'scan' })).toEqual({ ok: true, found: 11 });
  await expect(icons(page)).toHaveCount(11);
  // Reload the extension: the content script on this page is now an orphan.
  await inWorker(context, () => chrome.runtime.reload(), null).catch(() => undefined);
  await expect(icons(page)).toHaveCount(0, { timeout: 10_000 });
});
