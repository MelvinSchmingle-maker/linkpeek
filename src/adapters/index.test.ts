import { describe, expect, it } from 'vitest';
import { ADAPTERS, adapterFor, type Adapter } from './index';

describe('social adapters (the shared hook)', () => {
  it('no platform adapter is registered yet, so every link goes to the general reader', () => {
    expect(ADAPTERS).toEqual([]);
    expect(adapterFor(new URL('https://www.reddit.com/r/news/comments/abc/'))).toBeUndefined();
    expect(adapterFor(new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBeUndefined();
  });

  it('picks the first adapter that claims an address', () => {
    const fake: Adapter = { id: 'fake', matches: (u) => u.hostname === 'example.test', read: async () => undefined };
    expect(adapterFor(new URL('https://example.test/x'), [fake])?.id).toBe('fake');
    expect(adapterFor(new URL('https://other.test/x'), [fake])).toBeUndefined();
  });
});
