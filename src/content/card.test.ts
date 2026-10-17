import { describe, expect, it, vi } from 'vitest';
import { MSG } from '../core/messages';
import type { LinkResult } from '../core/types';
import { renderCard } from './card';
import { demoResult } from './fixtures';
import { toCardView } from './view-model';

const link = { href: 'https://example.test/a', textContent: 'A headline' };

function render(key: Parameters<typeof demoResult>[0]) {
  const r = demoResult(key, link);
  const input = r === 'loading' ? ({ kind: 'loading', isDemo: true } as const) : ({ kind: 'result', result: r as LinkResult } as const);
  const handlers = { onClose: vi.fn(), onFeedback: vi.fn() };
  return { card: renderCard(toCardView(input), link.href, handlers), handlers };
}

describe('renderCard', () => {
  it('is a labelled, focusable dialog', () => {
    const { card } = render('full');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-label')).toBe(MSG.cardLabel);
    expect(card.tabIndex).toBe(-1);
  });

  it('pairs the status mark with a text label (never colour alone)', () => {
    const { card } = render('clickbait');
    const status = card.querySelector('[data-status="fail"]');
    expect(status?.textContent).toBe('Possible clickbait');
  });

  it('always tags demo results', () => {
    expect(render('full').card.querySelector('.tag.demo')?.textContent).toBe(MSG.demoTag);
  });

  it('inserts page text as text, never as markup', () => {
    const r = demoResult('full', link) as LinkResult;
    r.summary = { text: '<img src=x onerror=alert(1)>', wordCount: 3, provider: 'demo' };
    const card = renderCard(toCardView({ kind: 'result', result: r }), link.href, { onClose: vi.fn(), onFeedback: vi.fn() });
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.summary')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('open-article link points at the original URL', () => {
    const a = render('full').card.querySelector<HTMLAnchorElement>('a.open');
    expect(a?.getAttribute('href')).toBe(link.href);
    expect(a?.rel).toContain('noopener');
  });

  it('close and feedback buttons call their handlers', () => {
    const { card, handlers } = render('full');
    card.querySelector<HTMLButtonElement>('.close')?.click();
    card.querySelector<HTMLButtonElement>('.thumb[data-value="down"]')?.click();
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onFeedback).toHaveBeenCalledWith('down');
  });

  it('loading has no footer and no feedback', () => {
    const { card } = render('loading');
    expect(card.querySelector('.footer')).toBeNull();
    expect(card.textContent).toContain(MSG.loading);
  });

  it('no feedback buttons where there is nothing to rate', () => {
    expect(render('inaccessible').card.querySelector('.thumb')).toBeNull();
  });
});
