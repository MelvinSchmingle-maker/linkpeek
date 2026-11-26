/**
 * Turns what the extractor found into what is sent for Story Search, and
 * decides whether there is enough to search on at all.
 *
 * Nothing goes out when there isn't: a link that says "Read more" at
 * "example.com/p/12345", with no card around it, would only buy a search for
 * nothing. The card says so instead.
 */
import type { ClueSource, SentClue, StoryClues, StoryRequestClues } from './types';
import { contentWords } from './words';

/** Fewest meaningful words, across every clue, before a search is worth making. */
export const MIN_SEARCH_WORDS = 3;

export type StoryPackage =
  | { ok: true; request: StoryRequestClues; preview: PreviewLine[]; searchText: string }
  | { ok: false; reason: 'insufficient' | 'not-a-web-link' };

/** One line of "what will be sent", in the order the card shows them. */
export interface PreviewLine {
  label: 'headline' | 'other-headline' | 'description' | 'nearby-text' | 'address' | 'date' | 'publisher' | 'selection';
  text: string;
  from?: ClueSource;
}

export function buildPackage(clues: StoryClues | undefined): StoryPackage {
  if (!clues) return { ok: false, reason: 'not-a-web-link' };

  const sent = (c: { text: string; from: ClueSource; confidence: SentClue['confidence'] } | undefined): SentClue | undefined =>
    c ? { text: c.text, from: c.from, confidence: c.confidence } : undefined;

  // Generic link text ("Read more") is kept only as an extra wording when
  // there's nothing better, and never as the headline.
  const headline = sent(clues.headline);
  const alt = clues.altHeadlines.map((c) => sent(c)!);
  if (!headline && clues.linkText && contentWords(clues.linkText.text).length >= 1 && clues.linkText.confidence !== 'low') {
    alt.unshift(sent(clues.linkText)!);
  }

  const request: StoryRequestClues = {
    url: clues.url,
    ...(clues.shortened ? { shortened: true } : {}),
    ...(headline ? { headline } : {}),
    ...(alt.length ? { altHeadlines: alt.slice(0, 3) } : {}),
    ...(clues.description ? { description: sent(clues.description) } : {}),
    ...(clues.context ? { context: sent(clues.context) } : {}),
    ...(clues.slug ? { slug: clues.slug.text } : {}),
    ...(clues.date ? { date: clues.date.text, dateFrom: clues.date.from } : {}),
    ...(clues.publisher ? { publisher: clues.publisher.text } : {}),
    ...(clues.author ? { author: clues.author.text } : {}),
    ...(clues.section ? { section: clues.section.text } : {}),
    ...(clues.keywords.length ? { keywords: clues.keywords } : {}),
    ...(clues.language ? { language: clues.language } : {}),
    ...(clues.selection ? { selection: clues.selection.text } : {}),
  };

  const searchText = [
    request.headline?.text,
    ...(request.altHeadlines ?? []).map((a) => a.text),
    request.description?.text,
    request.slug,
    request.context?.text,
    request.selection,
    ...(request.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  if (new Set(contentWords(searchText)).size < MIN_SEARCH_WORDS) return { ok: false, reason: 'insufficient' };

  return { ok: true, request, preview: previewLines(request), searchText };
}

function previewLines(r: StoryRequestClues): PreviewLine[] {
  const lines: PreviewLine[] = [];
  if (r.headline) lines.push({ label: 'headline', text: r.headline.text, from: r.headline.from });
  for (const a of r.altHeadlines ?? []) lines.push({ label: 'other-headline', text: a.text, from: a.from });
  if (r.description) lines.push({ label: 'description', text: r.description.text, from: r.description.from });
  if (r.context) lines.push({ label: 'nearby-text', text: r.context.text, from: r.context.from });
  if (r.selection) lines.push({ label: 'selection', text: r.selection, from: 'selection' });
  lines.push({ label: 'address', text: r.url, ...(r.slug ? { from: 'url-slug' as const } : {}) });
  if (r.date) lines.push({ label: 'date', text: r.date, ...(r.dateFrom ? { from: r.dateFrom } : {}) });
  if (r.publisher) lines.push({ label: 'publisher', text: r.publisher });
  return lines;
}
