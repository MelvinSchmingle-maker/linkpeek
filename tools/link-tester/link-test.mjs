/**
 * LinkPeek link tester. Runs each address through LinkPeek's own reading
 * code, in a Chromium with the test build loaded, then writes one CSV per run
 * to results/ and adds an entry to results/log.md.
 *
 *   node link-test.mjs links.txt --source own-computer
 *   node link-test.mjs links.txt --source own-computer --headed   (show the browser window)
 *   node link-test.mjs --report                                   (summarise every run in results/)
 *
 * --source says where the run happened: own-computer, cloud or fixture. Every
 * CSV and report keeps the source, so the three are never mixed up.
 *
 * What is stored: the platform, the redacted address (scheme, host and path;
 * no query string or token), the stage a failure happened at, the reason, the
 * evidence level, the permission state and the time. Article text is NOT
 * stored unless you add --with-text.
 *
 * This build allows every website, so it never asks for permission. An
 * installed LinkPeek asks once per site, so a result here can differ from what
 * someone sees with a normal install.
 */
import { chromium } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = resolve(here, 'extension');
const resultsDir = resolve(here, 'results');

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const withText = args.includes('--with-text');
const reportOnly = args.includes('--report');
const sourceFlag = args.indexOf('--source');
const SOURCES = ['own-computer', 'cloud', 'fixture', 'unspecified'];
const source = sourceFlag >= 0 ? args[sourceFlag + 1] : 'unspecified';
if (!SOURCES.includes(source)) {
  console.log(`--source must be one of: ${SOURCES.join(', ')}`);
  process.exit(1);
}
const listArg = args.find((a, i) => !a.startsWith('--') && (sourceFlag < 0 || i !== sourceFlag + 1));
const listFile = resolve(listArg ?? resolve(here, 'links.txt'));

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

/** Which part of reading a failure came from. */
const STAGE = {
  'bad-link': 'resolution',
  'permission-denied': 'permission',
  'unsafe-address': 'refused (private address)',
  network: 'fetch',
  timeout: 'fetch',
  'http-4xx': 'fetch',
  'http-403': 'fetch',
  'http-429': 'fetch',
  'http-5xx': 'fetch',
  'too-large': 'fetch',
  'bot-challenge': 'extraction',
  'login-wall': 'extraction',
  paywall: 'extraction',
  'js-rendered-empty': 'extraction',
  'extraction-failed': 'extraction',
  'unsupported-type': 'extraction',
  'summary-failed': 'summary',
};

const BUILD = 'live check build: every site allowed, so no permission prompts';

const BASE_COLUMNS = [
  'source',
  'platform',
  'link',
  'wrapper',
  'outcome',
  'stage',
  'reason',
  'evidence',
  'permission',
  'final address',
  'words',
  'seconds',
  'decoded address',
  'decoded outcome',
  'decoded stage',
  'decoded reason',
  'your check',
];
const TEXT_COLUMNS = ['opening', 'summary', 'publisher', 'published', 'article type'];
const COLUMNS = withText ? [...BASE_COLUMNS, ...TEXT_COLUMNS] : BASE_COLUMNS;

/** Scheme, host and path only: the query string and fragment often hold tokens and personal IDs. */
function redact(address) {
  if (!address) return '';
  try {
    const u = new URL(address);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '';
  }
}

/** A platform name for the host, so the report can group results by site. */
function platformOf(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (/(^|\.)(x|twitter)\.com$|^t\.co$/.test(host)) return 'X';
  if (/(^|\.)facebook\.com$|^fb\.com$/.test(host)) return 'Facebook';
  if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
  if (/(^|\.)reddit\.com$/.test(host)) return 'Reddit';
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return 'YouTube';
  if (/(^|\.)linkedin\.com$/.test(host)) return 'LinkedIn';
  return 'website';
}

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

function stageOf(res) {
  if (res.kind !== 'result') return 'test';
  const failure = res.result.failure;
  if (!failure) return 'none';
  return STAGE[failure] ?? 'other';
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
  const row = {
    outcome: outcomeOf(res),
    stage: stageOf(res),
    reason: reasonOf(res),
    evidence: r?.evidence ?? '',
    permission: r?.needsPermissionFor ? `needed for ${r.needsPermissionFor}` : 'not needed (every site allowed in this build)',
    'final address': redact(r?.finalUrl),
    words: r?.extract?.wordCount ?? '',
    seconds,
  };
  if (withText) {
    row.opening = r?.extract?.firstSentence ?? r?.preview ?? '';
    row.summary = r?.summary?.text ?? '';
    row.publisher = r?.source?.publisher?.value ?? '';
    row.published = r?.source?.published?.value ?? '';
    row['article type'] = r?.source?.articleType?.value ?? '';
  }
  return row;
}

const csvCell = (v) => `"${String(v ?? '').replace(/\s+/g, ' ').replace(/"/g, '""')}"`;

function writeCsv(file, rows) {
  const lines = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))];
  writeFileSync(file, `\uFEFF${lines.join('\r\n')}\r\n`);
}

/** A small CSV reader for the files this script writes (quoted cells, doubled quotes, CRLF). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function logEntry(stamp, csvName, rows) {
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  const tally = Object.entries(counts)
    .map(([outcome, n]) => `${outcome} ${n}`)
    .join(', ');
  const problems = rows.filter((r) => r.outcome !== 'works');
  const lines = problems.map((r) => {
    const decoded = r['decoded address'] ? ` Decoded address: ${r['decoded outcome']}${r['decoded stage'] ? ` at ${r['decoded stage']}` : ''}${r['decoded reason'] ? ` (${r['decoded reason']})` : ''}.` : '';
    return `- ${r.link}: ${r.outcome}${r.stage && r.stage !== 'none' ? ` at ${r.stage}` : ''}${r.reason ? ` (${r.reason})` : ''}.${decoded}`;
  });
  return [
    `## ${stamp}: ${rows.length} links, source ${source}`,
    '',
    `Outcomes: ${tally || 'none'}. Full results: results/${csvName}`,
    '',
    ...(lines.length ? lines : ['No problems found.']),
    '',
    '',
  ].join('\n');
}

/** Summarises every CSV in results/, grouped by source, so no run is mixed with another. */
function report() {
  const files = existsSync(resultsDir) ? readdirSync(resultsDir).filter((f) => f.endsWith('.csv')).sort() : [];
  if (!files.length) {
    console.log('No results yet. Run the tester first.');
    return;
  }
  const rows = files.flatMap((f) => parseCsv(readFileSync(resolve(resultsDir, f), 'utf8')).map((r) => ({ ...r, run: f })));
  const count = (list, key) => list.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});
  const sources = [...new Set(rows.map((r) => r.source))];
  const out = ['# Compatibility report', '', `Runs: ${files.length} (${files.join(', ')}). Links: ${rows.length}.`, ''];
  for (const src of sources) {
    const mine = rows.filter((r) => r.source === src);
    out.push(`## Source: ${src} (${mine.length} links)`, '');
    out.push('| Outcome | Links |', '|---|---|');
    for (const [k, n] of Object.entries(count(mine, 'outcome')).sort()) out.push(`| ${k} | ${n} |`);
    out.push('', '| Stage | Links |', '|---|---|');
    for (const [k, n] of Object.entries(count(mine, 'stage')).sort()) out.push(`| ${k} | ${n} |`);
    out.push('', '| Platform | Links | Works |', '|---|---|---|');
    const platforms = [...new Set(mine.map((r) => r.platform))];
    for (const p of platforms.sort()) {
      const pl = mine.filter((r) => r.platform === p);
      out.push(`| ${p} | ${pl.length} | ${pl.filter((r) => r.outcome === 'works').length} |`);
    }
    const failures = mine.filter((r) => r.outcome !== 'works');
    if (failures.length) {
      out.push('', 'Failures (redacted addresses):', '');
      for (const r of failures) out.push(`- ${r.link} (${r.run}): ${r.outcome}, stage ${r.stage}${r.reason ? `, ${r.reason}` : ''}`);
    }
    out.push('');
  }
  writeFileSync(resolve(resultsDir, 'report.md'), out.join('\n'));
  console.log(`Wrote ${resolve(resultsDir, 'report.md')}`);
}

if (reportOnly) {
  mkdirSync(resultsDir, { recursive: true });
  report();
  process.exit(0);
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
if (source === 'unspecified') console.log('Tip: add --source own-computer or --source cloud so the report can tell the runs apart.');

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
    const base = {
      source,
      platform: '',
      link: redact(address),
      wrapper: '',
      'decoded address': '',
      'decoded outcome': '',
      'decoded stage': '',
      'decoded reason': '',
      'your check': '',
      permission: BUILD,
    };
    if (!url) {
      rows.push({ ...base, outcome: 'not a web address', stage: 'test', reason: 'Not an http or https address', seconds: '' });
      console.log(`${i + 1}/${addresses.length} not a web address`);
      continue;
    }

    base.platform = platformOf(url);
    base.wrapper = WRAPPER_HOSTS[url.hostname] ?? '';
    const main = await readOne(worker, address);
    const row = { ...base, ...rowFor(main.res, main.seconds) };

    const decoded = DECODABLE_HOSTS.includes(url.hostname) ? url.searchParams.get('u') : null;
    if (decoded) {
      const inner = await readOne(worker, decoded);
      row['decoded address'] = redact(decoded);
      row['decoded outcome'] = outcomeOf(inner.res);
      row['decoded stage'] = stageOf(inner.res);
      row['decoded reason'] = reasonOf(inner.res);
    }

    rows.push(row);
    const note = row.reason ? ` (${row.reason})` : '';
    const wrapped = row.wrapper ? ` [${row.wrapper} link]` : '';
    console.log(`${i + 1}/${addresses.length} ${row.outcome}${note} at ${row.stage} in ${row.seconds}s${wrapped}: ${redact(address)}`);
  }
} finally {
  await context.close();
}

const csvPath = resolve(resultsDir, csvName);
const outRows = rows.map((r) => {
  const copy = { ...r };
  for (const c of COLUMNS) if (!(c in copy)) copy[c] = '';
  return copy;
});
writeCsv(csvPath, outRows);

const logPath = resolve(resultsDir, 'log.md');
if (!existsSync(logPath)) {
  writeFileSync(logPath, '# LinkPeek link test log\n\nOne entry per run, newest at the bottom. Write your own notes under an entry if you like.\n\n');
}
appendFileSync(logPath, logEntry(stamp.replace('_', ' '), csvName, rows));

const ok = rows.filter((r) => r.outcome === 'works').length;
console.log(`\n${ok} of ${rows.length} links read in full (source: ${source}).`);
console.log(`Results: ${csvPath}`);
console.log(`Log: ${logPath}`);
