/**
 * Stage 1 of the headline check: patterns in the wording of the headline
 * alone. Free and on-device, and it needs no article.
 *
 * Each rule names its pattern and how strong it is. Only a strong pattern can
 * make a cross without the article (see check.ts). Emotion and controversy
 * never count: an upsetting headline can still be straight. Patterns are
 * matched on the headline as written, with curly apostrophes made straight.
 */

export type SignalStrength = 'weak' | 'medium' | 'strong';

export interface HeadlineSignal {
  pattern: string;
  strength: SignalStrength;
}

interface Rule extends HeadlineSignal {
  test: RegExp;
}

const RULES: Rule[] = [
  {
    // The main point is held back on purpose.
    pattern: 'withheld-fact',
    strength: 'strong',
    // "What happened next" is a teaser only when nothing names what happened ("...next in the Ellis case" is a timeline).
    test: /\byou (?:won't|will not) believe\b|\byou(?:'ll| will) never (?:guess|believe|know)\b|\bwhat happened next\b(?! (?:in|at|with|after)\b)|\bthis (?:is )?the one (?:simple )?(?:thing|trick)\b|\bthis one (?:simple )?(?:thing|trick)\b|\bwait(?:ing)? until you (?:see|hear|find out|read)\b|\bthe shocking truth\b|\bthe (?:answer|ending|result) will (?:shock|surprise|stun)\b/i,
  },
  {
    // "This is why...", "Here's how...". Says there's an answer without giving it.
    pattern: 'forward-reference',
    strength: 'medium',
    test: /^(?:this|here's|here is|these)\s+(?:is|are)?\s*(?:why|how|what|the moment|the thing)\b/i,
  },
  {
    pattern: 'suspense',
    strength: 'medium',
    test: /\bstop (?:what you're doing|scrolling)\b|\bnumber \d+ (?:will|is)\b|\byou need to (?:see|hear|read) this\b|\bjust wait\b|\bthe countdown\b/i,
  },
  {
    // Superlatives that claim more than a headline can show.
    pattern: 'superlative',
    strength: 'medium',
    test: /\b(?:the )?(?:best|worst|greatest|biggest|most) .*\bever\b|\bmost (?:shocking|incredible|amazing|unbelievable|disturbing|important|beautiful)\b|\bof all time\b/i,
  },
  {
    // "17 reasons...": a weak signal only, never enough to cross.
    pattern: 'numbered-list',
    strength: 'weak',
    test: /^\d{1,2} (?:reasons|things|ways|facts|signs|photos|pictures)\b/i,
  },
  {
    pattern: 'question',
    strength: 'weak',
    test: /\?\s*$/,
  },
];

/** Every pattern the headline matches, strongest first. */
export function headlineSignals(headline: string): HeadlineSignal[] {
  const text = headline.replace(/[’‘]/g, "'").trim();
  const order: Record<SignalStrength, number> = { strong: 0, medium: 1, weak: 2 };
  return RULES.filter((r) => r.test.test(text))
    .map(({ pattern, strength }) => ({ pattern, strength }))
    .sort((a, b) => order[a.strength] - order[b.strength]);
}
