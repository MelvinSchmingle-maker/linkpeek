/** Shared key words (unigram F1), lightly stemmed. A rough guide only. */
export function overlap(a: string, b: string): number {
  const bag = (s: string) =>
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2)
      .map((w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w));
  const x = bag(a);
  const y = bag(b);
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  for (const w of x) {
    const i = pool.indexOf(w);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  const p = hit / x.length;
  const r = hit / y.length;
  return p + r ? (2 * p * r) / (p + r) : 0;
}
