/**
 * What a summary may be made from. A full article gives its paragraphs. A
 * partial result gives only its preview, which Part 04 already limits to the
 * page's own public description or a short free excerpt: a paywalled page's
 * body text never gets here.
 */
import type { Assessment } from '../extract/assess';
import type { SummaryInput } from './provider';

export interface ReadText {
  headline: string;
  url: string;
  paragraphs: string[];
  language?: string;
}

export function summaryInputFor(a: Assessment, read: ReadText): SummaryInput | undefined {
  const { headline, url, language } = read;
  if (a.evidence === 'full' && !a.failure && read.paragraphs.length) {
    return { evidence: 'full', headline, url, paragraphs: read.paragraphs, language };
  }
  // A PDF read only in part keeps its "first pages" display instead.
  if (a.evidence === 'partial' && a.preview && !a.extract?.truncated) {
    return { evidence: 'partial', headline, url, previewText: a.preview, language };
  }
  return undefined;
}
