/**
 * Live check (Part 04): runs LinkPeek's real reading pipeline on a list of
 * real public web pages and writes what came back to
 * docs/compat/part-04-live.md.
 *
 * Not part of `npm test` or `npm run test:e2e`: it needs the internet, and
 * websites change, so its results are a dated snapshot, not a pass/fail test.
 *
 *   node scripts/build.mjs --live && node scripts/live-check.mjs
 *
 * If HTTPS_PROXY is set, Chromium is sent through it (certificate checks
 * stay on).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = resolve(root, 'dist-live');
const outFile = resolve(root, 'docs/compat/part-04-live.md');

/** Counts of each primary-source kind, in words, for one table cell. */
const primaryShort = (c) => `gov ${c.government}, court ${c.court}, research ${c.research}, PDF ${c.pdf}`;

/** [label, address, what we expect a person to see] */
const PAGES = [
  ['BBC News article', 'https://www.bbc.co.uk/news/articles/c3qjn45pepx1o', 'full'],
  ['Guardian feature', 'https://www.theguardian.com/lifeandstyle/2026/oct/14/a-moment-that-changed-me-i-learned-to-read-at-42', 'full'],
  ['GOV.UK press release', 'https://www.gov.uk/government/news/new-action-to-crackdown-on-bogus-self-employment-loopholes', 'full'],
  ['Wikipedia article', 'https://en.wikipedia.org/wiki/Dachshund', 'full'],
  ['GitHub blog post', 'https://github.blog/ai-and-ml/generative-ai/how-ai-code-generation-works/', 'full'],
  ['arXiv paper (PDF)', 'https://arxiv.org/pdf/1706.03762', 'full or first pages'],
  ['Hacker News thread', 'https://news.ycombinator.com/item?id=50087328', 'discussion, not an article'],
  ['YouTube video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'preview (needs Part 06)'],
  ['Reddit (old)', 'https://old.reddit.com/r/UKPersonalFinance/', 'login wall'],
  ['The Times (paywall)', 'https://www.thetimes.com/business/companies-markets/article/arrests-fca-nca-insider-trading-nbff2hm2x', 'paywall, description only'],
  // Nine more news pages, for the "browser tab" rule (todo section 1). Taken from the publishers' front pages on 17 Oct 2026.
  ['Guardian news (US)', 'https://www.theguardian.com/us-news/2026/oct/17/alligator-attack-florida-fisher-killed', 'full'],
  ['BBC News article (entertainment)', 'https://www.bbc.co.uk/news/articles/c34g180knv91o', 'full'],
  ['Mirror news', 'https://www.mirror.co.uk/news/uk-news/bedford-train-crash-hero-eli-37775689', 'full'],
  ['Daily Mail news', 'https://www.dailymail.co.uk/news/article-16151631/mojave-desert-diner-route-66-bagdad-cafe.html', 'full'],
  ['Al Jazeera news', 'https://www.aljazeera.com/news/2026/10/17/france-wave-of-nationwide-protests', 'full'],
  ['CNN photo gallery', 'https://www.cnn.com/2026/10/08/world/gallery/photos-this-week-october-1-october-8', 'full or captions only'],
  ['NPR news quiz', 'https://www.npr.org/2026/10/16/g-s1-148041/pope-leo-musk-mamdani-trump-guilfoyle-news-quiz', 'full or partial'],
  ['Ars Technica news', 'https://arstechnica.com/ai/2026/10/youtube-music-begins-labeling-ai-songs/', 'full'],
  ['The Verge news', 'https://www.theverge.com/ai-artificial-intelligence/1010962/jpmorgan-chase-is-keeping-ai-agents-out', 'full'],
];

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});

const rows = [];
try {
  // Chromium can start other service workers first, so take LinkPeek's own by its address.
  const isLinkPeek = (w) => w.url().startsWith('chrome-extension://');
  const worker = context.serviceWorkers().find(isLinkPeek) ?? (await context.waitForEvent('serviceworker', { predicate: isLinkPeek }));
  await worker.evaluate(() => chrome.storage.session.clear());

  for (const [label, url, expected] of PAGES) {
    const started = Date.now();
    const res = await worker
      .evaluate((u) => globalThis.__linkpeekRetrieve(u), url)
      .catch((e) => ({ kind: 'error', message: String(e).slice(0, 120) }));
    const ms = Date.now() - started;
    const r = res.kind === 'result' ? res.result : undefined;
    rows.push({
      label,
      url,
      expected,
      evidence: r?.evidence ?? res.kind,
      failure: r?.failure ?? (res.kind === 'error' ? res.message : ''),
      method: r?.extract?.method ?? '',
      words: r?.extract?.wordCount ?? '',
      shown: r?.extract?.firstSentence ?? r?.preview ?? '',
      summary: r?.summary ? `${r.summary.text} (${r.summary.wordCount})` : '',
      // Just where it ended up: query strings on robot-check pages are one-off tokens.
      finalUrl: r?.finalUrl ? new URL(r.finalUrl).origin + new URL(r.finalUrl).pathname : '',
      // The source card's facts (Part 08), as the card would show them.
      publisher: r?.source?.publisher?.value ?? '',
      published: r?.source?.published?.value ?? '',
      articleType: r?.source?.articleType?.value ?? '',
      author: r?.source?.author?.value ?? '',
      primary: r?.source?.primarySources ? primaryShort(r.source.primarySources.value) : '',
      seconds: (ms / 1000).toFixed(1),
    });
    console.log(`${label}: ${r?.evidence ?? res.kind}${r?.failure ? ` (${r.failure})` : ''} in ${(ms / 1000).toFixed(1)}s`);
  }
} finally {
  await context.close();
}

// The table goes between these markers; notes written around it by hand are kept.
const START = '<!-- live-check:start -->';
const END = '<!-- live-check:end -->';

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 140);
const full = rows.filter((r) => r.evidence === 'full').length;
const date = new Date().toISOString().slice(0, 10);
const table = `${START}
Run on ${date}. **${full} of ${rows.length}** pages came back \`full\`.

| Page | Expected | Evidence | Reason | Read by | Words | Opening or preview | Summary (words) | Publisher | Published | Article type | Author | Primary-source links | Time |
|---|---|---|---|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| [${cell(r.label)}](${r.url}) | ${cell(r.expected)} | ${r.evidence} | ${cell(r.failure)} | ${r.method} | ${r.words} | ${cell(r.shown)} | ${cell(r.summary)} | ${cell(r.publisher)} | ${cell(r.published)} | ${r.articleType} | ${cell(r.author)} | ${cell(r.primary)} | ${r.seconds}s |`,
  )
  .join('\n')}

"Opening or preview" is the first sentence of the article for a \`full\`
result, or the page's own description for a preview. "Summary" is what the
card shows (Part 05, extractive), with its word count. Text in this table
comes from the websites; LinkPeek only chose and cut it.
${rows.some((r) => r.finalUrl) ? `\nRedirects: ${rows.filter((r) => r.finalUrl).map((r) => `${r.label} ended on ${r.finalUrl}`).join('; ')}.\n` : ''}${END}`;

const INTRO = `# Part 04 live check

Made by \`node scripts/build.mjs --live && node scripts/live-check.mjs\`, which
runs LinkPeek's real reading code on real pages and rewrites the table below.

This is a snapshot, not a test. Websites change, and the run came from a cloud
machine (a data-centre address, through a proxy), which some sites treat with
more suspicion than a home connection.

`;
const existing = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
const md =
  existing.includes(START) && existing.includes(END)
    ? existing.slice(0, existing.indexOf(START)) + table + existing.slice(existing.indexOf(END) + END.length)
    : `${INTRO}${table}\n`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, md);
console.log(`\n${full}/${rows.length} full. Wrote ${outFile}`);
