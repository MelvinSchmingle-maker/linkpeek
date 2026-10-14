/**
 * DEMO DATA. Made-up results for the local test pages, one per card state.
 * Every result here has isDemo: true, and the card always shows a
 * "Demo data" tag for them. None of this is a real assessment of anything.
 *
 * A link opts in with data-linkpeek-demo="<key>". The attribute is only
 * honoured on 127.0.0.1 and localhost (our local test server), never on real
 * websites, so a page can't dress its own links in LinkPeek verdicts.
 */
import type { LinkResult } from '../core/types';

type DemoFixture = Omit<LinkResult, 'id' | 'url' | 'headline' | 'isDemo'>;

const notChecked = { level: 'not-checked' } as const;

export const DEMO_FIXTURES = {
  full: {
    evidence: 'full',
    summary: {
      text: 'Millbrook council approved two kilometres of protected cycle lanes on High Street, starting in March.',
      wordCount: 15,
      provider: 'demo',
    },
    headlineCheck: { verdict: 'pass' },
    linkRisk: notChecked,
  },
  partial: {
    evidence: 'partial',
    preview: 'A review of the town library service recommends longer weekend opening hours.',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
  'headline-only': {
    evidence: 'headline-only',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
  inaccessible: {
    evidence: 'unavailable',
    failure: 'login-wall',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
  'summary-failed': {
    evidence: 'full',
    failure: 'summary-failed',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
  'link-warning': {
    evidence: 'headline-only',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: {
      level: 'mismatch',
      reason: 'The link text says millbrook.gov.uk but it goes to millbrook-gov-refunds.example.',
    },
  },
  clickbait: {
    evidence: 'full',
    summary: {
      text: 'A Millbrook bakery now opens at 6am on weekdays instead of 7am.',
      wordCount: 12,
      provider: 'demo',
    },
    headlineCheck: {
      verdict: 'fail',
      reason: 'The headline withholds the main event.',
      rewrite: 'Millbrook bakery moves weekday opening to 6am',
    },
    linkRisk: notChecked,
  },
  insufficient: {
    evidence: 'full',
    summary: {
      text: 'Residents will discuss the proposed park redesign at a public meeting on 4 November.',
      wordCount: 14,
      provider: 'demo',
    },
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
  unsupported: {
    evidence: 'unavailable',
    unsupported: true,
    headlineCheck: { verdict: 'unknown' },
    linkRisk: notChecked,
  },
} satisfies Record<string, DemoFixture>;

export type DemoKey = keyof typeof DEMO_FIXTURES | 'loading';

export function isDemoKey(key: string): key is DemoKey {
  // Own keys only: "constructor" or "__proto__" must not count as fixtures.
  return key === 'loading' || Object.prototype.hasOwnProperty.call(DEMO_FIXTURES, key);
}

/** Returns the demo result for a link, or 'loading' for the stays-loading demo. */
export function demoResult(key: DemoKey, link: { href: string; textContent: string | null }): LinkResult | 'loading' {
  if (key === 'loading') return 'loading';
  const fixture: DemoFixture = DEMO_FIXTURES[key];
  return {
    ...fixture,
    id: `demo-${key}`,
    url: link.href,
    headline: (link.textContent ?? '').trim(),
    isDemo: true,
  };
}
