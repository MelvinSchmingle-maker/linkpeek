import { describe, expect, it } from 'vitest';
import { headlineSignals } from './rules';

const patterns = (headline: string) => headlineSignals(headline).map((s) => `${s.pattern}:${s.strength}`);

describe('headline rules (stage 1)', () => {
  it.each([
    "You won't believe what this council found",
    "You'll never guess which chain is closing",
    'What happened next will change your pension',
    'This one simple trick cuts your bill',
    'Wait until you see the result',
    'The shocking truth about coffee',
    'This is the one thing doctors wish you knew',
  ])('a strong withheld-fact pattern: %s', (headline) => {
    expect(patterns(headline)).toContain('withheld-fact:strong');
  });

  it('reads curly apostrophes as straight ones', () => {
    expect(patterns('You won’t believe what happened')).toContain('withheld-fact:strong');
  });

  it('a timeline that names what happened is not a teaser', () => {
    expect(patterns('Timeline: what happened next in the Ellis case')).not.toContain('withheld-fact:strong');
  });

  it.each([
    ["This is why the pound is falling", 'forward-reference:medium'],
    ["Here's how the council plans to spend it", 'forward-reference:medium'],
    ['Stop what you\'re doing and read this', 'suspense:medium'],
    ['The most important election result in 30 years', 'superlative:medium'],
    ['The best ever result for the under-12s', 'superlative:medium'],
    ['17 reasons your cat is judging you', 'numbered-list:weak'],
    ['Is it safe to eat raw cookie dough?', 'question:weak'],
  ])('%s is a %s', (headline, expected) => {
    expect(patterns(headline)).toContain(expected);
  });

  it('a plain headline matches nothing', () => {
    expect(patterns('Council approves new bus lanes on Mill Road')).toEqual([]);
  });

  it('emotion and controversy alone are never a pattern', () => {
    expect(patterns('Heartbreak as town loses its last bank')).toEqual([]);
    expect(patterns('Outrage as council votes to close two parks')).toEqual([]);
  });

  it('lists the strongest pattern first', () => {
    expect(headlineSignals('17 reasons: you won’t believe number 4')[0]).toMatchObject({ strength: 'strong' });
  });
});
