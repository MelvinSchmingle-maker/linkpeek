import { describe, expect, it } from 'vitest';
import { cleanEvent } from './events';

describe('usage events (Part 14a schema)', () => {
  it('keeps a plain count with its allowed fields', () => {
    expect(cleanEvent({ name: 'summary-shown', evidence: 'full', provider: 'extractive' })).toEqual({
      name: 'summary-shown',
      evidence: 'full',
      provider: 'extractive',
    });
    expect(cleanEvent({ name: 'card-link-opened', hostname: 'news.example.com' })).toEqual({
      name: 'card-link-opened',
      hostname: 'news.example.com',
    });
  });

  it('refuses a full address, a path or a query in place of a hostname', () => {
    expect(cleanEvent({ name: 'card-link-opened', hostname: 'https://news.example.com/a' })).toBeUndefined();
    expect(cleanEvent({ name: 'card-link-opened', hostname: 'news.example.com/a?b=1' })).toBeUndefined();
    expect(cleanEvent({ name: 'card-link-opened', hostname: 'user@news.example.com' })).toBeUndefined();
  });

  it('refuses any key it does not know, such as article text or an address', () => {
    expect(cleanEvent({ name: 'summary-shown', evidence: 'full', text: 'The council said...' })).toBeUndefined();
    expect(cleanEvent({ name: 'summary-shown', evidence: 'full', url: 'https://example.com' })).toBeUndefined();
  });

  it('refuses values outside the lists, and an event with no name', () => {
    expect(cleanEvent({ name: 'summary-shown', evidence: 'maybe' })).toBeUndefined();
    expect(cleanEvent({ evidence: 'full' })).toBeUndefined();
    expect(cleanEvent({ name: 'feedback', value: 'great' })).toBeUndefined();
  });
});
