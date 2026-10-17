import { describe, expect, it } from 'vitest';
import { CONSENT_WORDS, SIGN_UP_WORDS, URGENCY_TEXT } from './patterns';
import { ANNOYANCE_ORDER, ANNOYANCE_LABEL } from './labels';
import { DEFAULT_ANNOYANCE } from '../../core/storage/settings';

describe('annoyance patterns', () => {
  it('spots sign-up wording and nothing ordinary', () => {
    expect(SIGN_UP_WORDS.test('Sign up for our newsletter')).toBe(true);
    expect(SIGN_UP_WORDS.test('Subscribe to the daily digest')).toBe(true);
    expect(SIGN_UP_WORDS.test('The council signed up to the plan')).toBe(false);
  });

  it('spots consent wording, so cookie notices are never hidden', () => {
    expect(CONSENT_WORDS.test('We use cookies on this site')).toBe(true);
    expect(CONSENT_WORDS.test('Manage preferences')).toBe(true);
    expect(CONSENT_WORDS.test('Footbridge reopens after rebuild')).toBe(false);
  });

  it('spots urgency claims, and a plain price is not one', () => {
    expect(URGENCY_TEXT.some((re) => re.test('Only 2 left in stock!'))).toBe(true);
    expect(URGENCY_TEXT.some((re) => re.test('Offer ends in 02:14:55'))).toBe(true);
    expect(URGENCY_TEXT.some((re) => re.test('Tickets cost £12'))).toBe(false);
  });

  it('every tool has a plain name and a hint, and none is on by default', () => {
    expect(ANNOYANCE_ORDER).toHaveLength(6);
    for (const tool of ANNOYANCE_ORDER) {
      expect(ANNOYANCE_LABEL[tool].name.length).toBeGreaterThan(0);
      expect(ANNOYANCE_LABEL[tool].hint.length).toBeGreaterThan(0);
      expect(DEFAULT_ANNOYANCE[tool]).toBe(false);
    }
  });
});
