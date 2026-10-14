import { describe, expect, it } from 'vitest';
import { cacheable, getCached, MAX_ENTRIES, setCached, TTL_MS } from './cache';
import { contentKind, failureFromStatus, looksJsRendered, looksLikeChallenge, looksLikeLoginWall, looksLikePaywall } from './diagnose';
import { cacheKey, samePage, sameOrigin, siteOf } from './url';

describe('addresses', () => {
  it('one cache entry per article: no #fragment, no tracking parameters', () => {
    expect(cacheKey('https://a.example/story?utm_source=x&id=7#comments')).toBe('https://a.example/story?id=7');
    expect(cacheKey('https://a.example/story?fbclid=abc')).toBe('https://a.example/story');
    expect(cacheKey('https://a.example/s?b=2&a=1')).toBe(cacheKey('https://a.example/s?a=1&b=2'));
  });

  it('same page and same site', () => {
    expect(samePage('https://a.example/x#top', 'https://a.example/x')).toBe(true);
    expect(samePage('https://a.example/x?p=2', 'https://a.example/x')).toBe(false);
    expect(sameOrigin('https://a.example/x', 'https://a.example/y')).toBe(true);
    expect(sameOrigin('https://a.example/x', 'http://a.example/x')).toBe(false);
    expect(siteOf('https://www.a.example/x')).toBe('a.example');
  });
});

describe('failure checks', () => {
  it('maps HTTP statuses to reasons', () => {
    expect(failureFromStatus(200)).toBeUndefined();
    expect(failureFromStatus(401)).toBe('login-wall');
    expect(failureFromStatus(402)).toBe('paywall');
    expect(failureFromStatus(403)).toBe('http-403');
    expect(failureFromStatus(404)).toBe('http-4xx');
    expect(failureFromStatus(429)).toBe('http-429');
    expect(failureFromStatus(503)).toBe('http-5xx');
  });

  it('recognises robot-check pages by title or by strong markers', () => {
    expect(looksLikeChallenge('', 'Just a moment...', 0)).toBe(true);
    expect(looksLikeChallenge('<script src="/cdn-cgi/challenge-platform/x"></script>', 'Example', 10)).toBe(true);
    expect(looksLikeChallenge('<script src="https://ct.captcha-delivery.com/c.js"></script>', 'Example', 10)).toBe(true);
  });

  it('a normal article with a reCAPTCHA comment form is not a robot check', () => {
    expect(looksLikeChallenge('<div class="g-recaptcha"></div>', 'Council news', 600)).toBe(false);
    // ...but a nearly empty page with one is.
    expect(looksLikeChallenge('<div class="g-recaptcha"></div>', 'Example', 20)).toBe(true);
  });

  it('login walls: sent to a login page, or a password form with little text', () => {
    const args = { requestedUrl: 'https://a.example/story', finalUrl: 'https://a.example/story', hasPasswordField: false, title: 'Story', articleWords: 500 };
    expect(looksLikeLoginWall(args)).toBe(false);
    expect(looksLikeLoginWall({ ...args, finalUrl: 'https://a.example/login?next=/story' })).toBe(true);
    expect(looksLikeLoginWall({ ...args, hasPasswordField: true, articleWords: 40 })).toBe(true);
    // A long article with a sign-in box in the corner is still an article.
    expect(looksLikeLoginWall({ ...args, hasPasswordField: true })).toBe(false);
  });

  it('paywalls: the publisher says not free, or a short page with subscription wording', () => {
    const args = { bodyText: 'Some text', articleWords: 500, hasPaywallElement: false };
    expect(looksLikePaywall(args)).toBe(false);
    expect(looksLikePaywall({ ...args, isAccessibleForFree: false })).toBe(true);
    expect(looksLikePaywall({ ...args, articleWords: 60, bodyText: 'Subscribe to continue reading.' })).toBe(true);
    expect(looksLikePaywall({ ...args, articleWords: 60, hasPaywallElement: true })).toBe(true);
    // A long free article that mentions subscribing is still free.
    expect(looksLikePaywall({ ...args, bodyText: 'Subscribe to continue reading our newsletter.' })).toBe(false);
  });

  it('JavaScript-only pages', () => {
    const args = { articleWords: 0, bodyWords: 5, scriptCount: 3, hasEmptyAppRoot: true, noscriptAsksForJs: false };
    expect(looksJsRendered(args)).toBe(true);
    expect(looksJsRendered({ ...args, articleWords: 300 })).toBe(false);
    expect(looksJsRendered({ ...args, scriptCount: 0, hasEmptyAppRoot: false, bodyWords: 100 })).toBe(false);
  });

  it('content kinds', () => {
    expect(contentKind('text/html', 'x')).toBe('html');
    expect(contentKind('application/pdf', 'x')).toBe('pdf');
    expect(contentKind('image/png', 'x.png')).toBe('unsupported');
    expect(contentKind('application/zip', 'x.zip')).toBe('unsupported');
    expect(contentKind('', 'x')).toBe('html');
  });
});

describe('result cache (memory only, 24 hours)', () => {
  const a = { evidence: 'full' as const };

  it('stores and returns a result', async () => {
    await setCached('k1', a);
    expect(await getCached('k1')).toEqual(a);
  });

  it('forgets results older than 24 hours', async () => {
    await setCached('k2', a, 1000);
    expect(await getCached('k2', 1000 + TTL_MS + 1)).toBeUndefined();
  });

  it('keeps at most MAX_ENTRIES, dropping the oldest', async () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) await setCached(`n${i}`, a);
    expect(await getCached('n0')).toBeUndefined();
    expect(await getCached('n2')).toBeUndefined();
    expect(await getCached(`n${MAX_ENTRIES + 2}`)).toEqual(a);
  });

  it('does not remember passing problems or missing permission', () => {
    expect(cacheable({ evidence: 'unavailable', failure: 'timeout' })).toBe(false);
    expect(cacheable({ evidence: 'unavailable', failure: 'http-429' })).toBe(false);
    expect(cacheable({ evidence: 'unavailable', failure: 'permission-denied' })).toBe(false);
    expect(cacheable({ evidence: 'unavailable', failure: 'http-4xx' })).toBe(true);
    expect(cacheable({ evidence: 'full' })).toBe(true);
  });
});
