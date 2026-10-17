import { describe, expect, it } from 'vitest';
import { contentFacts, extractFigures, figureMatches } from './content';

const figures = (text: string) => extractFigures(text).map((f) => [f.unit, f.value]);

describe('figures in text', () => {
  it.each([
    ['Profits fell 18% to £42m.', [['money', 42e6], ['percent', 18]]],
    ['Revenue was £2.1bn and $1.2bn.', [['money', 2.1e9], ['money', 1.2e9]]],
    ['A £400,000 fund, and a further £2 million.', [['money', 400000], ['money', 2e6]]],
    ['The dividend was 20p a share.', [['money', 0.2]]],
    ['Rents rose by three per cent, then twenty-five percent.', [['percent', 3], ['percent', 25]]],
    ['Bins at 3pm, a 40 %.', [['percent', 40]]],
  ])('reads %s', (text, expected) => {
    expect(figures(text)).toEqual(expected);
  });

  it('a percentage followed by a word is still read', () => {
    expect(figures('Profits up 40% in March')).toEqual([['percent', 40]]);
  });
});

describe('figure matching', () => {
  it('money agrees within half a percent, so £1.2bn and £1,200m match', () => {
    expect(figureMatches({ unit: 'money', value: 1.2e9 }, { unit: 'money', value: 1200e6 })).toBe(true);
    expect(figureMatches({ unit: 'money', value: 5e6 }, { unit: 'money', value: 5.1e6 })).toBe(false);
  });

  it('percentages agree within half a point, and never across units', () => {
    expect(figureMatches({ unit: 'percent', value: 18 }, { unit: 'percent', value: 18.3 })).toBe(true);
    expect(figureMatches({ unit: 'percent', value: 18 }, { unit: 'money', value: 18 })).toBe(false);
  });
});

describe('what the article keeps (contentFacts)', () => {
  it('names the study limits the article states, strongest first', () => {
    const facts = contentFacts(['The drug killed cancer cells in mice.', 'The findings are preliminary.']);
    expect(facts.limits).toEqual(['animal', 'early']);
  });

  it('a plain article states no limits', () => {
    expect(contentFacts(['Council approves new bus lanes on Mill Road.']).limits).toEqual([]);
  });

  it('keeps each figure once, and caps the number kept', () => {
    const repeated = contentFacts(['£2m, £2m and £2.0m.']);
    expect(repeated.figures).toEqual([{ unit: 'money', value: 2e6 }]);
    const many = contentFacts([Array.from({ length: 100 }, (_, i) => `${i + 1}%`).join(' ')]);
    expect(many.figures).toHaveLength(60);
  });

  it('keeps labels and numbers only, never the article words', () => {
    const facts = contentFacts(['A secret sentence about mice that nobody should be able to read back.']);
    expect(JSON.stringify(facts)).not.toContain('secret');
  });
});
