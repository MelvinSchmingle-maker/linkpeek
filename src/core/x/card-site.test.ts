import { describe, expect, it } from 'vitest';
import { cardSiteFromLabel, isSiteHostname } from './card-site';

/** Synthetic labels, in the shape X uses. The headlines are invented. */
describe('the site a card names', () => {
  it('reads the domain at the start of the card label', () => {
    expect(cardSiteFromLabel('dailymail.com A headline about a river')).toBe('dailymail.com');
    expect(cardSiteFromLabel('News.Example The headline')).toBe('news.example');
    expect(cardSiteFromLabel('bbc.co.uk Headline')).toBe('bbc.co.uk');
  });

  it('refuses labels that do not start with a plain domain', () => {
    expect(cardSiteFromLabel('A headline with no domain')).toBeUndefined();
    expect(cardSiteFromLabel('https://news.example/a Headline')).toBeUndefined();
    expect(cardSiteFromLabel('news.example/a/b Headline')).toBeUndefined();
    expect(cardSiteFromLabel('user:pw@news.example Headline')).toBeUndefined();
    expect(cardSiteFromLabel('')).toBeUndefined();
    expect(cardSiteFromLabel(null)).toBeUndefined();
  });

  it('refuses addresses, single labels, and X\'s own names', () => {
    expect(isSiteHostname('127.0.0.1')).toBe(false);
    expect(isSiteHostname('localhost')).toBe(false);
    expect(isSiteHostname('intranet')).toBe(false);
    expect(isSiteHostname('x.com')).toBe(false);
    expect(isSiteHostname('pbs.x.com')).toBe(false);
    expect(isSiteHostname('twitter.com')).toBe(false);
    expect(isSiteHostname('t.co')).toBe(false);
    expect(isSiteHostname('news.example')).toBe(true);
  });
});
