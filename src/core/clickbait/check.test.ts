import { describe, expect, it } from 'vitest';
import { checkHeadline, REASON, rewriteFrom, REWRITE_WORDS, type HeadlineInput } from './check';
import { contentFacts } from './content';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const MANY = 'The study was small, and its findings are preliminary. In mice, the effect was clear. Figures: 4% and 5% and 6%.';
const fullFacts = (...paragraphs: string[]) => contentFacts(paragraphs);
const summary = 'The drug killed cancer cells in mice, researchers reported in a small study.';

/** A small helper: the input for a full article, with its facts. */
function full(headline: string, paragraphs: string[], extra: Partial<HeadlineInput> = {}): HeadlineInput {
  return { headline, evidence: 'full', facts: fullFacts(...paragraphs), now: NOW, ...extra };
}

describe('without the full article: only a strong withheld-fact pattern can cross', () => {
  it('a withheld-fact headline is a cross, with the reason', () => {
    expect(checkHeadline({ headline: "You won't believe what this council found", evidence: 'headline-only' })).toEqual({
      verdict: 'fail',
      reason: REASON.withheld,
    });
  });

  it('a withheld-fact headline still crosses when the article is blocked or partial', () => {
    expect(checkHeadline({ headline: 'What happened next will shock you', evidence: 'partial' }).verdict).toBe('fail');
    expect(checkHeadline({ headline: 'What happened next will shock you', evidence: 'unavailable' }).verdict).toBe('fail');
  });

  it('a medium or weak pattern without the article is neutral, with the standard wording', () => {
    expect(checkHeadline({ headline: "Here's how the council plans to spend it", evidence: 'headline-only' })).toEqual({
      verdict: 'unknown',
      reason: REASON.vagueNoArticle,
    });
  });

  it('a partial page says the article could not be read in full', () => {
    expect(checkHeadline({ headline: 'The most important result in 30 years', evidence: 'partial' }).reason).toBe(REASON.vaguePartial);
  });

  it('a plain headline is neutral with no reason (the card says "not enough information")', () => {
    expect(checkHeadline({ headline: 'Council approves new bus lanes', evidence: 'headline-only' })).toEqual({ verdict: 'unknown' });
  });

  it('an emotional but plain headline is never a cross', () => {
    expect(checkHeadline({ headline: 'Heartbreak as town loses its last bank', evidence: 'headline-only' }).verdict).toBe('unknown');
  });
});

describe('a content-mismatch cross needs the full article', () => {
  // Done when: a test proves an inaccessible article can't get a content-mismatch cross.
  const overstated = 'Coffee cures memory loss, says new study';

  it('an overstated headline with no article is not a cross', () => {
    expect(checkHeadline({ headline: overstated, evidence: 'unavailable' }).verdict).toBe('unknown');
    expect(checkHeadline({ headline: overstated, evidence: 'headline-only' }).verdict).toBe('unknown');
  });

  it('an inaccessible article cannot be crossed on figures or dates either', () => {
    const figure = 'Tesla profits soar 40% in third quarter';
    const date = 'Breaking: council approves new bus lanes';
    expect(checkHeadline({ headline: figure, evidence: 'unavailable', facts: fullFacts(MANY), now: NOW }).verdict).toBe('unknown');
    expect(checkHeadline({ headline: date, evidence: 'partial', published: '2019-01-01', now: NOW }).verdict).toBe('unknown');
  });

  it('a full article crosses an overstated claim, and says which limit it found', () => {
    const result = checkHeadline(full(overstated, ['The sample was small, and the results may need repeating in larger trials.']));
    expect(result).toMatchObject({ verdict: 'fail', reason: 'The headline says "cures", but the article describes a small study.' });
  });

  it('a hedged headline is not overstated', () => {
    expect(checkHeadline(full('Coffee may help memory, early study suggests', ['The sample was small.'])).verdict).toBe('unknown');
  });

  it('an article with no study limit is not enough to call a cure overstated', () => {
    expect(checkHeadline(full(overstated, ['Council approves new bus lanes on Mill Road.'])).verdict).toBe('unknown');
  });

  it('a figure in the headline that the article does not contain is a cross, with three figures to judge by', () => {
    const result = checkHeadline(full('Tesla profits soar 40% in third quarter', ['Net profit rose 4% to $1.2bn. Sales grew 5%. Margin was 18%. Costs rose 6%.']));
    expect(result).toMatchObject({ verdict: 'fail', reason: 'The headline gives 40%, but none of the article\'s figures match it.' });
  });

  it('two figures in the article are too few to cross on a figure', () => {
    expect(checkHeadline(full('Council to pay £5m to bus company', ['The council agreed to pay £750,000. Legal fees were £120,000.'])).verdict).toBe('unknown');
  });

  it('a headline figure the article does contain is a tick, and the reason says which', () => {
    expect(checkHeadline(full('Council agrees to pay £5m to bus company', ['The council agreed a £5m settlement. Legal advice cost £120,000.']))).toEqual({
      verdict: 'pass',
      reason: "The headline's figure, £5m, appears in the article.",
    });
  });

  it('a number written as words in the article still counts as the same figure', () => {
    expect(checkHeadline(full('Rents up 3% in a year', ['Rents rose by three per cent. London rose 5%. Wages grew 4%.'])).verdict).toBe('pass');
  });

  it('a result remembered from before facts were kept is neutral, not a cross', () => {
    expect(checkHeadline({ headline: overstated, evidence: 'full', now: NOW })).toEqual({ verdict: 'unknown' });
  });
});

describe('dates: "happening now" on an old article', () => {
  it('an article from years ago, with no later update, is a cross', () => {
    const result = checkHeadline({ headline: 'Happening now: the motorway is closed', evidence: 'full', facts: fullFacts(MANY), published: '2019-07-02', now: NOW });
    expect(result).toMatchObject({ verdict: 'fail' });
    expect(result.reason).toMatch(/^The headline presents this as happening now, but the article is dated 2 July 2019/);
  });

  it('an old article updated recently is not a cross', () => {
    expect(
      checkHeadline({ headline: 'Breaking: museum to close early', evidence: 'full', facts: fullFacts(MANY), published: '2019-05-01', modified: '2026-06-01', now: NOW }).verdict,
    ).toBe('unknown');
  });

  it('a recent article is not a cross', () => {
    expect(checkHeadline({ headline: 'Breaking: rail line reopens', evidence: 'full', facts: fullFacts(MANY), published: '2026-10-01', now: NOW }).verdict).toBe('unknown');
  });

  it('with no date at all, there is nothing to compare', () => {
    expect(checkHeadline({ headline: 'Breaking: rail line reopens', evidence: 'full', facts: fullFacts(MANY), now: NOW }).verdict).toBe('unknown');
  });
});

describe('the rewrite', () => {
  // Done when: a test proves rewrites never appear without full evidence.
  it.each([
    ['headline-only', 'headline-only'],
    ['partial', 'partial'],
    ['unavailable', 'unavailable'],
  ] as const)('a %s article never gets a rewrite, even with a summary and a cross', (_name, evidence) => {
    const result = checkHeadline({ headline: "You won't believe what happened", evidence, summary });
    expect(result.verdict).toBe('fail');
    expect(result.rewrite).toBeUndefined();
  });

  it('a full article gets a rewrite with a cross, and it is marked when it reveals a held-back result', () => {
    const result = checkHeadline(full("You won't believe what happened", ['In mice, the drug worked.'], { summary }));
    expect(result).toMatchObject({ verdict: 'fail', revealsWithheld: true });
    expect(result.rewrite).toBe(summary);
  });

  it('no rewrite without a cross: a tick or a neutral never gets one', () => {
    expect(checkHeadline(full('Council agrees to pay £5m to bus company', ['The council agreed a £5m settlement. Legal advice cost £120,000.'], { summary })).rewrite).toBeUndefined();
    expect(checkHeadline(full('Council approves new bus lanes', ['Councillors voted to approve bus lanes.'], { summary })).rewrite).toBeUndefined();
  });

  it('a summary over 15 words is cut to 15, at a clause, never mid-phrase', () => {
    const long = 'The council will cut library hours at five of its eight branches from April, saving about £410,000 a year.';
    const cut = rewriteFrom(long, 'Something else entirely');
    expect(cut).toBeDefined();
    expect(cut!.split(/\s+/).length).toBeLessThanOrEqual(REWRITE_WORDS);
    expect(cut!.endsWith(',')).toBe(false);
  });

  it('a rewrite that repeats the headline is dropped', () => {
    expect(rewriteFrom('You won\'t believe the score', "You won't believe the score")).toBeUndefined();
  });
});
