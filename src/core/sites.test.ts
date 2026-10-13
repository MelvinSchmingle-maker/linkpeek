import { describe, expect, it } from 'vitest';
import { hostFromPattern, hostOf, originPattern, sitePattern } from './sites';

describe('site helpers', () => {
  it('builds an access pattern for web pages only', () => {
    expect(originPattern('https://news.example.com/a/b?c=1')).toBe('https://news.example.com/*');
    expect(originPattern('http://127.0.0.1:4173/x')).toBe('http://127.0.0.1/*');
    expect(originPattern('chrome://extensions')).toBeUndefined();
    expect(originPattern('file:///home/me/a.html')).toBeUndefined();
    expect(originPattern(undefined)).toBeUndefined();
  });

  it('reads hostnames back out of patterns', () => {
    expect(hostFromPattern('https://news.example.com/*')).toBe('news.example.com');
    expect(hostFromPattern('*://news.example.com/*')).toBe('news.example.com');
    expect(hostFromPattern(sitePattern('a.example'))).toBe('a.example');
  });

  it('hostOf handles junk', () => {
    expect(hostOf('https://x.example/y')).toBe('x.example');
    expect(hostOf('not a url')).toBeUndefined();
  });
});
