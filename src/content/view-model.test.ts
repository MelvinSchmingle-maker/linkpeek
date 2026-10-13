import { describe, expect, it } from 'vitest';
import { FAILURE_MESSAGE, MSG } from '../core/messages';
import type { LinkResult } from '../core/types';
import { DEMO_FIXTURES, demoResult, type DemoKey } from './fixtures';
import { toCardView } from './view-model';

const link = { href: 'https://example.test/a', textContent: 'A headline' };
const result = (key: Exclude<DemoKey, 'loading'>) => demoResult(key, link) as LinkResult;
const view = (key: Exclude<DemoKey, 'loading'>) => toCardView({ kind: 'result', result: result(key) });

describe('card view model', () => {
  it('loading shows the loading message and no feedback', () => {
    const v = toCardView({ kind: 'loading', isDemo: false });
    expect(v).toMatchObject({ loading: true, message: MSG.loading, showFeedback: false });
    expect(v.status).toBeUndefined();
  });

  it('full: summary, tick, no evidence tag, feedback on', () => {
    const v = view('full');
    expect(v.summary).toBe(DEMO_FIXTURES.full.summary.text);
    expect(v.status?.verdict).toBe('pass');
    expect(v.evidenceTag).toBeUndefined();
    expect(v.showFeedback).toBe(true);
  });

  it('partial: never shown as a summary, labelled as a preview', () => {
    const v = view('partial');
    expect(v.summary).toBeUndefined();
    expect(v.message).toBe(MSG.partialIntro);
    expect(v.preview).toBe(DEMO_FIXTURES.partial.preview);
    expect(v.evidenceTag).toBe('Preview only');
  });

  it('headline-only: no summary, tagged, neutral with "not enough information"', () => {
    const v = view('headline-only');
    expect(v.summary).toBeUndefined();
    expect(v.evidenceTag).toBe('Headline only');
    expect(v.status?.verdict).toBe('unknown');
    expect(v.reason).toBe(MSG.insufficient);
    expect(v.showFeedback).toBe(false);
  });

  it('inaccessible: friendly reason, no summary, no empty verdict clutter', () => {
    const v = view('inaccessible');
    expect(v.message).toBe(FAILURE_MESSAGE['login-wall']);
    expect(v.summary).toBeUndefined();
    expect(v.status).toBeUndefined();
  });

  it('summary failed: says so, offers no summary', () => {
    const v = view('summary-failed');
    expect(v.message).toBe(MSG.summaryFailed);
    expect(v.summary).toBeUndefined();
  });

  it('link warning shows the mismatch warning', () => {
    expect(view('link-warning').warning).toBe('Goes somewhere different from what it shows');
  });

  it('clickbait: cross with a reason, summary still shown', () => {
    const v = view('clickbait');
    expect(v.status?.verdict).toBe('fail');
    expect(v.reason).toBe('The headline withholds the main event.');
    expect(v.summary).toBeDefined();
  });

  it('insufficient evidence: neutral with the standard sentence', () => {
    const v = view('insufficient');
    expect(v.status?.verdict).toBe('unknown');
    expect(v.reason).toBe(MSG.insufficient);
  });

  it('unsupported: one plain message and nothing else', () => {
    const v = view('unsupported');
    expect(v.message).toBe(MSG.unsupported);
    expect(v.status).toBeUndefined();
    expect(v.summary).toBeUndefined();
  });

  it('never shows "safe" for any link-risk level', () => {
    for (const level of ['known-threat', 'suspicious', 'mismatch', 'no-known-warning', 'not-checked'] as const) {
      const v = toCardView({ kind: 'result', result: { ...result('full'), linkRisk: { level } } });
      expect(v.warning ?? '').not.toMatch(/safe/i);
    }
  });

  it('a full-evidence result without a summary is reported as a failure, not blank', () => {
    const r = { ...result('full'), summary: undefined };
    expect(toCardView({ kind: 'result', result: r }).message).toBe(MSG.summaryFailed);
  });
});

describe('demo fixtures', () => {
  it('every fixture is marked as demo data', () => {
    for (const key of Object.keys(DEMO_FIXTURES) as (keyof typeof DEMO_FIXTURES)[]) {
      expect(result(key).isDemo).toBe(true);
    }
  });

  it('demo summaries respect the 20-word limit', () => {
    for (const f of Object.values(DEMO_FIXTURES)) {
      if ('summary' in f) expect(f.summary.text.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });

  it('rewrites only appear with full evidence', () => {
    for (const f of Object.values(DEMO_FIXTURES)) {
      if ('rewrite' in f.headlineCheck) expect(f.evidence).toBe('full');
    }
  });
});

describe('link warnings', () => {
  it('show why, and the open link says "anyway"', () => {
    const v = view('link-warning');
    expect(v.warningDetail).toMatch(/millbrook-gov-refunds\.example/);
    expect(v.openLabel).toBe(MSG.openAnyway);
  });

  it('downloads and other unsupported links say "Open link", not "Open article"', () => {
    expect(view('unsupported').openLabel).toBe(MSG.openLink);
    expect(view('full').openLabel).toBe(MSG.openArticle);
  });
});

describe('not-ready state', () => {
  it('says plainly that article reading is not built yet, with no verdict or feedback', () => {
    const v = toCardView({ kind: 'not-ready' });
    expect(v.message).toBe(MSG.notReady);
    expect(v.status).toBeUndefined();
    expect(v.showFeedback).toBe(false);
    expect(v.isDemo).toBe(false);
  });
});
