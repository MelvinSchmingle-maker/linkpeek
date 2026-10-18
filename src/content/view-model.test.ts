import { describe, expect, it } from 'vitest';
import { FAILURE_MESSAGE, MSG, SUMMARY_BY } from '../core/messages';
import type { LinkResult, LinkRisk } from '../core/types';
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

  it('a full article with no headline verdict: the label only, no extra reason (we did read it)', () => {
    const v = view('insufficient');
    expect(v.status).toEqual({ verdict: 'unknown', label: 'No headline verdict' });
    expect(v.reason).toBeUndefined();
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

describe('real results (Part 04)', () => {
  const real = (patch: Partial<LinkResult>): LinkResult => ({
    id: 'r-1',
    url: 'https://news.example.com/a',
    headline: 'A headline',
    evidence: 'full',
    headlineCheck: { verdict: 'unknown', notChecked: true },
    linkRisk: { level: 'not-checked' },
    isDemo: false,
    ...patch,
  });

  it('a full article without a summary shows its first sentence, clearly labelled, never as a summary', () => {
    const v = toCardView({ kind: 'result', result: real({ extract: { firstSentence: 'The council met on Tuesday.', wordCount: 400, method: 'readability' } }) });
    expect(v.summary).toBeUndefined();
    expect(v.extract).toBe('The council met on Tuesday.');
    expect(v.extractLabel).toBe(MSG.extractLabel);
    expect(v.showFeedback).toBe(false);
  });

  it('no verdict mark when the headline check has not run', () => {
    const v = toCardView({ kind: 'result', result: real({ extract: { firstSentence: 'x y z.', wordCount: 400, method: 'readability' } }) });
    expect(v.status).toBeUndefined();
    expect(v.reason).toBeUndefined();
  });

  it('asks for permission with a button, and nothing else', () => {
    const v = toCardView({ kind: 'result', result: real({ evidence: 'unavailable', failure: 'permission-denied', needsPermissionFor: 'other.example' }) });
    expect(v.message).toBe('LinkPeek needs your permission to read pages on other.example.');
    expect(v.action).toBe(MSG.allow);
    expect(v.extract).toBeUndefined();
  });

  it('an X card says which site its post links to, and asks for that site', () => {
    const v = toCardView({
      kind: 'result',
      result: real({ url: 'https://t.co/Yfm360MAr4', evidence: 'unavailable', failure: 'permission-denied', needsPermissionFor: 'news.example' }),
    });
    expect(v.message).toBe('This post links to news.example. LinkPeek needs your permission to read pages on news.example.');
    expect(v.action).toBe(MSG.allow);
  });

  it('a subscription page shows the reason and its public description', () => {
    const v = toCardView({ kind: 'result', result: real({ evidence: 'partial', failure: 'paywall', preview: 'A teaser.' }) });
    expect(v.message).toBe(FAILURE_MESSAGE.paywall);
    expect(v.preview).toBe('A teaser.');
    expect(v.evidenceTag).toBe('Preview only');
  });

  it('notes when a link opens on another site, but not for the same site', () => {
    const other = toCardView({ kind: 'result', result: real({ finalUrl: 'https://elsewhere.example/x', extract: { firstSentence: 'a b c.', wordCount: 300, method: 'readability' } }) });
    expect(other.note).toBe('Opens on elsewhere.example.');
    const same = toCardView({ kind: 'result', result: real({ finalUrl: 'https://www.news.example.com/a-moved', extract: { firstSentence: 'a b c.', wordCount: 300, method: 'readability' } }) });
    expect(same.note).toBeUndefined();
  });

  it('a long PDF read only in part says so', () => {
    const v = toCardView({ kind: 'result', result: real({ evidence: 'partial', preview: 'p', extract: { firstSentence: 'The report finds X.', wordCount: 5000, method: 'pdf', truncated: true } }) });
    expect(v.extractLabel).toBe(MSG.pdfPartial);
    expect(v.extract).toBe('The report finds X.');
  });
});

describe('summaries (Part 05)', () => {
  const real = (patch: Partial<LinkResult>): LinkResult => ({
    id: 'r-2',
    url: 'https://news.example.com/b',
    headline: 'A headline',
    evidence: 'full',
    headlineCheck: { verdict: 'unknown', notChecked: true },
    linkRisk: { level: 'not-checked' },
    isDemo: false,
    extract: { firstSentence: 'The council met on Tuesday.', wordCount: 400, method: 'readability' },
    ...patch,
  });

  it("an extractive summary says it is the article's own words, and replaces the first-sentence display", () => {
    const v = toCardView({ kind: 'result', result: real({ summary: { text: 'The council approved new cycle lanes.', wordCount: 6, provider: 'extractive' } }) });
    expect(v.summary).toBe('The council approved new cycle lanes.');
    expect(v.summaryLabel).toBe(SUMMARY_BY.extractive);
    expect(v.extract).toBeUndefined();
    expect(v.showFeedback).toBe(true);
  });

  it("an on-device AI summary says Chrome's AI wrote it", () => {
    const v = toCardView({ kind: 'result', result: real({ summary: { text: 'Council approves cycle lanes for High Street.', wordCount: 7, provider: 'chrome-on-device' } }) });
    expect(v.summaryLabel).toBe(SUMMARY_BY['chrome-on-device']);
  });

  it('demo summaries keep the demo tag and get no "who wrote it" line', () => {
    const v = toCardView({ kind: 'result', result: real({ isDemo: true, summary: { text: 'Made-up summary here.', wordCount: 3, provider: 'demo' } }) });
    expect(v.summaryLabel).toBeUndefined();
  });

  it('a partial page shows its 20-word preview under the preview notice, not as a summary', () => {
    const v = toCardView({
      kind: 'result',
      result: real({ evidence: 'partial', extract: undefined, preview: 'A long description that goes on…', summary: { text: 'A short preview.', wordCount: 3, provider: 'extractive', flags: ['preview'] } }),
    });
    expect(v.summary).toBeUndefined();
    expect(v.message).toBe(MSG.partialIntro);
    expect(v.preview).toBe('A short preview.');
  });

  it('offers "Disagree with this rating?" under a tick or a cross, never under "no verdict"', () => {
    expect(view('full').canDisagree).toBe(true);
    expect(view('clickbait').canDisagree).toBe(true);
    expect(view('partial').canDisagree).toBeFalsy();
    expect(view('insufficient').canDisagree).toBeFalsy();
  });

  it('a link check shows its outcome in words, and never "safe"', () => {
    // A real link, not a demo: demo cards show no link check line.
    const risk = (level: LinkRisk['level'], extra: Partial<LinkRisk> = {}) => ({ ...result('full'), isDemo: false, linkRisk: { level, ...extra } }) as LinkResult;
    const line = (level: LinkRisk['level'], extra?: Partial<LinkRisk>) =>
      toCardView({ kind: 'result', result: risk(level, extra) }).linkCheck;
    expect(line('no-known-warning')).toEqual({ label: 'No known warning', notes: ["This isn't a guarantee of safety."] });
    expect(line('not-checked', { reason: 'This is a link shortener.' })).toEqual({ label: 'Not checked', notes: ['This is a link shortener.'] });
    expect(JSON.stringify(line('no-known-warning'))).not.toMatch(/\bsafe\b/);
  });

  it('a warning gets a red row and the "Don\'t warn me" button, but an overruled one only a quiet line', () => {
    const r = (linkRisk: LinkRisk) => ({ ...result('full'), isDemo: false, linkRisk }) as LinkResult;
    const open = toCardView({ kind: 'result', result: r({ level: 'suspicious', reason: 'Looks like PayPal.', site: 'paypa1.com' }) });
    expect(open).toMatchObject({ warning: 'Suspicious destination', warningDetail: 'Looks like PayPal.', canOverrule: true, openLabel: 'Open link anyway' });
    const off = toCardView({ kind: 'result', result: r({ level: 'suspicious', reason: 'Looks like PayPal.', site: 'paypa1.com', overruled: true }) });
    expect(off.warning).toBeUndefined();
    expect(off.canOverrule).toBeUndefined();
    expect(off.linkCheck?.notes).toEqual([MSG.overruled('paypa1.com')]);
  });

  it('a redirect check note is shown under the outcome, and the check can be offered', () => {
    const v = toCardView({ kind: 'result', result: { ...result('full'), isDemo: false, linkRisk: { level: 'not-checked', reason: 'Shortener.', site: 'bit.ly', note: 'It goes to example.test.' } } as LinkResult });
    expect(v.linkCheck?.notes).toEqual(['Shortener.', 'It goes to example.test.']);
    expect(v.canCheckWhere).toBe(true);
  });
});
