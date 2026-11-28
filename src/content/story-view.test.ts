/**
 * The Story Search card, state by state (pure view model, then the DOM).
 * The rule that matters most: nothing that isn't an established report
 * looks like one.
 */
import { describe, expect, it } from 'vitest';
import type { StoryReport } from '../core/story/types';
import { renderStoryCard } from './story-card';
import { formatDay, toStoryView } from './story-view';

const report = (patch: Partial<StoryReport> = {}): StoryReport => ({
  status: 'report',
  subject: 'Singer Jamie Rivers found dead in Paris hotel',
  match: 'strong',
  confidence: 'strong',
  whatHappened: [{ text: 'Police in Paris are investigating the death of Jamie Rivers, found at a hotel on 24 November 2026.', sources: [1, 2] }],
  details: [{ label: 'where', text: 'The Grand Meridian hotel, Paris.', sources: [1] }],
  confirmed: [{ text: 'Prosecutors have opened an inquiry.', sources: [1, 3] }],
  reported: [{ text: 'He was 34.', sources: [2] }],
  unclear: [{ text: 'The cause of death has not been established by the sources reviewed.', sources: [] }],
  sources: [
    { n: 1, title: 'Jamie Rivers found dead', publisher: 'BBC News', url: 'https://www.bbc.co.uk/news/x', published: '2026-11-24', kind: 'news', match: 'strong' },
    { n: 2, title: 'Rivers dies aged 34', publisher: 'The Guardian', url: 'https://www.theguardian.com/x', published: '2026-11-24', kind: 'news', match: 'strong' },
    { n: 3, title: 'Communiqué', publisher: 'prefecturedepolice.interieur.gouv.fr', url: 'https://www.prefecturedepolice.interieur.gouv.fr/x', kind: 'primary', match: 'strong' },
  ],
  setAside: 2,
  notes: [],
  searchedFor: 'Pop star Jamie Rivers found dead in Paris hotel',
  checkedAt: '2026-11-26T10:00:00.000Z',
  ...patch,
});

const sectionIds = (r: StoryReport) => toStoryView({ kind: 'report', report: r }).sections.map((s) => s.id);

describe('story view', () => {
  it('a full report has every section, in order, each line with its sources', () => {
    const v = toStoryView({ kind: 'report', report: report() });
    expect(v.sections.map((s) => s.heading)).toEqual(['What happened?', 'Key details', 'What is confirmed?', 'Reported, not confirmed', 'What remains unclear?']);
    expect(v.tags.map((t) => t.text)).toEqual(['Strong match', 'Strong evidence']);
    expect(v.sections[0]!.items[0]!.refs).toEqual([1, 2]);
    expect(v.sources[0]!.meta).toBe('BBC News · 24 November 2026 · News');
    expect(v.sources[2]!.meta).toContain('Official source');
    expect(v.sourcesHeading).toBe('Supporting sources');
    expect(v.setAside).toBe('2 search results set aside as not about this story.');
    expect(v.footnote).toMatch(/^Written by AI \(Claude\)/);
    expect(v.caution).toBeUndefined();
  });

  it('a report built on possible matches says so first, and labels each source', () => {
    const v = toStoryView({ kind: 'report', report: report({ match: 'possible', confidence: 'partial', sources: report().sources.map((s) => ({ ...s, match: 'possible' as const })) }) });
    expect(v.caution).toMatch(/may be about a different story/);
    expect(v.tags[0]).toEqual({ text: 'Possible match', tone: 'possible' });
    expect(v.sources.every((s) => s.tags.includes('Possible match'))).toBe(true);
    expect(v.sourcesHeading).toBe('Possibly related sources');
  });

  it.each(['no-results', 'no-match'] as const)('%s shows no report sections, only why', (status) => {
    const v = toStoryView({ kind: 'report', report: report({ status, match: 'none', confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [], sources: [] }) });
    expect(v.sections).toEqual([]);
    expect(v.sources).toEqual([]);
    expect(v.tags).toEqual([{ text: 'No reliable match', tone: 'none' }]);
    expect(v.message).toBe(status === 'no-results' ? 'No reports about this story were found.' : "The search found results, but none clearly about this story. LinkPeek won't guess.");
    expect(v.searchedFor).toBe('Pop star Jamie Rivers found dead in Paris hotel');
  });

  it('a report the AI could not write lists possible sources only, and offers a retry', () => {
    const r = report({ status: 'report-failed', match: 'possible', confidence: 'insufficient', whatHappened: [], details: [], confirmed: [], reported: [], unclear: [] });
    const v = toStoryView({ kind: 'report', report: r });
    expect(v.sections).toEqual([]);
    expect(v.message).toMatch(/^Couldn't write a report/);
    expect(v.sourcesHeading).toBe('Possibly related sources');
    expect(v.retry).toBe('Try again');
    expect(v.footnote).toBeUndefined();
  });

  it('only one source: the note says so', () => {
    expect(toStoryView({ kind: 'report', report: report({ notes: ['single-source', 'developing'] }) }).notes).toEqual([
      'Only one independent source was found.',
      'This story may still be developing. Details may change.',
    ]);
  });

  it('conflicting reports are tagged as such', () => {
    expect(toStoryView({ kind: 'report', report: report({ confidence: 'conflicting' }) }).tags[1]).toEqual({ text: 'Conflicting information', tone: 'conflicting' });
  });

  it('no "What is confirmed?" heading when nothing was confirmed', () => {
    expect(sectionIds(report({ confirmed: [] }))).not.toContain('confirmed');
  });

  it('progress shows the four stages, the current one marked', () => {
    const v = toStoryView({ kind: 'progress', stage: 'analysing', subject: 'Ferry strike' });
    expect(v.stages).toEqual([
      { label: 'Extracting link information', state: 'done' },
      { label: 'Searching for matching stories', state: 'done' },
      { label: 'Analysing relevant sources', state: 'active' },
      { label: 'Preparing the report', state: 'todo' },
    ]);
    expect(v.busy).toBe(true);
  });

  it('errors are plain, and offer a retry only where it can help', () => {
    expect(toStoryView({ kind: 'error', code: 'search-failed' })).toMatchObject({ message: "The search service didn't answer. Try again in a minute.", retry: 'Try again' });
    expect(toStoryView({ kind: 'error', code: 'search-timeout' }).retry).toBe('Try again');
    expect(toStoryView({ kind: 'error', code: 'not-configured' })).toMatchObject({ message: "Story Search isn't set up in this version of LinkPeek." });
    expect(toStoryView({ kind: 'error', code: 'not-configured' }).retry).toBeUndefined();
    expect(toStoryView({ kind: 'insufficient' }).message).toMatch(/isn't enough information/);
    // Out of free searches: says when it works again, and offers no pointless retry.
    expect(toStoryView({ kind: 'error', code: 'out-of-credit' })).toMatchObject({ message: expect.stringMatching(/free searches.*renew/) });
    expect(toStoryView({ kind: 'error', code: 'out-of-credit' }).retry).toBeUndefined();
  });

  it('dates read as dates, and a month alone never gains a day', () => {
    expect(formatDay('2026-11-25')).toBe('25 November 2026');
    expect(formatDay('2026-11')).toBe('November 2026');
    const v = toStoryView({ kind: 'confirm', preview: [{ label: 'date', text: '2026-11', from: 'url-date' }] });
    expect(v.confirm!.lines[0]).toEqual({ label: 'Date', text: 'November 2026', from: 'from the address' });
  });

  it('the confirmation lists what will be sent and where each part came from', () => {
    const v = toStoryView({
      kind: 'confirm',
      preview: [
        { label: 'headline', text: 'Ferry strike called off', from: 'card-heading' },
        { label: 'address', text: 'https://paper.example.org/a', from: 'url-slug' },
      ],
    });
    expect(v.confirm!.lines).toEqual([
      { label: 'Headline', text: 'Ferry strike called off', from: 'from the article card' },
      { label: 'Link address', text: 'https://paper.example.org/a' },
    ]);
    expect(v.confirm!.notSent).toMatch(/Not sent: this page's address, your cookies/);
  });
});

describe('evidence, headline accuracy and source marks', () => {
  const withEvidence = report({
    whatHappened: [{ text: 'Police in Paris are investigating the death of Jamie Rivers.', sources: [1, 2], evidence: [{ source: 1, quote: 'French police say the body of the singer Jamie Rivers was found' }, { source: 2, quote: 'Rivers, 34, was discovered in a suite' }] }],
    reported: [{ text: 'He was 34.', sources: [2], evidence: [{ source: 2, quote: 'Rivers dies aged 34 in Paris' }], weak: true }],
    headline: { headline: 'Pop star Jamie Rivers found dead in Paris hotel', verdict: 'accurate', reason: 'The reports establish that he was found dead at a Paris hotel.', evidence: [{ source: 1, quote: 'Jamie Rivers was found at the Grand Meridian hotel in Paris' }] },
    sources: [...report().sources.slice(0, 2).map((s, i) => (i === 0 ? { ...s, corrected: true, updated: '2026-11-25' } : s)), report().sources[2]!],
  });

  it('each claim can show the passages behind it, named by source; a weak one says so', () => {
    const v = toStoryView({ kind: 'report', report: withEvidence });
    expect(v.sections[0]!.items[0]!.evidence).toEqual([
      { ref: '[1] BBC News', quote: 'French police say the body of the singer Jamie Rivers was found' },
      { ref: '[2] The Guardian', quote: 'Rivers, 34, was discovered in a suite' },
    ]);
    const card = renderStoryCard(v, 'https://news.example.com/a', { onClose: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, onRetry: () => undefined });
    const details = card.querySelectorAll('details.story-evidence');
    // Closed until asked for: the report stays short.
    expect([...details].every((d) => !(d as HTMLDetailsElement).open)).toBe(true);
    expect(details[0]!.querySelector('summary')!.textContent).toBe('Show evidence');
    expect(details[0]!.querySelector('q')!.textContent).toBe('French police say the body of the singer Jamie Rivers was found');
    expect(card.querySelector('.reported .story-evidence-weak')!.textContent).toBe("The quoted passages don't show all of this. Check the source.");
  });

  it('the headline verdict comes after the report, with its reason and evidence', () => {
    const v = toStoryView({ kind: 'report', report: withEvidence });
    expect(v.headline).toMatchObject({ heading: 'Is the headline accurate?', verdict: 'Accurate', tone: 'strong', headline: 'Pop star Jamie Rivers found dead in Paris hotel' });
    const card = renderStoryCard(v, 'https://news.example.com/a', { onClose: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, onRetry: () => undefined });
    const sections = [...card.querySelectorAll('section h3')].map((h) => h.textContent);
    expect(sections.indexOf('Is the headline accurate?')).toBe(sections.indexOf('What remains unclear?') + 1);
    expect(card.querySelector('.story-verdict')!.textContent).toBe('Accurate');
    expect(card.querySelector('.story-headline-checked')!.textContent).toBe('Headline: “Pop star Jamie Rivers found dead in Paris hotel”');
    for (const verdict of ['partly-accurate', 'misleading', 'unverified'] as const) {
      const hv = toStoryView({ kind: 'report', report: report({ headline: { ...withEvidence.headline!, verdict } }) });
      expect(hv.headline!.verdict).toBe({ 'partly-accurate': 'Partly accurate', misleading: 'Misleading', unverified: 'Unverified' }[verdict]);
    }
    // No headline check, no section.
    expect(toStoryView({ kind: 'report', report: report() }).headline).toBeUndefined();
  });

  it('a corrected or updated source says so; the update is never shown as the story’s date', () => {
    const v = toStoryView({ kind: 'report', report: withEvidence });
    expect(v.sources[0]!.meta).toBe('BBC News · 24 November 2026 · updated 25 November 2026 · News');
    expect(v.sources[0]!.tags).toContain('Corrected by its publisher');
  });

  it('the new notes have plain wording', () => {
    const v = toStoryView({ kind: 'report', report: report({ notes: ['no-established-sources', 'withdrawn'] }) });
    expect(v.notes).toEqual([
      "None of these sources is a news agency, a news organisation LinkPeek recognises or an official body, so nothing here counts as confirmed.",
      'A result was left out because its publisher withdrew it.',
    ]);
  });
});

describe('what LinkPeek read, and how independent the sources are (D75, D77)', () => {
  const deep = report({
    independent: 2,
    sources: [
      { ...report().sources[0]!, depth: 'full' },
      { ...report().sources[1]!, depth: 'excerpt', copyOf: 1 },
      { ...report().sources[2]!, depth: 'extended', original: true },
    ],
  });

  it('says how many sources and independent reports, of which kinds, what was read, and whether the linked article was found', () => {
    const v = toStoryView({ kind: 'report', report: deep });
    expect(v.sourcesSummary).toEqual([
      '3 sources, 2 independent reports: 2 news organisations, 1 official source.',
      'LinkPeek read the full text of 1, a long extract of 1 and a short excerpt of 1.',
      'The linked article itself is one of the sources.',
    ]);
    expect(v.sources[0]!.meta).toContain('Full text');
    expect(v.sources[1]!.meta).toContain('Short excerpt');
  });

  it('with only excerpts, the note says so plainly (once), and an unknown site is called unrecognised', () => {
    const r = report({ notes: ['excerpts-only'], sources: report().sources.map((s, i) => ({ ...s, depth: 'excerpt' as const, ...(i === 2 ? { kind: 'other' as const } : {}) })) });
    const v = toStoryView({ kind: 'report', report: r });
    expect(v.notes.join(' ')).toMatch(/only short excerpts chosen by the search service, not the articles themselves/);
    expect(v.sourcesSummary!.join(' ')).not.toMatch(/LinkPeek read/);
    expect(v.sourcesSummary![0]).toBe('3 sources: 2 news organisations, 1 unrecognised website.');
    expect(v.sourcesSummary).toContain("The linked article itself wasn't among the results: this report rests on other coverage.");
    expect(v.sources[2]!.meta).toContain('Unrecognised website');
  });

  it('a weak claim is tagged where it can be seen; the evidence stays closed', () => {
    const r = report({ reported: [{ text: 'He was 34.', sources: [2], evidence: [{ source: 2, quote: 'Rivers dies aged 34 in Paris' }], weak: true }] });
    const card = renderStoryCard(toStoryView({ kind: 'report', report: r }), 'https://paper.example.org/a', { onClose: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, onRetry: () => undefined });
    const claim = [...card.querySelectorAll('.reported .claim')].find((c) => c.textContent?.includes('He was 34.'))!;
    expect(claim.querySelector('.story-weak-tag')?.textContent).toBe('Weak evidence');
    expect(claim.querySelector('details.story-evidence')?.hasAttribute('open')).toBe(false);
    expect(card.querySelector('.story-sources-summary')?.textContent).toContain('3 sources');
  });
});

describe('story card (DOM)', () => {
  const handlers = { onClose: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, onRetry: () => undefined };

  it('shows page and search text as text, never as markup', () => {
    const evil = report({ subject: '<img src=x onerror=alert(1)>', sources: [{ ...report().sources[0]!, title: '<script>alert(1)</script>' }], whatHappened: [{ text: '<b>bold</b>', sources: [1] }], details: [], confirmed: [], reported: [], unclear: [] });
    const card = renderStoryCard(toStoryView({ kind: 'report', report: evil }), 'https://paper.example.org/a', handlers);
    expect(card.querySelector('img, script, b')).toBeNull();
    expect(card.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('source links open in a new tab without a referrer; the original link is only offered', () => {
    const card = renderStoryCard(toStoryView({ kind: 'report', report: report() }), 'https://paper.example.org/a', handlers);
    const links = [...card.querySelectorAll<HTMLAnchorElement>('.story-source-link')];
    expect(links).toHaveLength(3);
    for (const a of links) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener noreferrer');
    }
    expect(card.querySelector<HTMLAnchorElement>('.open')!.href).toBe('https://paper.example.org/a');
    expect(card.querySelectorAll('.ref').length).toBeGreaterThan(0);
  });

  it('while searching, no link is offered and the body is marked busy', () => {
    const card = renderStoryCard(toStoryView({ kind: 'progress', stage: 'searching' }), 'https://paper.example.org/a', handlers);
    expect(card.querySelector('.open')).toBeNull();
    expect(card.querySelector('.body')!.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelector('[aria-current="step"]')!.textContent).toContain('Searching for matching stories');
  });

  it('the confirmation has Search and Not now, wired to their handlers', () => {
    const calls: string[] = [];
    const card = renderStoryCard(toStoryView({ kind: 'confirm', preview: [{ label: 'headline', text: 'Ferry strike called off', from: 'link-text' }] }), 'https://paper.example.org/a', {
      ...handlers,
      onConfirm: () => calls.push('go'),
      onCancel: () => calls.push('cancel'),
    });
    card.querySelector<HTMLButtonElement>('.story-go')!.click();
    card.querySelector<HTMLButtonElement>('.story-cancel')!.click();
    expect(calls).toEqual(['go', 'cancel']);
  });
});
