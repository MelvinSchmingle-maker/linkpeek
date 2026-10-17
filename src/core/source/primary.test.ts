import { describe, expect, it } from 'vitest';
import { primaryCounts, primaryKind } from './primary';

describe('links to primary sources', () => {
  it.each([
    ['https://www.gov.uk/government/publications/report', 'government'],
    ['https://www.parliament.gov.scot/bills', 'government'],
    ['https://www.justice.gov/opa/pr/case', 'court'],
    ['https://www.bailii.org/uk/cases/UKSC/2026/1.html', 'court'],
    ['https://doi.org/10.1000/xyz', 'research'],
    ['https://arxiv.org/abs/2601.00001', 'research'],
    ['https://example.test/files/annual-report.pdf', 'pdf'],
  ])('%s is counted as %s', (href, kind) => {
    expect(primaryKind(href)).toBe(kind);
  });

  it.each([
    'https://www.example.test/news/story',
    'https://www.gov.uk.example.test/fake',
    'mailto:someone@example.test',
    'not a link',
  ])('%s is not counted', (href) => {
    expect(primaryKind(href)).toBeUndefined();
  });

  it('counts each kind, and zero when nothing matches', () => {
    expect(primaryCounts(['https://www.gov.uk/a', 'https://www.gov.uk/b', 'https://doi.org/x', 'https://example.test/x.pdf'])).toEqual({
      government: 2,
      court: 0,
      research: 1,
      pdf: 1,
    });
    expect(primaryCounts(['https://example.test/only-news'])).toEqual({ government: 0, court: 0, research: 0, pdf: 0 });
  });
});
