import { describe, expect, it, vi } from 'vitest';
import { MSG } from '../core/messages';
import type { LinkResult } from '../core/types';
import { renderCard } from './card';
import { toCardView } from './view-model';

const link = { href: 'https://example.test/a', textContent: 'A headline' };

function result(headlineCheck: LinkResult['headlineCheck'], evidence: LinkResult['evidence'] = 'full'): LinkResult {
  return {
    id: 'r-test',
    url: link.href,
    headline: "You won't believe what the council found",
    evidence,
    headlineCheck,
    linkRisk: { level: 'not-checked' },
    isDemo: false,
    ...(evidence === 'full' ? { summary: { text: 'The council found plans for a new depot.', wordCount: 8, provider: 'extractive' as const } } : {}),
  };
}

function card(r: LinkResult) {
  return renderCard(toCardView({ kind: 'result', result: r }), link.href, { onClose: vi.fn(), onFeedback: vi.fn(), onFeedbackReason: vi.fn(), onDisagree: vi.fn() });
}

describe('the headline check on the card (Part 07)', () => {
  it('a cross shows its status, reason, and a labelled rewrite, with the reveal note when it holds a result back', () => {
    const c = card(
      result({ verdict: 'fail', reason: MSG.insufficient, rewrite: 'Council plans a new depot.', revealsWithheld: true }),
    );
    expect(c.querySelector('[data-status="fail"]')?.textContent).toBe('Possible clickbait');
    expect(c.querySelector('.rewrite-label')?.textContent).toBe(MSG.rewriteLabel);
    expect(c.querySelector('.rewrite')?.textContent).toBe('Council plans a new depot.');
    expect(c.querySelector('.reveal-note')?.textContent).toBe(MSG.revealNote);
  });

  it('a rewrite is never shown as the headline: the headline the page shows is untouched', () => {
    const c = card(result({ verdict: 'fail', reason: 'x', rewrite: 'Council plans a new depot.' }));
    expect(c.textContent).not.toContain(MSG.revealNote);
    expect(c.querySelector('.reveal-note')).toBeNull();
  });

  it('no rewrite block when there is none', () => {
    const c = card(result({ verdict: 'pass', reason: 'The headline\'s figure, £5m, appears in the article.' }));
    expect(c.querySelector('.rewrite')).toBeNull();
    expect(c.querySelector('[data-status="pass"]')).not.toBeNull();
  });

  it('"What does this mean?" is shut at first, opens to the three outcomes, and shuts again', () => {
    const c = card(result({ verdict: 'unknown' }));
    const toggle = c.querySelector<HTMLButtonElement>('.definitions-toggle')!;
    const panel = c.querySelector<HTMLElement>('.definitions')!;
    expect(toggle.textContent).toBe(MSG.whatDoesThisMean);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);

    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.textContent).toContain('It doesn\'t mean the story is false.');
    expect(panel.textContent).toContain("It doesn't mean the story is true.");
    expect(panel.textContent).toContain(MSG.definitionsIntro);

    toggle.click();
    expect(panel.hidden).toBe(true);
  });

  it('a check that has not run shows no status and no explanation toggle', () => {
    const c = card(result({ verdict: 'unknown', notChecked: true }));
    expect(c.querySelector('[data-status]')).toBeNull();
    expect(c.querySelector('.definitions-toggle')).toBeNull();
  });

  it('the definitions say what a cross and a tick are not: not a verdict on whether the story is true', () => {
    const text = MSG.verdictDefinitions.map(([, meaning]) => meaning).join(' ');
    expect(text).toContain('mean the story is false');
    expect(text).not.toMatch(/—|–/); // no em or en dashes
  });
});
