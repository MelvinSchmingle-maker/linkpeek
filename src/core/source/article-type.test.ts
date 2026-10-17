import { describe, expect, it } from 'vitest';
import { articleKindFrom } from './article-type';

const kind = (url: string, extra: { labels?: Parameters<typeof articleKindFrom>[0]['labels']; schemaType?: string } = {}) =>
  articleKindFrom({ url, labels: extra.labels ?? [], schemaType: extra.schemaType })?.value;

describe('article type: from the page, then the address, and only when it is clear', () => {
  it.each([
    ['NewsArticle', 'news'],
    ['ReportageNewsArticle', 'news'],
    ['OpinionNewsArticle', 'opinion'],
    ['AnalysisNewsArticle', 'analysis'],
    ['BackgroundNewsArticle', 'analysis'],
    ['BlogPosting', 'other'],
    ['Article', 'other'],
  ])('structured data type %s is %s', (schemaType, expected) => {
    expect(kind('https://example.test/story', { schemaType })).toBe(expected);
  });

  it('a generic web page type is not an article, so it gets no kind', () => {
    expect(kind('https://example.test/story', { schemaType: 'WebPage' })).toBeUndefined();
  });

  it.each([
    ['https://example.test/sponsored/heating-guide', 'sponsored'],
    ['https://example.test/press-release/recycling', 'press-release'],
    ['https://example.test/opinion/high-street', 'opinion'],
    ['https://www.guardian.test/commentisfree/2026/oct/high-street', 'opinion'],
    ['https://example.test/analysis/budget', 'analysis'],
    ['https://example.test/news/bridge', 'news'],
  ])('the address %s says %s', (url, expected) => {
    expect(kind(url)).toBe(expected);
  });

  it('a path that merely contains the word (news-letter, opinions-about-cats) is not a signal', () => {
    expect(kind('https://example.test/newsletter-signup')).toBeUndefined();
    expect(kind('https://example.test/guides/cat-opinions-of-the-year')).toBeUndefined();
  });

  it('a page label is the page saying so, and it wins over the address', () => {
    expect(kind('https://example.test/news/story', { labels: ['sponsored'] })).toBe('sponsored');
    expect(kind('https://example.test/news/story', { labels: ['press-release'] })).toBe('press-release');
  });

  it('a sponsored or press-release address beats an opinion or news type', () => {
    expect(kind('https://example.test/sponsored/opinion-piece', { schemaType: 'OpinionNewsArticle' })).toBe('sponsored');
    expect(kind('https://example.test/press-release/news', { schemaType: 'NewsArticle' })).toBe('press-release');
  });

  it('an unclear page gets no kind, never a guess', () => {
    expect(kind('https://example.test/a/b/c')).toBeUndefined();
  });

  it('reports where the kind came from', () => {
    expect(articleKindFrom({ url: 'https://example.test/opinion/x', labels: [], schemaType: undefined })?.from).toBe('address');
    expect(articleKindFrom({ url: 'https://example.test/x', labels: [], schemaType: 'OpinionNewsArticle' })?.from).toBe('structured-data');
  });
});
