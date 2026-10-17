/**
 * LinkPeek link tester. Runs each address through LinkPeek's own reading
 * code, in a Chromium with the test build loaded, then writes what came back
 * to results/ as a CSV and adds an entry to results/log.md.
 *
 *   node link-test.mjs links.txt
 *   node link-test.mjs links.txt --headed     (show the browser window)
 *
 * This build allows every website, so it never asks for permission. An
 * installed LinkPeek asks once per site, so a result here can differ from
 * what someone sees with a normal install.
 */
import { chromium } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, 'extension');
const resultsDir = resolve(here, 'results');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const listFile = resolve(args.find((a) => !a.startsWith('--')) ?? resolve(here, 'links.txt'));

/** Hosts that wrap a link on the way to the article. */
const WRAPPER_HOSTS = {
  'l.facebook.com': 'Facebook',
  'l.instagram.com': 'Instagram',
  'out.reddit.com': 'Reddit',
  't.co': 'X',
  'news.google.com': 'Google News',
};

/** Facebook and Instagram keep the real address in the u= parameter, so it can be tested too. */
const DECODABLE_HOSTS = ['l.facebook.com', 'l.instagram.com'];

const OUTCOME = {
  full: 'works',
  partial: 'partial',
  'headline-only': 'description only',
  unavailable: 'fails',
};

const COLUMNS = [
  'link',
  'wrapper',
  'outcome',
  'reason',
  'final address',
  'words',
  'opening',
  'summary',
  'publisher',
  'published',
  'article type',
  'seconds',
  'decoded address',
  'decoded outcome',
  'decoded reason',
  'your check',
];

function readList(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** Returns a parsed web address, or undefined when the line is not one. */
function webAddress(line) {
  try {
    const url = new URL(line);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function outcomeOf(res) {
  if (res.kind !== 'result') return 'error';
  return OUTCOME[res.result.evidence] ?? 'fails';
}

function reasonOf(res) {
  if (res.kind === 'result') return res.result.failure ?? '';
  return res.message ?? res.kind;
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Finds LinkPeek's service worker and waits until its extension APIs exist.
 * Right after the browser starts, the worker can be found before they do.
 */
async function readyWorker(context) {
  const isLinkPeek = (w) => w.url().startsWith('chrome-extension://');
  // Chromium can start other service workers first, so take LinkPeek's own by its address.
  const worker = context.serviceWorkers().find(isLinkPeek) ?? (await context.waitForEvent('serviceworker', { predicate: isLinkPeek }));
  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = await worker
      .evaluate(() => typeof chrome.storage !== 'undefined' && typeof globalThis.__linkpeekRetrieve === 'function')
      .catch(() => false);
    if (ready) return worker;
    await pause(250);
  }
  throw new Error('LinkPeek did not start in the test browser. Run the tester again, or add --headed to see the browser.');
}

/** Reads one address through LinkPeek's pipeline and times it. A worker error gets one retry. */
async function readOne(worker, address) {
  const started = Date.now();
  const attempt = () =>
    worker
      .evaluate((u) => globalThis.__linkpeekRetrieve(u), address)
      .catch((e) => ({ kind: 'error', message: String(e).slice(0, 160) }));
  let res = await attempt();
  if (res.kind === 'error') {
    await pause(1000);
    res = await attempt();
  }
  return { res, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

function rowFor(res, seconds) {
  const r = res.kind === 'result' ? res.result : undefined;
  // Only the address and path: query strings on robot-check pages are one-off tokens.
  let finalAddress = '';
  if (r?.finalUrl) {
    const f = new URL(r.finalUrl);
    finalAddress = f.origin + f.pathname;
  }
  return {
    outcome: outcomeOf(res),
    reason: reasonOf(res),
    'final address': finalAddress,
    words: r?.extract?.wordCount ?? '',
    opening: r?.extract?.firstSentence ?? r?.preview ?? '',
    summary: r?.summary?.text ?? '',
    publisher: r?.source?.publisher?.value ?? '',
    published: r?.source?.published?.value ?? '',
    'article type': r?.source?.articleType?.value ?? '',
    seconds,
  };
}

const csvCell = (v) => `"${String(v ?? '').replace(/\s+/g, ' ').replace(/"/g, '""')}"`;

function writeCsv(file, rows) {
  const lines = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))];
  writeFileSync(file, `\uFEFF${lines.join('\r\n')}\r\n`);
}

function logEntry(stamp, csvName, rows) {
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  const tally = Object.entries(counts)
    .map(([outcome, n]) => `${outcome} ${n}`)
    .join(', ');
  const problems = rows.filter((r) => r.outcome !== 'works');
  const lines = problems.map((r) => {
    const decoded = r['decoded address'] ? ` Decoded address: ${r['decoded outcome']}${r['decoded reason'] ? ` (${r['decoded reason']})` : ''}.` : '';
    return `- ${r.link}: ${r.outcome}${r.reason ? ` (${r.reason})` : ''}.${decoded}`;
  });
  return [
    `## ${stamp}: ${rows.length} links`,
    '',
    `Outcomes: ${tally || 'none'}. Full results: results/${csvName}`,
    '',
    ...(lines.length ? lines : ['No problems found.']),
    '',
    '',
  ].join('\n');
}

mkdirSync(resultsDir, { recursive: true });
if (!existsSync(listFile)) {
  console.log(`Cannot find ${listFile}`);
  process.exit(1);
}
const addresses = readList(listFile);
if (addresses.length === 0) {
  console.log(`No addresses in ${listFile}. Add one per line; lines starting with # are ignored.`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
const csvName = `${stamp}.csv`;
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: !headed,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});

const rows = [];
try {
  const worker = await readyWorker(context);
  await worker.evaluate(() => chrome.storage.session.clear());

  for (const [i, address] of addresses.entries()) {
    const url = webAddress(address);
    const base = { link: address, wrapper: '', 'decoded address': '', 'decoded outcome': '', 'decoded reason': '', 'your check': '' };
    if (!url) {
      const row = { ...base, outcome: 'not a web address', reason: 'Not an http or https address', seconds: '' };
      rows.push(row);
      console.log(`${i + 1}/${addresses.length} not a web address: ${address}`);
      continue;
    }

    base.wrapper = WRAPPER_HOSTS[url.hostname] ?? '';
    const main = await readOne(worker, address);
    const row = { ...base, ...rowFor(main.res, main.seconds) };

    const decoded = DECODABLE_HOSTS.includes(url.hostname) ? url.searchParams.get('u') : null;
    if (decoded) {
      const inner = await readOne(worker, decoded);
      row['decoded address'] = decoded;
      row['decoded outcome'] = outcomeOf(inner.res);
      row['decoded reason'] = reasonOf(inner.res);
    }

    rows.push(row);
    const note = row.reason ? ` (${row.reason})` : '';
    const wrapped = row.wrapper ? ` [${row.wrapper} link]` : '';
    console.log(`${i + 1}/${addresses.length} ${row.outcome}${note} in ${row.seconds}s${wrapped}: ${address}`);
  }
} finally {
  await context.close();
}

const csvPath = resolve(resultsDir, csvName);
writeCsv(csvPath, rows);

const logPath = resolve(resultsDir, 'log.md');
if (!existsSync(logPath)) {
  writeFileSync(logPath, '# LinkPeek link test log\n\nOne entry per run, newest at the bottom. Write your own notes under an entry if you like.\n\n');
}
appendFileSync(logPath, logEntry(stamp.replace('_', ' '), csvName, rows));

const ok = rows.filter((r) => r.outcome === 'works').length;
console.log(`\n${ok} of ${rows.length} links read in full.`);
console.log(`Results: ${csvPath}`);
console.log(`Log: ${logPath}`);
