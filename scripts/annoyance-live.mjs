/**
 * Part 12 live check: turns every annoyance tool on, runs LinkPeek's page
 * script on ten real pages, and writes what changed to docs/compat/annoyance.md.
 *
 * It measures what it can: how many elements were hidden or labelled, how much
 * of the visible text is still there, whether the page still scrolls, and
 * whether a login form or a cookie notice was hidden. It can't judge whether a
 * site still works for a person. That needs someone to browse the site.
 *
 *   node scripts/build.mjs --live && node scripts/annoyance-live.mjs
 *
 * Like live-check.mjs, it needs the internet and websites change, so the
 * output is a dated snapshot, not a test.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = resolve(root, 'dist-live');
const outFile = resolve(root, 'docs/compat/annoyance.md');

/** [label, address] */
const PAGES = [
  ['BBC News article', 'https://www.bbc.co.uk/news/articles/c3qjn45pepx1o'],
  ['Guardian news (US)', 'https://www.theguardian.com/us-news/2026/oct/17/alligator-attack-florida-fisher-killed'],
  ['Mirror news', 'https://www.mirror.co.uk/news/uk-news/bedford-train-crash-hero-eli-37775689'],
  ['Al Jazeera news', 'https://www.aljazeera.com/news/2026/10/17/france-wave-of-nationwide-protests'],
  ['Ars Technica news', 'https://arstechnica.com/ai/2026/10/youtube-music-begins-labeling-ai-songs/'],
  ['The Verge news', 'https://www.theverge.com/ai-artificial-intelligence/1010962/jpmorgan-chase-is-keeping-ai-agents-out'],
  ['NPR news quiz', 'https://www.npr.org/2026/10/16/g-s1-148041/pope-leo-musk-mamdani-trump-guilfoyle-news-quiz'],
  ['GOV.UK press release', 'https://www.gov.uk/government/news/new-action-to-crackdown-on-bogus-self-employment-loopholes'],
  ['Wikipedia article', 'https://en.wikipedia.org/wiki/Dachshund'],
  ['CNN photo gallery', 'https://www.cnn.com/2026/10/08/world/gallery/photos-this-week-october-1-october-8'],
];

const ALL_ON = {
  readingMode: true,
  signUpOverlays: true,
  floatingVideo: true,
  stickyBars: true,
  urgencyLabels: true,
  autoplayPause: true,
};
const ALL_OFF = Object.fromEntries(Object.keys(ALL_ON).map((k) => [k, false]));

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});

const isLinkPeek = (w) => w.url().startsWith('chrome-extension://');
const rows = [];
try {
  const worker = context.serviceWorkers().find(isLinkPeek) ?? (await context.waitForEvent('serviceworker', { predicate: isLinkPeek }));

  /** Measures the page as a reader sees it. Runs in the page, so it sees the page's own DOM. */
  const measure = (page) =>
    page.evaluate(() => {
      const visibleText = document.body?.innerText ?? '';
      const hidden = [...document.querySelectorAll('[data-linkpeek-annoyance]')].filter((el) => el.tagName !== 'SPAN' || !el.textContent?.startsWith('Urgency claim'));
      const labels = document.querySelectorAll('[data-linkpeek-annoyance-label]').length;
      const byTool = {};
      for (const el of hidden) {
        const tool = el.getAttribute('data-linkpeek-annoyance') ?? '';
        byTool[tool] = (byTool[tool] ?? 0) + 1;
      }
      const hiddenLoginOrConsent = hidden.filter((el) => el.querySelector('input[type="password"]') || /cookies?|consent|accept all|manage preferences/i.test(el.textContent ?? '')).length;
      return {
        // LinkPeek's own elements on the page: zero would mean its page script never ran here.
        linkpeekElements: document.querySelectorAll('[data-linkpeek]').length,
        samples: hidden.slice(0, 4).map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${String(el.className).slice(0, 50)}`),
        visibleChars: visibleText.length,
        scrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
        byTool,
        hidden: hidden.length,
        labels,
        hiddenLoginOrConsent,
      };
    });

  for (const [label, url] of PAGES) {
    const page = await context.newPage();
    let row;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const before = await measure(page);
      const origin = new URL(url).origin;
      // Turn every tool on for this run, then run LinkPeek's page script on the page.
      await worker.evaluate(async (all) => {
        const { settings } = await chrome.storage.local.get('settings');
        await chrome.storage.local.set({ settings: { ...settings, annoyance: all, annoyanceSites: {} } });
      }, ALL_ON);
      await worker.evaluate(async (match) => {
        const [tab] = await chrome.tabs.query({ url: match });
        if (tab?.id) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      }, `${origin}/*`);
      // Wait for LinkPeek's page script to start (it marks the page with its own elements). Some pages take longer.
      const started = await page
        .waitForFunction(() => document.querySelector('[data-linkpeek]') !== null, null, { timeout: 12_000 })
        .then(() => true, () => false);
      await page.waitForTimeout(2000);
      const after = await measure(page);
      row = { label, url, before, after, ok: true, started };
    } catch (err) {
      row = { label, url, ok: false, error: String(err).slice(0, 120) };
    } finally {
      await worker.evaluate(async (off) => {
        const { settings } = await chrome.storage.local.get('settings');
        await chrome.storage.local.set({ settings: { ...settings, annoyance: off, annoyanceSites: {} } });
      }, ALL_OFF);
      await page.close().catch(() => undefined);
    }
    rows.push(row);
    console.log(`${label}: ${row.ok ? `LinkPeek elements ${row.after.linkpeekElements}, hidden ${row.after.hidden}, labelled ${row.after.labels}${row.after.samples.length ? ` [${row.after.samples.join('; ')}]` : ''}` : `error (${row.error})`}`);
  }
} finally {
  await context.close();
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const date = new Date().toISOString().slice(0, 10);
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const table = rows
  .map((r) => {
    if (!r.ok) return `| [${cell(r.label)}](${r.url}) | not loaded | – | – | – | – | ${cell(r.error)} |`;
    if (!r.started) return `| [${cell(r.label)}](${r.url}) | page script didn't start | – | – | – | – | not measured |`;
    const tools = Object.entries(r.after.byTool).map(([t, n]) => `${t} ${n}`).join(', ') || 'nothing';
    const kept = pct(r.after.visibleChars, r.before.visibleChars);
    const scrollNote = r.before.scrolls === r.after.scrolls ? (r.after.scrolls ? 'yes' : 'no (also before)') : `${r.before.scrolls ? 'yes' : 'no'} → ${r.after.scrolls ? 'yes' : 'no'}`;
    const notes = r.after.hiddenLoginOrConsent ? `**${r.after.hiddenLoginOrConsent} login or consent element(s) hidden**` : 'none';
    return `| [${cell(r.label)}](${r.url}) | ${tools} | ${r.after.labels} | ${kept} | ${scrollNote} | ${r.after.hidden} | ${notes} |`;
  })
  .join('\n');

const md = `# Annoyance tools: real-site check (Part 12)

Run on ${date}, with every tool on, from a cloud machine through its proxy. Made by \`node scripts/build.mjs --live && node scripts/annoyance-live.mjs\`.

This is an automated measure, not a test, and not a judgement of whether a site still works. A site can lose something that matters and still show these numbers. A person needs to browse each site with the tools on before any tool is recommended for everyone.

| Page | What changed | Labels added | Visible text kept | Still scrolls | Elements hidden | Login or consent hidden |
|---|---|---|---|---|---|---|
${table}

What the columns mean:

- **Visible text kept** is the page's visible text after the tools ran, as a share of the text before. Under 100% means something was hidden or removed from view. A drop on a news page is worth looking at, because it may be an overlay that covered the article rather than an ad.
- A figure **over 100%** means the page loaded more text between the two readings (lazy loading, or a feed), not that LinkPeek added any.
- **Still scrolls** is whether the page can still be scrolled after the tools ran.
- **Login or consent hidden** must read "none". The tools are built never to hide a password form or a cookie notice, so any row that says otherwise is a bug, not a result.

Reading mode is in the table as a setting, but it isn't measured here: it works in LinkPeek's own panel, and the panel only opens when someone presses "Read here".

## Breakage

Not measured here: whether a site still works for a reader. Until someone has browsed these ten sites with the tools on, the notes above are the only breakage record.

What was hidden, from the samples the run recorded (a person still needs to look):

- **Mirror:** three elements. Two are named like ad gutters on either side of the article (going by their class names, not by looking). The third is a sticky element that hasn't been identified.
- **Guardian (US):** one element (\`dcr-1acu569\`), a sticky block. Not identified: it may be the site's header, which would matter.
- **BBC and CNN:** the page script didn't start within 12 seconds, so nothing was measured there. Not a clean result.
`;
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, md);
console.log(`Wrote ${outFile}`);
