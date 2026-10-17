import { describe, expect, it, vi } from 'vitest';
import { MSG } from '../core/messages';
import type { CorrectionsResult } from '../core/source/corrections';
import type { LinkResult, SourceInfo } from '../core/types';
import { renderCard } from './card';
import { sourceLines, toCardView } from './view-model';

const link = { href: 'https://example.test/a', textContent: 'A headline' };

function result(source?: SourceInfo): LinkResult {
  return {
    id: 'r-test',
    url: link.href,
    headline: 'Bridge reopens after repairs',
    evidence: 'full',
    headlineCheck: { verdict: 'unknown' },
    linkRisk: { level: 'not-checked' },
    isDemo: false,
    summary: { text: 'The footbridge reopened after fourteen weeks of repairs.', wordCount: 9, provider: 'extractive' },
    ...(source ? { source } : {}),
  };
}

const SOURCE: SourceInfo = {
  publisher: { value: 'Harbour Post', from: 'meta-tags' },
  published: { value: '2026-10-12T07:30:00Z', from: 'meta-tags' },
  author: { value: 'Priya Nair', from: 'structured-data' },
  articleType: { value: 'news', from: 'structured-data' },
  primarySources: { value: { government: 1, court: 0, research: 1, pdf: 0 }, from: 'article-links' },
};

function card(r: LinkResult, onCorrections?: () => Promise<CorrectionsResult>) {
  return renderCard(toCardView({ kind: 'result', result: r }), link.href, {
    onClose: vi.fn(),
    onFeedback: vi.fn(),
    onAction: vi.fn(),
    onCorrections,
  });
}

describe('the source card view model', () => {
  it('one line per fact, each with where it came from, and "Not stated" for what is missing', () => {
    const lines = Object.fromEntries(sourceLines(SOURCE).map((l) => [l.label, l]));
    expect(lines.Publisher).toEqual({ label: 'Publisher', value: 'Harbour Post', from: "from the page's meta tags" });
    expect(lines.Published).toMatchObject({ value: '12 October 2026' });
    expect(lines['Last updated']).toEqual({ label: 'Last updated', value: MSG.notStated });
    expect(lines.Author).toMatchObject({ value: 'Priya Nair', from: "from the page's structured data" });
    expect(lines['Article type']).toMatchObject({ value: 'News' });
    expect(lines['Links to primary sources']).toEqual({
      label: 'Links to primary sources',
      value: '1 link to a government site, 1 link to a research paper',
      from: 'counted from the links in the article',
    });
  });

  it('no links counted at all is said as "none of these kinds", not as a verdict', () => {
    const none: SourceInfo = { primarySources: { value: { government: 0, court: 0, research: 0, pdf: 0 }, from: 'article-links' } };
    expect(sourceLines(none).find((l) => l.label === 'Links to primary sources')?.value).toBe(
      'No links to government sites, courts, research papers or PDFs',
    );
  });

  it('the section appears only when the page was read', () => {
    expect(toCardView({ kind: 'result', result: result(SOURCE) }).sourceLines?.length).toBe(6);
    expect(toCardView({ kind: 'result', result: result() }).sourceLines).toBeUndefined();
  });
});

describe('the source card (DOM)', () => {
  it('"About this source" is shut at first, opens to the note and each fact, and shuts again', () => {
    const c = card(result(SOURCE));
    const toggle = c.querySelector<HTMLButtonElement>('.source-toggle')!;
    const panel = c.querySelector<HTMLElement>('.source')!;
    expect(toggle.textContent).toBe(MSG.aboutSource);
    expect(panel.hidden).toBe(true);
    expect(panel.textContent).toBe('');

    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.textContent).toContain(MSG.sourceNote);
    expect(panel.textContent).toContain('Publisher');
    expect(panel.textContent).toContain('Harbour Post');
    expect(panel.textContent).toContain("(from the page's meta tags)");
    expect(panel.textContent).toContain(MSG.notStated);

    toggle.click();
    expect(panel.hidden).toBe(true);
  });

  it('both explainers share one line, after the close button in reading order', () => {
    const c = card(result(SOURCE));
    const row = c.querySelector('.explainers')!;
    expect([...row.children].map((b) => b.textContent)).toEqual([MSG.whatDoesThisMean, MSG.aboutSource]);
    const order = [...c.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(order.indexOf(MSG.close)).toBeLessThan(order.indexOf(MSG.aboutSource));
  });

  it('no explainer line at all when a result has nothing to explain', () => {
    const c = card({ ...result(), headlineCheck: { verdict: 'unknown', notChecked: true } });
    expect(c.querySelector('.explainers')).toBeNull();
  });

  it('the corrections check runs only when its button is pressed, and says what it found', async () => {
    const onCorrections = vi.fn(async (): Promise<CorrectionsResult> => ({ kind: 'found', url: 'https://example.test/corrections' }));
    const c = card(result(SOURCE), onCorrections);
    c.querySelector<HTMLButtonElement>('.source-toggle')!.click();
    expect(onCorrections).not.toHaveBeenCalled();
    expect(c.querySelector('.corrections-status')?.textContent).toBe(MSG.correctionsNotChecked);

    c.querySelector<HTMLButtonElement>('.corrections-look')!.click();
    await vi.waitFor(() => expect(c.querySelector('.corrections-status a')).not.toBeNull());
    expect(onCorrections).toHaveBeenCalledTimes(1);
    expect(c.querySelector('.corrections-status a')?.getAttribute('href')).toBe('https://example.test/corrections');
    expect(c.querySelector('.corrections-status')?.textContent).toContain(MSG.correctionsFound);
  });

  it.each([
    [{ kind: 'not-found' } as CorrectionsResult, MSG.correctionsNotFound],
    [{ kind: 'error' } as CorrectionsResult, MSG.correctionsError],
  ])('shows the words for %j', async (outcome, words) => {
    const c = card(result(SOURCE), async () => outcome);
    c.querySelector<HTMLButtonElement>('.source-toggle')!.click();
    c.querySelector<HTMLButtonElement>('.corrections-look')!.click();
    await vi.waitFor(() => expect(c.querySelector('.corrections-status')?.textContent).toBe(words));
  });

  it('when LinkPeek has no access to the site, it says so and offers the allow button', async () => {
    const c = card(result(SOURCE), async () => ({ kind: 'needs-access' }));
    c.querySelector<HTMLButtonElement>('.source-toggle')!.click();
    c.querySelector<HTMLButtonElement>('.corrections-look')!.click();
    await vi.waitFor(() => expect(c.querySelector('.corrections-status')?.textContent).toContain(MSG.correctionsNeedAccess));
    expect(c.querySelector('.corrections-status button')?.textContent).toBe(MSG.allow);
  });
});
