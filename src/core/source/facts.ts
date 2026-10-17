/**
 * The source card's facts (Part 08): what a page discloses about itself, and
 * where each fact came from. Pure: it takes what the reader already found.
 *
 * Missing facts stay missing. The card says "Not stated" and never turns a
 * gap into a negative. Nothing here scores trust, accuracy or credibility.
 *
 * Not built yet, and so not in SourceInfo: ownership, and independent coverage
 * of the same claim. They'll be new fields with their own evidence, and they
 * won't be guessed.
 */
import type { PageLabel, PageMetadata } from '../extract/html';
import type { SourceFact, SourceInfo } from '../types';
import { articleKindFrom } from './article-type';
import { primaryCounts } from './primary';

export interface SourceInput {
  /** The page's final address, after any redirects. */
  url: string;
  metadata: PageMetadata;
  /** Web links from the article text. Undefined when no article text was read, so nothing can be counted. */
  links?: string[];
  /** Labels such as "Sponsored" found in the article's own area. */
  labels: PageLabel[];
}

export function sourceInfo(input: SourceInput): SourceInfo {
  const { metadata: md, url } = input;
  const origin = md.origin ?? {};
  const info: SourceInfo = {};

  const publisher = md.siteName
    ? { value: md.siteName, from: origin.siteName ?? 'page-text' }
    : hostFact(url);
  if (publisher) info.publisher = publisher;

  const published = fact(md.published, origin.published ?? 'page-text');
  if (published) info.published = published;
  const modified = fact(md.modified, origin.modified ?? 'page-text');
  if (modified) info.modified = modified;
  const author = fact(md.author, origin.author ?? 'byline');
  if (author) info.author = author;

  // Only the page's own structured type counts here. Its og:type is too vague to sort on.
  const schemaType = origin.type === 'structured-data' ? md.type : undefined;
  const kind = articleKindFrom({ url, labels: input.labels, schemaType });
  if (kind) info.articleType = kind;

  // Zero links in an article we did read is a real count. No article text means nothing was counted.
  if (input.links) info.primarySources = { value: primaryCounts(input.links), from: 'article-links' };

  return info;
}

function fact(value: string | undefined, from: SourceFact<string>['from']): SourceFact<string> | undefined {
  return value ? { value, from } : undefined;
}

/** The web address's host, as a last resort publisher name. "www." is dropped. */
function hostFact(url: string): SourceFact<string> | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host ? { value: host, from: 'address' } : undefined;
  } catch {
    return undefined;
  }
}
