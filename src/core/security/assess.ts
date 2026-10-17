/**
 * The link protector, stage 1 (Part 11): checks on the link itself, on this
 * computer, with no lookup and no request. It warns. It never blocks, and it
 * never says a link is safe: the best it can say is "No known warning", with a
 * note that this isn't a guarantee.
 *
 * Pure: takes the link's address and text, returns an outcome and a reason, so
 * every rule is tested in eval/urls.json.
 */
import { parse } from 'tldts';
import type { LinkRiskLevel } from '../types';
import { decodeHost, decodeLabel } from './punycode';
import { BRANDS, RISKY_FILE, SCRIPT_RANGES, SECURITY_WORDS, SHORTENERS, SIGN_IN_PATH, skeleton, type Brand } from './lists';

/** Each rule has a name, so tests can say which one fired. */
export type LinkCheck =
  | 'ip-address'
  | 'at-sign'
  | 'long-address'
  | 'mixed-script'
  | 'lookalike'
  | 'brand-in-address'
  | 'sign-in-imitation'
  | 'download'
  | 'text-mismatch'
  | 'shortener';

export interface LinkAssessment {
  level: LinkRiskLevel;
  /** One plain sentence, from the strongest rule that fired. Absent for "No known warning". */
  reason?: string;
  /** Every rule that fired, strongest first. For tests and the eval report. */
  checks: LinkCheck[];
  /** The registrable site the address points to, e.g. "bbc.co.uk". */
  site?: string;
}

const MIN_BRAND_FOR_ONE_LETTER = 6;
const MAX_LABELS = 6;
const MAX_HOST_LENGTH = 80;
const MAX_TEXT_WORDS = 5;

export function assessLink(input: { href: string; text?: string }): LinkAssessment {
  let url: URL;
  try {
    url = new URL(input.href);
  } catch {
    return notChecked("LinkPeek couldn't read this web address.", []);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return notChecked('This link is not a web address.', []);
  }

  const parsed = parse(url.hostname);
  const site = parsed.domain ?? undefined;
  const found: { check: LinkCheck; reason: string }[] = [];
  const add = (check: LinkCheck, reason: string) => found.push({ check, reason });

  // A number address that points at this computer (127.x.x.x, ::1) isn't a remote site, so it isn't a warning.
  if (parsed.isIp && !isLoopback(url.hostname)) add('ip-address', 'The address is a number, not a site name.');
  if (url.username || url.password) {
    add('at-sign', 'The address has a name in front of the site, which can hide where the link really goes.');
  }

  const hostLabels = url.hostname.split('.');
  if (url.hostname.length > MAX_HOST_LENGTH || hostLabels.length > MAX_LABELS) {
    add('long-address', 'The web address is unusually long.');
  }

  // Mixed alphabets: decode the address first, so a lookalike shows its real letters.
  const decoded = decodeHost(url.hostname);
  if (decoded.split('.').some(mixesScripts)) {
    add('mixed-script', 'The address mixes letters from two alphabets, a common way of copying a site.');
  }

  if (site) {
    const name = (decodeLabel(site.split('.')[0] ?? '') ?? '').toLowerCase();
    const subdomainLabels = (parsed.subdomain ?? '').split('.').filter(Boolean).map((l) => (decodeLabel(l) ?? l).toLowerCase());
    for (const brand of BRANDS) {
      if (owns(brand, site, name)) continue;
      if (lookalike(name, brand)) {
        add(
          'lookalike',
          skeleton(name) === brand.label
            ? `"${site}" looks like ${brand.name}'s address, with letters swapped.`
            : `"${site}" is one letter away from ${brand.name}'s address.`,
        );
      }
      const tokens = name.split('-');
      if (tokens.includes(brand.label) && tokens.some((t) => SECURITY_WORDS.includes(t))) {
        add('brand-in-address', `"${site}" puts ${brand.name}'s name next to words like "secure" or "login".`);
      } else if (subdomainLabels.includes(brand.label)) {
        add('brand-in-address', `${brand.name}'s name is in the address, but the site is ${site}.`);
      }
      const hostTokens = decoded.toLowerCase().split(/[.-]/);
      if (hostTokens.includes(brand.label) && SIGN_IN_PATH.test(url.pathname)) {
        add('sign-in-imitation', `This looks like a sign-in or payment page for ${brand.name}, on ${site}.`);
      }
    }

    const shortener = SHORTENERS.has(site) || SHORTENERS.has(url.hostname);
    if (shortener) add('shortener', 'This is a link shortener, so the real destination is hidden until it is followed.');

    const textMismatch = mismatchWithText(input.text ?? '', site);
    if (textMismatch) add('text-mismatch', textMismatch);
  }

  if (RISKY_FILE.test(url.pathname)) add('download', 'This link downloads a program or an archive, not a page.');

  // An address with no site name (a bare number, say) can still be suspicious on its own.
  if (!site) {
    const alarm = found.find((f) => f.check !== 'shortener' && f.check !== 'text-mismatch');
    if (alarm) return { level: 'suspicious', reason: alarm.reason, checks: found.map((f) => f.check) };
    return notChecked("LinkPeek can't find a site name in this address.", []);
  }

  const suspicious = found.filter((f) => f.check !== 'shortener' && f.check !== 'text-mismatch');
  const mismatch = found.filter((f) => f.check === 'text-mismatch');
  const checks = found.map((f) => f.check);
  if (suspicious.length) return { level: 'suspicious', reason: suspicious[0]!.reason, checks, site };
  if (mismatch.length) return { level: 'mismatch', reason: mismatch[0]!.reason, checks, site };
  const hidden = found.find((f) => f.check === 'shortener');
  if (hidden) return { level: 'not-checked', reason: hidden.reason, checks, site };
  return { level: 'no-known-warning', checks, site };
}

/** Loopback addresses: this computer, not a remote site. */
function isLoopback(hostname: string): boolean {
  return hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

function notChecked(reason: string, checks: LinkCheck[]): LinkAssessment {
  return { level: 'not-checked', reason, checks };
}

/** Whether a site really belongs to a brand: its name part, or one of its listed domains. */
function owns(brand: Brand, site: string, name: string): boolean {
  return name === brand.label || (brand.extra ?? []).includes(site);
}

/** One letter swapped for a look-alike digit or a similar letter pair, or one letter added, removed or changed on a long enough brand. */
function lookalike(name: string, brand: Brand): boolean {
  if (!name || name === brand.label) return false;
  if (skeleton(name) === brand.label) return true;
  return brand.label.length >= MIN_BRAND_FOR_ONE_LETTER && distance(name, brand.label) === 1;
}

/** Letters from two or more alphabets in one label. Digits and dashes don't count. */
function mixesScripts(label: string): boolean {
  const present = SCRIPT_RANGES.filter(([, re]) => [...label].some((ch) => re.test(ch))).length;
  return present >= 2;
}

/**
 * Link text that names a site or a brand, but points somewhere else. Two
 * forms: text that is itself a web address ("bbc.co.uk"), and short text with
 * a brand and a sign-in or payment word ("Sign in to PayPal").
 */
function mismatchWithText(text: string, site: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const words = t.split(/\s+/);
  if (words.length === 1) {
    const shown = parse(t.replace(/^https?:\/\//i, '').split('/')[0] ?? '');
    if (shown.domain && shown.publicSuffix && shown.domain !== site) {
      return `The link says ${shown.domain} but goes to ${site}.`;
    }
  }
  if (words.length <= MAX_TEXT_WORDS) {
    const lower = t.toLowerCase();
    const action = /\b(sign ?in|log ?in|login|verify|secure|pay|payment|account|update|confirm)\b/.test(lower);
    if (action) {
      for (const brand of BRANDS) {
        const named = new RegExp(`\\b${brand.name.toLowerCase()}\\b`).test(lower);
        if (named && !owns(brand, site, site.split('.')[0] ?? '')) {
          return `The link says "${t}" but goes to ${site}.`;
        }
      }
    }
  }
  return undefined;
}

/** Edit distance (insert, delete, change), for short names. */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}
