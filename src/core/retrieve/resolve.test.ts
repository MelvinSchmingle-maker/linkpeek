import { describe, expect, it } from 'vitest';
import { destinationOf, MAX_ADDRESS_LENGTH, resolveLink } from './resolve';

const BBC = 'https://www.bbc.co.uk/news/articles/c3qjn45pepx1o';
/** A wrapper address for a destination, built the way Facebook builds them: the destination percent-encoded in `u`. */
const fb = (dest: string, extra = '') => `https://l.facebook.com/l.php?u=${encodeURIComponent(dest)}${extra}`;

describe('ordinary links', () => {
  it('leaves an ordinary article link alone', () => {
    expect(resolveLink(BBC)).toEqual({ kind: 'direct', url: BBC, hops: 0 });
  });

  it('does not follow a redirect-looking parameter on an ordinary site', () => {
    const link = 'https://news.example/story?url=https%3A%2F%2Fevil.example%2F&redirect=https%3A%2F%2Fevil.example%2F';
    expect(resolveLink(link)).toEqual({ kind: 'direct', url: 'https://news.example/story?url=https%3A%2F%2Fevil.example%2F&redirect=https%3A%2F%2Fevil.example%2F', hops: 0 });
  });

  it('does not treat lookalike hosts or other paths as wrappers', () => {
    expect(resolveLink('https://evil-l.facebook.com/l.php?u=https%3A%2F%2Fbbc.co.uk%2F').kind).toBe('direct');
    expect(resolveLink('https://l.facebook.com.evil.example/l.php?u=https%3A%2F%2Fbbc.co.uk%2F').kind).toBe('direct');
    expect(resolveLink('https://l.facebook.com/other?u=https%3A%2F%2Fbbc.co.uk%2F').kind).toBe('direct');
    expect(resolveLink('https://l.instagram.com/p/abc?u=https%3A%2F%2Fbbc.co.uk%2F').kind).toBe('direct');
  });
});

describe('Facebook and Instagram wrappers', () => {
  it('reads the destination from u', () => {
    expect(resolveLink(fb(BBC))).toEqual({ kind: 'decoded', url: BBC, wrapper: 'Facebook', hops: 1 });
  });

  it('keeps the destination exactly, including its own query string', () => {
    const dest = 'https://news.example/story?id=7&ref=feed#top';
    expect(resolveLink(fb(dest, '&h=AT0x'))).toMatchObject({ kind: 'decoded', url: 'https://news.example/story?id=7&ref=feed#top' });
  });

  it('keeps percent-escapes inside the destination, as the destination wrote them', () => {
    const link = `https://l.facebook.com/l.php?u=${encodeURIComponent('https://news.example/a?b=c%26d')}`;
    expect(resolveLink(link)).toMatchObject({ kind: 'decoded', url: 'https://news.example/a?b=c%26d' });
  });

  it('decodes u once: a destination that was encoded twice is malformed, not decoded again', () => {
    const twice = encodeURIComponent(encodeURIComponent('https://news.example/a'));
    expect(resolveLink(`https://l.facebook.com/l.php?u=${twice}`)).toMatchObject({ kind: 'rejected', reason: 'malformed' });
  });

  it('reads Instagram wrappers the same way, on the root path only', () => {
    expect(resolveLink(`https://l.instagram.com/?u=${encodeURIComponent(BBC)}&e=AT0x`)).toMatchObject({
      kind: 'decoded',
      url: BBC,
      wrapper: 'Instagram',
    });
  });

  it('refuses a wrapper with no destination', () => {
    expect(resolveLink('https://l.facebook.com/l.php')).toMatchObject({ kind: 'rejected', reason: 'missing-destination' });
    expect(resolveLink('https://l.facebook.com/l.php?u=')).toMatchObject({ kind: 'rejected', reason: 'missing-destination' });
  });
});

describe('untrusted destinations inside a wrapper', () => {
  it('refuses a destination that is not a web address', () => {
    for (const dest of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://example.com/a']) {
      expect(resolveLink(fb(dest)), dest).toMatchObject({ kind: 'rejected', reason: 'not-web' });
    }
  });

  it('refuses a destination with a user name or password', () => {
    expect(resolveLink(fb('https://user:pw@news.example/a'))).toMatchObject({ kind: 'rejected', reason: 'credentials' });
    expect(resolveLink(fb('https://user@news.example/a'))).toMatchObject({ kind: 'rejected', reason: 'credentials' });
  });

  it('refuses malformed and control-character destinations', () => {
    expect(resolveLink(fb('https://[not valid'))).toMatchObject({ kind: 'rejected', reason: 'malformed' });
    expect(resolveLink(fb('https://news.example/a\u0007b'))).toMatchObject({ kind: 'rejected', reason: 'malformed' });
    expect(resolveLink(`https://l.facebook.com/l.php?u=${'a'.repeat(MAX_ADDRESS_LENGTH)}`)).toMatchObject({ kind: 'rejected', reason: 'malformed' });
  });

  it('hands a private destination on unchanged, for the address check to refuse', () => {
    // The resolver finds where the link goes; prohibitedAddress decides whether LinkPeek may read it.
    expect(resolveLink(fb('http://127.0.0.1:8080/admin'))).toEqual({ kind: 'decoded', url: 'http://127.0.0.1:8080/admin', wrapper: 'Facebook', hops: 1 });
  });
});

describe('nested wrappers and loops', () => {
  it('unwraps a wrapper inside a wrapper, and reports the innermost destination', () => {
    const inner = `https://l.instagram.com/?u=${encodeURIComponent(BBC)}`;
    const res = resolveLink(fb(inner));
    expect(res).toMatchObject({ kind: 'decoded', url: BBC, wrapper: 'Facebook', hops: 2 });
  });

  it('stops after the depth limit', () => {
    let link = BBC;
    for (let i = 0; i < 4; i++) link = fb(link);
    expect(resolveLink(link)).toMatchObject({ kind: 'rejected', reason: 'too-deep' });
  });

  it('ends a chain of wrappers at the depth limit, so nothing can loop forever', () => {
    // A wrapper's destination is always shorter than the wrapper itself, so a finite link can't
    // point back at itself. The depth limit is what stops a long chain.
    let link = 'https://l.facebook.com/l.php?u=https%3A%2F%2Fbbc.co.uk%2F';
    for (let i = 0; i < 10; i++) link = fb(link);
    expect(resolveLink(link)).toMatchObject({ kind: 'rejected', reason: 'too-deep' });
  });

  it('keeps the outer wrapper name when the destination is a wrapper that cannot be read', () => {
    const tco = 'https://t.co/AbC123';
    expect(resolveLink(fb(tco))).toEqual({ kind: 'needs-redirect', url: tco, wrapper: 'Facebook', hops: 1 });
  });
});

describe('wrappers that need following', () => {
  it('reports X t.co links as needing a redirect, with the wrapper as the address', () => {
    expect(resolveLink('https://t.co/AbC123')).toEqual({ kind: 'needs-redirect', url: 'https://t.co/AbC123', wrapper: 'X', hops: 0 });
  });

  it('does not treat a t.co address with a longer path as a link wrapper', () => {
    expect(resolveLink('https://t.co/AbC123/more').kind).toBe('direct');
  });

  it('reports Reddit and Google News wrappers as needing a redirect', () => {
    expect(resolveLink('https://out.reddit.com/t3_abc?url=https%3A%2F%2Fbbc.co.uk')).toMatchObject({ kind: 'needs-redirect', wrapper: 'Reddit' });
    expect(resolveLink('https://news.google.com/rss/articles/CBMiXYZ')).toMatchObject({ kind: 'needs-redirect', wrapper: 'Google News' });
  });
});

describe('addresses that cannot be parsed or read', () => {
  it('refuses text that is not an address', () => {
    expect(resolveLink('not a link')).toMatchObject({ kind: 'rejected', reason: 'malformed' });
    expect(resolveLink('')).toMatchObject({ kind: 'rejected', reason: 'malformed' });
  });

  it('refuses non-web schemes at the top level', () => {
    expect(resolveLink('javascript:alert(1)')).toMatchObject({ kind: 'rejected', reason: 'not-web' });
    expect(resolveLink('mailto:someone@example.com')).toMatchObject({ kind: 'rejected', reason: 'not-web' });
  });
});

describe('destinationOf', () => {
  it('uses the destination when there is one, and the link otherwise', () => {
    expect(destinationOf(resolveLink(fb(BBC)), fb(BBC))).toBe(BBC);
    expect(destinationOf(resolveLink('https://t.co/AbC123'), 'https://t.co/AbC123')).toBe('https://t.co/AbC123');
    expect(destinationOf(resolveLink('https://l.facebook.com/l.php'), 'https://l.facebook.com/l.php')).toBe('https://l.facebook.com/l.php');
  });
});
