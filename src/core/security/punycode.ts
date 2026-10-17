/**
 * Decodes an internationalised hostname label ("xn--...") back to its letters,
 * so a lookalike can be judged by what it shows. RFC 3492 (Punycode), the
 * decoding half only. Browsers give us the encoded form in URL.hostname.
 */
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) / 2) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function digitValue(cp: number): number {
  if (cp >= 0x30 && cp <= 0x39) return cp - 0x30 + 26; // 0-9
  if (cp >= 0x41 && cp <= 0x5a) return cp - 0x41; // A-Z
  if (cp >= 0x61 && cp <= 0x7a) return cp - 0x61; // a-z
  return -1;
}

/** The decoded text of one label, or undefined if it isn't valid Punycode. Input without "xn--" is returned as it is. */
export function decodeLabel(label: string): string | undefined {
  if (!label.toLowerCase().startsWith('xn--')) return label;
  const encoded = label.slice(4);
  const dash = encoded.lastIndexOf('-');
  const output: number[] = [];
  if (dash > 0) for (const ch of encoded.slice(0, dash)) output.push(ch.codePointAt(0)!);
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  let pos = dash > 0 ? dash + 1 : 0;
  while (pos < encoded.length) {
    const oldI = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (pos >= encoded.length) return undefined;
      const digit = digitValue(encoded.codePointAt(pos)!);
      pos += 1;
      if (digit < 0) return undefined;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      if (w > 0x7fffffff) return undefined;
    }
    bias = adapt(i - oldI, output.length + 1, oldI === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    if (n > 0x10ffff) return undefined;
    output.splice(i, 0, n);
    i += 1;
  }
  return String.fromCodePoint(...output);
}

/** Decodes every label of a hostname. Returns the hostname unchanged when nothing is encoded. */
export function decodeHost(host: string): string {
  return host
    .split('.')
    .map((label) => decodeLabel(label) ?? label)
    .join('.');
}
