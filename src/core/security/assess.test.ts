import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessLink, distance, type LinkCheck } from './assess';
import { decodeHost, decodeLabel } from './punycode';

interface Case {
  href: string;
  text: string;
  expect: 'no-known-warning' | 'suspicious' | 'mismatch' | 'not-checked';
  group: string;
}
// Tests run from the project folder.
const cases: Case[] = JSON.parse(readFileSync(join(process.cwd(), 'eval/urls.json'), 'utf8')).cases;
const flagged = (level: string) => level === 'suspicious' || level === 'mismatch';

describe('the labelled link set (eval/urls.json)', () => {
  const results = cases.map((c) => ({ c, got: assessLink({ href: c.href, text: c.text }) }));

  it('gives the expected outcome for every labelled address', () => {
    const wrong = results.filter(({ c, got }) => got.level !== c.expect);
    expect(wrong.map(({ c, got }) => `${c.href} [${c.group}]: expected ${c.expect}, got ${got.level} (${got.checks.join(',') || 'no rule'})`)).toEqual([]);
  });

  it('flags every lookalike, mismatch and other suspicious address in the set', () => {
    const expected = cases.filter((c) => c.expect === 'suspicious' || c.expect === 'mismatch');
    const found = expected.filter((c) => flagged(assessLink({ href: c.href, text: c.text }).level));
    expect(found.length / expected.length).toBeGreaterThanOrEqual(0.95);
  });

  it('never flags a clean popular site (the false-alarm rate, which must be zero here)', () => {
    const clean = cases.filter((c) => c.group === 'clean');
    expect(clean.length).toBeGreaterThanOrEqual(30);
    const alarms = clean.filter((c) => flagged(assessLink({ href: c.href, text: c.text }).level));
    expect(alarms.map((c) => c.href)).toEqual([]);
  });

  it('has at least 50 labelled addresses, covering every kind the plan asks for', () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
    const groups = new Set(cases.map((c) => c.group));
    for (const g of ['lookalike', 'mismatch', 'clean', 'shortener', 'brand-in-address', 'sign-in-imitation', 'ip-address', 'mixed-script', 'at-sign', 'download']) {
      expect(groups.has(g) || cases.some((c) => c.group === g || (g === 'mismatch' && c.expect === 'mismatch')), g).toBe(true);
    }
  });
});

describe('each check, one rule at a time', () => {
  const check = (href: string, text = '') => assessLink({ href, text });
  const fired = (href: string, text?: string, rule?: LinkCheck) => {
    const r = check(href, text);
    return rule ? r.checks.includes(rule) : r.checks;
  };

  it('a lookalike digit or letter swap is caught and named', () => {
    expect(fired('https://paypa1.com/', 'PayPal', 'lookalike')).toBeTruthy();
    expect(check('https://paypa1.com/', 'PayPal').reason).toMatch(/looks like PayPal's address/);
  });

  it('the real brand, on its own domain or a listed one, is never a lookalike', () => {
    expect(fired('https://www.paypal.de/', 'PayPal', 'lookalike')).toBe(false);
    expect(fired('https://icloud.com/', 'iCloud', 'lookalike')).toBe(false);
    expect(fired('https://www.youtube.com/', 'YouTube', 'lookalike')).toBe(false);
  });

  it('a brand that appears only as a subdomain of another site is caught', () => {
    expect(fired('https://paypal.com.secure-login.xyz/', '', 'brand-in-address')).toBeTruthy();
    expect(fired('https://www.paypal.com/', '', 'brand-in-address')).toBe(false);
  });

  it('a sign-in page on an unrelated site is caught only when the brand is in the address', () => {
    expect(fired('https://apple-id.example/signin', '', 'sign-in-imitation')).toBeTruthy();
    expect(fired('https://www.apple.com/signin', '', 'sign-in-imitation')).toBe(false);
    expect(fired('https://www.bbc.co.uk/news/account-security', 'Account security', 'sign-in-imitation')).toBe(false);
  });

  it('an address with a user name in front of the host is caught', () => {
    expect(fired('https://paypal.com@evil.example/', '', 'at-sign')).toBeTruthy();
  });

  it('an address that is a bare number is caught', () => {
    expect(fired('http://10.0.0.1/', '', 'ip-address')).toBeTruthy();
    expect(fired('http://[2001:db8::1]/', '', 'ip-address')).toBeTruthy();
  });

  it('a loopback address (this computer, such as the local test server) is not a warning', () => {
    expect(check('http://127.0.0.1:4173/articles/x.html', 'Local page').level).not.toBe('suspicious');
    expect(fired('http://127.0.0.1:4173/', '', 'ip-address')).toBe(false);
    expect(fired('http://[::1]/', '', 'ip-address')).toBe(false);
  });

  it('a download of a program or an archive is named as one', () => {
    expect(check('https://example.org/setup.exe').reason).toMatch(/downloads a program or an archive/);
  });

  it('a shortener is "not checked", never "no known warning" and never "safe"', () => {
    const r = check('https://bit.ly/abc', 'Read more');
    expect(r.level).toBe('not-checked');
    expect(r.reason).toMatch(/real destination is hidden/);
  });

  it('link text that names one site and goes to another is a mismatch', () => {
    const r = check('https://news-site.example/', 'Sign in to PayPal');
    expect(r.level).toBe('mismatch');
    expect(r.reason).toBe('The link says "Sign in to PayPal" but goes to news-site.example.');
  });

  it('a brand named in ordinary text is not a mismatch', () => {
    expect(check('https://news-site.example/', 'Apple').level).toBe('no-known-warning');
    expect(check('https://news-site.example/', 'Google said it would pay the fine').level).toBe('no-known-warning');
  });

  it('a suspicious address outranks a text mismatch', () => {
    expect(check('https://paypa1.com/', 'paypal.com').level).toBe('suspicious');
  });

  it('a link that is not a web address is not checked, with a reason', () => {
    expect(check('mailto:a@b.example').level).toBe('not-checked');
    expect(check('not a link').reason).toMatch(/couldn't read/);
  });

  it('"no known warning" never says the link is safe', () => {
    const r = check('https://www.bbc.co.uk/news');
    expect(r.level).toBe('no-known-warning');
    expect(JSON.stringify(r)).not.toMatch(/safe/i);
  });
});

describe('punycode and mixed alphabets', () => {
  it('decodes an internationalised label back to its letters', () => {
    expect(decodeLabel('xn--bcher-kva')).toBe('bücher');
    expect(decodeLabel('xn--pple-43d')).toBe('аpple');
    expect(decodeLabel('plain')).toBe('plain');
  });

  it('decodes each label of a host and leaves the rest alone', () => {
    expect(decodeHost('xn--bcher-kva.example')).toBe('bücher.example');
    expect(decodeHost('www.bbc.co.uk')).toBe('www.bbc.co.uk');
  });

  it('a single non-Latin alphabet is not a mixed-alphabet warning (a Russian site is fine)', () => {
    expect(assessLink({ href: 'https://xn--80ak6aa92e.com/' }).checks).not.toContain('mixed-script');
  });
});

describe('edit distance', () => {
  it('counts one change, one insertion and one deletion as 1', () => {
    expect(distance('paypal', 'paypall')).toBe(1);
    expect(distance('paypal', 'paypa1')).toBe(1);
    expect(distance('paypal', 'paypal')).toBe(0);
  });
});
