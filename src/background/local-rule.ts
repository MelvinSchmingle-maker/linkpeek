/**
 * The network rules behind D59: Chrome declarativeNetRequest blocks for
 * addresses on this computer and the local network, scoped to LinkPeek's own
 * requests.
 *
 * Why rules as well as the checks in core/retrieve/address.ts: those check
 * the address LinkPeek asks for, and the final address after the redirects. A
 * request can reach a private address on the way through a public redirect,
 * and the checks only see that after it has happened. Chrome applies the rules
 * to every request in the chain, redirects included, before it is made.
 *
 * Scope: initiatorDomains is this extension's own ID. Ordinary web pages (and
 * their requests to local development servers) are not affected.
 *
 * What the rules cannot do: they match the address as it is written in the
 * URL. A public-looking name that resolves to a private address (DNS
 * rebinding) is not caught. That's a limit of the platform; see
 * docs/security-services.md, "Private addresses".
 */
import { REFUSE_LOCAL } from '../core/retrieve/address';

/** Dotted IPv4, as the browser writes it in a URL: four decimal parts, each a number up to 255. */
const IPV4_RANGES = [
  String.raw`0\.\d+\.\d+\.\d+`, // this network
  String.raw`10\.\d+\.\d+\.\d+`, // private
  String.raw`100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+`, // shared address space
  String.raw`127\.\d+\.\d+\.\d+`, // this computer
  String.raw`169\.254\.\d+\.\d+`, // link-local
  String.raw`172\.(1[6-9]|2\d|3[01])\.\d+\.\d+`, // private
  String.raw`192\.0\.0\.\d+`, // reserved
  String.raw`192\.0\.2\.\d+`, // documentation
  String.raw`192\.88\.99\.\d+`, // reserved
  String.raw`192\.168\.\d+\.\d+`, // private
  String.raw`198\.(1[89])\.\d+\.\d+`, // benchmarking
  String.raw`198\.51\.100\.\d+`, // documentation
  String.raw`203\.0\.113\.\d+`, // documentation
  String.raw`(22[4-9]|2[3-4]\d|25[0-5])\.\d+\.\d+\.\d+`, // multicast and reserved
];

/**
 * IPv6 literals, in the lower-case form the browser writes. Each entry is a
 * prefix. Every address starting "::" is refused (unspecified, loopback,
 * IPv4-mapped and IPv4-compatible forms), along with the other non-public ranges.
 */
const IPV6_PREFIXES = [
  '::', // unspecified, loopback, IPv4-mapped and IPv4-compatible
  'f[cd]', // unique local, fc00::/7
  'fe[89a-f]', // link-local (fe80::/10) and site-local (fec0::/10)
  'ff', // multicast
  '64:ff9b:', // NAT64
  '2002:', // 6to4
  '100:', // discard-only
  '2001:db8:', // documentation
  '2001:[01]?[0-9a-f]{0,2}:', // 2001::/23, reserved
];

/**
 * One pattern per rule, each anchored to the start of the URL. Chrome compiles
 * each rule's pattern under a 2 KB limit, which the IPv4 ranges together would
 * exceed, so each IPv4 range is its own rule. Then the other address families.
 */
const PATTERNS = [
  // A dotted IPv4 host, then an optional port and the end of the host.
  ...IPV4_RANGES.map((range) => String.raw`^https?://(${range})(:\d+)?([/?#]|$)`),
  // A single-label name, such as "intranet" or "printer". No dot, so no public domain.
  String.raw`^https?://[^./:@\[\]]+(:\d+)?([/?#]|$)`,
  // Names that only mean this computer or a private network. "lan.example.com" is not one.
  String.raw`^https?://([^/?#@]*\.)?(localhost|local|localdomain|internal|lan|home\.arpa)\.?(:\d+)?([/?#]|$)`,
  // IPv6 literals.
  String.raw`^https?://\[(${IPV6_PREFIXES.join('|')})`,
];

/** Fixed ids, one per pattern: a restart replaces the same rules. */
export const LOCAL_RULE_IDS = PATTERNS.map((_, i) => i + 1);

/** The patterns, one per rule, in the order of LOCAL_RULE_IDS. */
export const LOCAL_RULE_PATTERNS = PATTERNS;

/** The rules as Chrome sees them, for this extension's own requests only. */
export function localRules(extensionId: string): chrome.declarativeNetRequest.Rule[] {
  return PATTERNS.map((regexFilter, i) => ({
    id: LOCAL_RULE_IDS[i]!,
    priority: 1,
    action: { type: 'block' } as chrome.declarativeNetRequest.RuleAction,
    condition: { regexFilter, initiatorDomains: [extensionId] },
  }));
}

let installing: Promise<void> | undefined;

/**
 * Puts the rules in place. Resolves once they are; rejects if they can't be
 * (the permission is missing, or Chrome refuses a pattern). A failure is
 * retried on the next call. Test builds have no rules, so this resolves at
 * once for them.
 */
export function ensureLocalRule(): Promise<void> {
  if (!REFUSE_LOCAL) return Promise.resolve();
  installing ??= install().catch((err) => {
    installing = undefined;
    throw err;
  });
  return installing;
}

async function install(): Promise<void> {
  const dnr = globalThis.chrome?.declarativeNetRequest;
  if (!dnr) throw new Error('declarativeNetRequest is not available, so LinkPeek cannot install its network rules');
  for (const regex of PATTERNS) {
    const support = await dnr.isRegexSupported({ regex });
    if (!support.isSupported) throw new Error(`Chrome refused a network rule: ${support.reason ?? 'unknown reason'}`);
  }
  await dnr.updateDynamicRules({ removeRuleIds: LOCAL_RULE_IDS, addRules: localRules(chrome.runtime.id) });
}

/**
 * Whether LinkPeek may send a request now. False means the rules aren't in
 * place, so the request is not made: reading fails closed rather than going
 * out without the barrier.
 */
export async function localRuleReady(): Promise<boolean> {
  try {
    await ensureLocalRule();
    return true;
  } catch {
    return false;
  }
}
