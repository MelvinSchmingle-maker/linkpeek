/**
 * Addresses that LinkPeek's automatic reading must not reach: this computer,
 * the local network, and ranges reserved for other uses. Returns the reason,
 * or undefined when the address is one LinkPeek may read.
 *
 * Give it the hostname as the URL parser returns it. The parser already turns
 * the other ways of writing an address (127.1, 0x7f000001, 2130706433) into
 * dotted form, so they are judged by their value, not their spelling.
 *
 * What this cannot do: it can't see where a name (like example.com) resolves
 * to, so a public name that points at a private address isn't caught here.
 * Extensions also can't see the middle steps of a redirect. See
 * docs/security-services.md, "Private addresses".
 */

/** Ranges as [first address, prefix length, reason]. */
const IPV4_RANGES: Array<[string, number, string]> = [
  ['0.0.0.0', 8, 'this network'],
  ['10.0.0.0', 8, 'private network'],
  ['100.64.0.0', 10, 'shared address space'],
  ['127.0.0.0', 8, 'this computer'],
  ['169.254.0.0', 16, 'link-local'],
  ['172.16.0.0', 12, 'private network'],
  ['192.0.0.0', 24, 'reserved'],
  ['192.0.2.0', 24, 'documentation'],
  ['192.88.99.0', 24, 'reserved'],
  ['192.168.0.0', 16, 'private network'],
  ['198.18.0.0', 15, 'benchmarking'],
  ['198.51.100.0', 24, 'documentation'],
  ['203.0.113.0', 24, 'documentation'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved, including broadcast'],
];

/** Names that only mean this computer or a private network. */
const LOCAL_NAME = /(^|\.)(localhost|local|localdomain|internal|lan|home\.arpa)$/;

const toNumber = (dotted: string): number => dotted.split('.').reduce((n, octet) => (n << 8) + Number(octet), 0) >>> 0;

export function prohibitedAddress(hostname: string): string | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return 'no address';
  if (host.startsWith('[')) return prohibitedIPv6(host.slice(1, -1));
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return prohibitedIPv4(host);
  if (!host.includes('.')) return 'a name with no dots';
  if (LOCAL_NAME.test(host)) return 'a local name';
  return undefined;
}

/**
 * Whether automatic reading refuses local and private addresses. Only the
 * browser test build turns this off, because its tests read local test pages.
 * The live-check build keeps it on, so it behaves like a release build.
 */
export const REFUSE_LOCAL = !(__E2E__ && !__LIVE__);

/**
 * Whether automatic reading must refuse this URL. An address that can't be
 * parsed is refused too.
 */
export function refusedUrl(url: string): boolean {
  try {
    return prohibitedAddress(new URL(url).hostname) !== undefined;
  } catch {
    return true;
  }
}

function prohibitedIPv4(dotted: string): string | undefined {
  if (dotted.split('.').some((octet) => Number(octet) > 255)) return 'an invalid address';
  const value = toNumber(dotted);
  for (const [first, prefix, reason] of IPV4_RANGES) {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    if ((value & mask) >>> 0 === (toNumber(first) & mask) >>> 0) return reason;
  }
  return undefined;
}

/** Eight 16-bit words, from the text of an IPv6 address (without brackets). */
function ipv6Words(text: string): number[] | undefined {
  let s = text;
  // A trailing IPv4 part, as in ::ffff:127.0.0.1, becomes two words.
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail?.[1]) {
    const o = tail[1].split('.').map(Number);
    if (o.some((n) => n > 255)) return undefined;
    s = `${s.slice(0, tail.index)}${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const gap = 8 - head.length - rest.length;
  if (halves.length === 1 ? gap !== 0 : gap < 1) return undefined;
  const words = [...head, ...Array<string>(gap).fill('0'), ...rest].map((w) => (/^[0-9a-f]{1,4}$/i.test(w) ? parseInt(w, 16) : NaN));
  return words.length === 8 && words.every((w) => !Number.isNaN(w)) ? words : undefined;
}

function prohibitedIPv6(text: string): string | undefined {
  const w = ipv6Words(text);
  if (!w) return 'an invalid address';
  const embeddedV4 = (hi: number, lo: number) => prohibitedIPv4([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));

  if (w.every((x) => x === 0)) return 'unspecified';
  if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return 'this computer';
  // IPv4 addresses written inside IPv6 are judged by the IPv4 rules.
  if (w.slice(0, 5).every((x) => x === 0) && w[5] === 0xffff) {
    const why = embeddedV4(w[6]!, w[7]!);
    return why ? `an IPv4 address (${why})` : undefined;
  }
  if (w.slice(0, 6).every((x) => x === 0)) return 'reserved, IPv4-compatible';
  if (w[0] === 0x64 && w[1] === 0xff9b && w.slice(2, 6).every((x) => x === 0)) {
    const why = embeddedV4(w[6]!, w[7]!);
    return why ? `an IPv4 address (${why})` : undefined;
  }
  if (w[0] === 0x2002) {
    const why = embeddedV4(w[1]!, w[2]!);
    return why ? `an IPv4 address through 6to4 (${why})` : 'a 6to4 address';
  }
  if (w[0] === 0x100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return 'discard-only';
  if (w[0] === 0x2001 && (w[1]! & 0xfe00) === 0) return 'reserved, protocol assignments';
  if (w[0] === 0x2001 && w[1] === 0xdb8) return 'documentation';
  if ((w[0]! & 0xfe00) === 0xfc00) return 'private network';
  if ((w[0]! & 0xffc0) === 0xfe80) return 'link-local';
  if ((w[0]! & 0xffc0) === 0xfec0) return 'site-local';
  if ((w[0]! & 0xff00) === 0xff00) return 'multicast';
  return undefined;
}
