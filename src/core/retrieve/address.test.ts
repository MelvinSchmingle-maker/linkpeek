import { describe, expect, it } from 'vitest';
import { prohibitedAddress } from './address';

/** The hostname as a browser would read it from a URL. */
const host = (url: string) => new URL(url).hostname;

describe('prohibited addresses', () => {
  it('blocks this computer, the local network and reserved IPv4 ranges', () => {
    expect(prohibitedAddress('127.0.0.1')).toBe('this computer');
    expect(prohibitedAddress('10.1.2.3')).toBe('private network');
    expect(prohibitedAddress('172.16.0.1')).toBe('private network');
    expect(prohibitedAddress('172.31.255.255')).toBe('private network');
    expect(prohibitedAddress('192.168.1.1')).toBe('private network');
    expect(prohibitedAddress('169.254.169.254')).toBe('link-local');
    expect(prohibitedAddress('100.64.0.1')).toBe('shared address space');
    expect(prohibitedAddress('0.0.0.0')).toBe('this network');
    expect(prohibitedAddress('224.0.0.1')).toBe('multicast');
    expect(prohibitedAddress('255.255.255.255')).toBe('reserved, including broadcast');
  });

  it('allows public IPv4 addresses, including the ones next to the blocked ranges', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.63.255.255', '192.169.0.1', '223.255.255.255']) {
      expect(prohibitedAddress(ip), ip).toBeUndefined();
    }
  });

  it('blocks IPv6 loopback, unspecified, unique-local, link-local and multicast', () => {
    expect(prohibitedAddress('[::1]')).toBe('this computer');
    expect(prohibitedAddress('[::]')).toBe('unspecified');
    expect(prohibitedAddress('[fd00::1]')).toBe('private network');
    expect(prohibitedAddress('[fc00::1]')).toBe('private network');
    expect(prohibitedAddress('[fe80::1]')).toBe('link-local');
    expect(prohibitedAddress('[ff02::1]')).toBe('multicast');
    expect(prohibitedAddress('[2001:db8::1]')).toBe('documentation');
  });

  it('judges IPv4 written inside IPv6 by the IPv4 rules', () => {
    // IPv4-mapped (::ffff:a.b.c.d) is the trick that gets past string checks for "127.0.0.1".
    expect(prohibitedAddress(host('http://[::ffff:127.0.0.1]/'))).toMatch(/^an IPv4 address \(this computer\)$/);
    expect(prohibitedAddress(host('http://[::ffff:10.0.0.5]/'))).toMatch(/private network/);
    expect(prohibitedAddress(host('http://[::ffff:169.254.169.254]/'))).toMatch(/link-local/);
    expect(prohibitedAddress(host('http://[::ffff:8.8.8.8]/'))).toBeUndefined();
    // NAT64 and 6to4 wrappers around a private address.
    expect(prohibitedAddress(host('http://[64:ff9b::a00:1]/'))).toMatch(/private network/);
    expect(prohibitedAddress(host('http://[2002:7f00:1::]/'))).toMatch(/this computer/);
  });

  it('judges alternative spellings by their value, because the URL parser normalises them', () => {
    expect(prohibitedAddress(host('http://127.1/'))).toBe('this computer');
    expect(prohibitedAddress(host('http://0x7f000001/'))).toBe('this computer');
    expect(prohibitedAddress(host('http://2130706433/'))).toBe('this computer');
    expect(prohibitedAddress(host('http://0177.0.0.1/'))).toBe('this computer');
    expect(prohibitedAddress(host('http://0xa9fea9fe/'))).toBe('link-local');
  });

  it('blocks names that mean this computer or a private network', () => {
    expect(prohibitedAddress('localhost')).toBe('a name with no dots');
    expect(prohibitedAddress('app.localhost')).toBe('a local name');
    expect(prohibitedAddress('router.lan')).toBe('a local name');
    expect(prohibitedAddress('nas.home.arpa')).toBe('a local name');
    expect(prohibitedAddress('printer.internal.')).toBe('a local name');
    expect(prohibitedAddress('intranet')).toBe('a name with no dots');
  });

  it('allows ordinary public names and addresses', () => {
    expect(prohibitedAddress('www.bbc.co.uk')).toBeUndefined();
    expect(prohibitedAddress('example.com')).toBeUndefined();
    expect(prohibitedAddress('[2606:4700:4700::1111]')).toBeUndefined();
  });

  it('refuses addresses that are not valid', () => {
    expect(prohibitedAddress('[::1::2]')).toBe('an invalid address');
    expect(prohibitedAddress('[gggg::1]')).toBe('an invalid address');
  });
});
