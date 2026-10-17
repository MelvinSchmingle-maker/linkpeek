import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessHtml, type FetchedMeta } from '../extract/assess';
import { extractHtml } from '../extract/html';
import { sourceLines } from '../../content/view-model';
import { MSG } from '../messages';
import { sourceInfo } from './facts';

const page = (name: string) => readFileSync(join(process.cwd(), 'src/core/source/fixtures', name), 'utf8');

/** Reads a fixture the way the offscreen document does, and returns its source facts. */
function sourceOf(name: string, url: string) {
  const html = page(name);
  const ex = extractHtml(html, url);
  const meta: FetchedMeta = { requestedUrl: url, finalUrl: url, status: 200 };
  return assessHtml(meta, html, ex).source!;
}

describe('the source card facts, read from real page structures', () => {
  it('a news story: publisher name, dates, author and type, each with where it came from', () => {
    const s = sourceOf('news-json-ld.html', 'https://www.harbourpost.test/news/bridge-reopens');
    // The site's own name (og:site_name) comes before the company that owns it (JSON-LD publisher).
    expect(s.publisher).toEqual({ value: 'Harbour Post', from: 'meta-tags' });
    expect(s.published).toEqual({ value: '2026-10-12T07:30:00Z', from: 'meta-tags' });
    expect(s.modified).toEqual({ value: '2026-10-12T16:00:00Z', from: 'structured-data' });
    expect(s.author).toEqual({ value: 'Priya Nair', from: 'structured-data' });
    expect(s.articleType).toEqual({ value: 'news', from: 'structured-data' });
  });

  it('counts the government, research links in the article text, and nothing else', () => {
    const s = sourceOf('news-json-ld.html', 'https://www.harbourpost.test/news/bridge-reopens');
    expect(s.primarySources).toEqual({ value: { government: 1, court: 0, research: 1, pdf: 0 }, from: 'article-links' });
  });

  it('an article we read with no links in it says zero, which is a count, not "Not stated"', () => {
    const s = sourceInfo({
      url: 'https://example.test/story',
      metadata: { siteName: 'Example' },
      links: [],
      labels: [],
    });
    expect(s.primarySources).toEqual({ value: { government: 0, court: 0, research: 0, pdf: 0 }, from: 'article-links' });
  });

  it('no article text read means nothing was counted, so the card says "Not stated"', () => {
    const s = sourceInfo({ url: 'https://example.test/story', metadata: { siteName: 'Example' }, labels: [] });
    expect(s.primarySources).toBeUndefined();
  });

  it('a page with no metadata still has a publisher (its address) and no invented facts', () => {
    const s = sourceOf('bare-page.html', 'https://www.nowhere-in-particular.test/story');
    expect(s.publisher).toEqual({ value: 'nowhere-in-particular.test', from: 'address' });
    expect(s.published).toBeUndefined();
    expect(s.author).toBeUndefined();
    expect(s.articleType).toBeUndefined();
    expect(s.primarySources).toBeUndefined();
  });

  it('a page with no metadata shows "Not stated" for every missing fact, never a negative', () => {
    const lines = sourceLines(sourceOf('bare-page.html', 'https://www.nowhere-in-particular.test/story'));
    const byLabel = Object.fromEntries(lines.map((l) => [l.label, l.value]));
    expect(byLabel.Published).toBe(MSG.notStated);
    expect(byLabel.Author).toBe(MSG.notStated);
    expect(byLabel['Article type']).toBe(MSG.notStated);
    expect(byLabel['Links to primary sources']).toBe(MSG.notStated);
  });

  it('a sponsored piece says so, from its own label, and its navigation links to "Sponsored" are ignored', () => {
    const s = sourceOf('sponsored-page.html', 'https://www.harbourpost.test/guides/energy-bill');
    expect(s.articleType).toEqual({ value: 'sponsored', from: 'page-label' });
  });

  it('an opinion piece is opinion, from its label, even though the navigation also says "Opinion"', () => {
    const s = sourceOf('opinion-page.html', 'https://www.millbrookgazette.test/high-street-will-not-come-back');
    expect(s.articleType).toEqual({ value: 'opinion', from: 'page-label' });
    expect(s.author).toEqual({ value: 'Tom Ashworth', from: 'meta-tags' });
  });

  it('a press release is a press release, from its label, and a PDF link in it is counted', () => {
    const s = sourceOf('press-release.html', 'https://www.millbrookcouncil.test/news/recycling');
    expect(s.articleType).toEqual({ value: 'press-release', from: 'page-label' });
    expect(s.primarySources?.value.pdf).toBe(1);
  });

  it('an analysis piece is analysis from its address, and its links to government sites are counted', () => {
    const s = sourceOf('analysis-page.html', 'https://www.gazette.test/analysis/what-the-budget-means');
    expect(s.articleType).toEqual({ value: 'analysis', from: 'address' });
    expect(s.primarySources?.value.government).toBe(2);
  });

  it('the sponsored label beats the news type: a sponsored news page is sponsored', () => {
    const html = page('news-json-ld.html').replace('<h1>', '<p class="label">Sponsored content</p><h1>');
    const ex = extractHtml(html, 'https://www.harbourpost.test/news/x');
    const info = sourceInfo({ url: 'https://www.harbourpost.test/news/x', metadata: ex.metadata, links: ex.links, labels: ex.labels });
    expect(info.articleType?.value).toBe('sponsored');
  });
});
