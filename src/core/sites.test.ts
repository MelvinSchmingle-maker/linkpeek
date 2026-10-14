import { describe, expect, it } from 'vitest';
import { hostFromPattern, hostOf, originPattern, sitePatterns } from './sites';

describe('site helpers', () => {
  it('builds an access pattern for web pages only', () => {
    expect(originPattern('https://news.example.com/a/b?c=1')).toBe('https://news.example.com/*');
    expect(originPattern('http://127.0.0.1:4173/x')).toBe('http://127.0.0.1/*');
    expect(originPattern('chrome://extensions')).toBeUndefined();
    expect(originPattern('file:///home/me/a.html')).toBeUndefined();
    expect(originPattern(undefined)).toBeUndefined();
  });

  it('treats the Chrome Web Store as a page LinkPeek cannot run on', () => {
    expect(originPattern('https://chromewebstore.google.com/detail/x/abc')).toBeUndefined();
    expect(originPattern('https://chrome.google.com/webstore/detail/x')).toBeUndefined();
    expect(originPattern('https://chrome.google.com/other')).toBe('https://chrome.google.com/*');
  });

  it('asks for one pattern per scheme, never the "*://" form Chrome refuses', () => {
    expect(sitePatterns('news.example.com')).toEqual(['https://news.example.com/*', 'http://news.example.com/*']);
    for (const p of sitePatterns('x.example')) expect(p.startsWith('*')).toBe(false);
  });

  it('reads hostnames back out of patterns', () => {
    expect(hostFromPattern('https://news.example.com/*')).toBe('news.example.com');
    expect(hostFromPattern('*://news.example.com/*')).toBe('news.example.com');
    for (const p of sitePatterns('a.example')) expect(hostFromPattern(p)).toBe('a.example');
  });

  it('hostOf handles junk', () => {
    expect(hostOf('https://x.example/y')).toBe('x.example');
    expect(hostOf('not a url')).toBeUndefined();
  });
});
