import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_RULE_IDS, LOCAL_RULE_PATTERNS, localRules } from './local-rule';

/** Whether any of the rules' patterns matches a URL, as Chrome would match the address it makes the request to. */
const matches = (url: string) => LOCAL_RULE_PATTERNS.some((p) => new RegExp(p).test(new URL(url).href));

describe('the network rules: which addresses they cover', () => {
  it('are valid patterns, each small enough for Chrome to compile', () => {
    for (const p of LOCAL_RULE_PATTERNS) {
      expect(() => new RegExp(p)).not.toThrow();
      expect(p.length).toBeLessThan(2048);
    }
  });

  it('blocks IPv4 addresses on this computer, the local network and reserved ranges', () => {
    for (const url of [
      'http://127.0.0.1:8080/admin',
      'http://127.255.255.255/',
      'http://10.1.2.3/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://100.64.0.1/',
      'http://100.127.255.255/',
      'http://0.0.0.0/',
      'http://192.0.2.1/',
      'http://198.18.0.1/',
      'http://198.19.255.255/',
      'http://224.0.0.1/',
      'http://240.0.0.1/',
      'http://255.255.255.255/',
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('leaves public IPv4 addresses next to those ranges alone', () => {
    for (const url of [
      'http://8.8.8.8/',
      'http://1.1.1.1/',
      'http://172.15.0.1/',
      'http://172.32.0.1/',
      'http://100.63.255.255/',
      'http://100.128.0.1/',
      'http://192.169.0.1/',
      'http://198.17.0.1/',
      'http://198.20.0.1/',
      'http://223.255.255.255/',
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it('blocks alternative spellings of an address, because the browser writes them in dotted form', () => {
    expect(matches('http://127.1/')).toBe(true);
    expect(matches('http://0x7f000001/')).toBe(true);
    expect(matches('http://2130706433/')).toBe(true);
    expect(matches('http://0177.0.0.1/')).toBe(true);
  });

  it('does not block public names that only start with digits or look like local names', () => {
    for (const url of [
      'https://127.example.com/',
      'https://10.example.org/',
      'https://192.168.example.net/',
      'https://224.example.com/',
      'https://lan.example.com/',
      'https://local.news.example/',
      'https://www.bbc.co.uk/news/articles/c3qjn45pepx1o',
      'https://news.example/story?id=7',
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it('blocks local names and single-label names', () => {
    for (const url of [
      'http://localhost:8080/',
      'http://app.localhost/',
      'http://router.lan/',
      'http://nas.home.arpa/',
      'http://printer.internal./',
      'http://printer.local/',
      'http://intranet/',
      'http://printer:8080/',
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('blocks IPv6 addresses on this computer, the local network and reserved ranges', () => {
    for (const url of [
      'http://[::1]:8080/',
      'http://[::]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:8.8.8.8]/', // every IPv4-mapped address: conservative, see the note in local-rule.ts
      'http://[fd00::1]/',
      'http://[fc00::1]/',
      'http://[fe80::1]/',
      'http://[fec0::1]/',
      'http://[ff02::1]/',
      'http://[2001:db8::1]/',
      'http://[64:ff9b::a00:1]/',
      'http://[2002:7f00:1::]/',
      'http://[100::1]/',
      'http://[2001:0::1]/',
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('leaves public IPv6 addresses alone', () => {
    for (const url of ['http://[2606:4700:4700::1111]/', 'http://[2001:4860:4860::8888]/', 'http://[2a00:1450:4001::1]/']) {
      expect(matches(url), url).toBe(false);
    }
  });
});

describe('the network rules: what they are scoped to', () => {
  it('apply only to requests made by this extension', () => {
    const rules = localRules('abcdefghijklmnopabcdefghijklmnop');
    expect(rules.map((r) => r.id)).toEqual(LOCAL_RULE_IDS);
    for (const rule of rules) {
      expect(rule.action).toEqual({ type: 'block' });
      expect(rule.condition.initiatorDomains).toEqual(['abcdefghijklmnopabcdefghijklmnop']);
    }
  });
});

describe('installing the rule', () => {
  const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
  let dnr: { isRegexSupported: ReturnType<typeof vi.fn>; updateDynamicRules: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    dnr = {
      isRegexSupported: vi.fn(async () => ({ isSupported: true })),
      updateDynamicRules: vi.fn(async () => undefined),
    };
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome = {
      runtime: { id: EXTENSION_ID },
      declarativeNetRequest: dnr,
    };
  });
  afterEach(() => vi.unstubAllGlobals());

  it('installs the rules once, with fixed ids so a restart replaces them', async () => {
    const { ensureLocalRule } = await import('./local-rule');
    await ensureLocalRule();
    await ensureLocalRule();
    expect(dnr.updateDynamicRules).toHaveBeenCalledTimes(1);
    expect(dnr.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: LOCAL_RULE_IDS,
      addRules: LOCAL_RULE_IDS.map((id) => expect.objectContaining({ id, condition: expect.objectContaining({ initiatorDomains: [EXTENSION_ID] }) })),
    });
  });

  it('reports ready once the rule is in place', async () => {
    const { localRuleReady } = await import('./local-rule');
    expect(await localRuleReady()).toBe(true);
  });

  it('fails closed when the permission is missing: nothing may be requested without the rule', async () => {
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome = { runtime: { id: EXTENSION_ID } };
    const { localRuleReady } = await import('./local-rule');
    expect(await localRuleReady()).toBe(false);
  });

  it('fails closed when Chrome refuses the pattern', async () => {
    dnr.isRegexSupported.mockResolvedValueOnce({ isSupported: false, reason: 'memoryLimitExceeded' });
    const { localRuleReady } = await import('./local-rule');
    expect(await localRuleReady()).toBe(false);
    expect(dnr.updateDynamicRules).not.toHaveBeenCalled();
  });

  it('retries after a failure, so a transient error does not leave reading switched off for good', async () => {
    dnr.updateDynamicRules.mockRejectedValueOnce(new Error('busy'));
    const { localRuleReady } = await import('./local-rule');
    expect(await localRuleReady()).toBe(false);
    expect(await localRuleReady()).toBe(true);
  });
});
