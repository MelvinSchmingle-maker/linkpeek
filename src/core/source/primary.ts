/**
 * Links from an article to primary sources: government sites, courts, research
 * papers and PDF reports. The card shows how many there are. It doesn't say
 * whether they support the article, and a missing link proves nothing.
 *
 * The lists are short and rough on purpose. A link to a government site is
 * counted as one whatever it says, and a research site is counted even when
 * the link is to its news page. That's the price of a list anyone can read.
 */
import type { PrimaryCounts } from '../types';

const COURT = /(^|\.)(justice\.gov|judiciary\.uk|bailii\.org|supremecourt\.uk|uscourts\.gov|courtsandtribunals\.[a-z.]+)$/;
const GOVERNMENT = /(^|\.)(gov|gov\.uk|gov\.scot|gov\.wales|gov\.au|gov\.nz|gc\.ca|europa\.eu|un\.org)$/;
const RESEARCH =
  /(^|\.)(doi\.org|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|nature\.com|science\.org|thelancet\.com|nejm\.org|bmj\.com|sciencedirect\.com|jstor\.org|cochranelibrary\.com)$/;

/** Which primary-source kind a link is, if any. */
export function primaryKind(href: string): keyof PrimaryCounts | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (/\.pdf$/i.test(url.pathname)) return 'pdf';
  // Courts before government: some court sites are also .gov.
  if (COURT.test(host)) return 'court';
  if (GOVERNMENT.test(host)) return 'government';
  if (RESEARCH.test(host)) return 'research';
  return undefined;
}

export function primaryCounts(links: string[]): PrimaryCounts {
  const counts: PrimaryCounts = { government: 0, court: 0, research: 0, pdf: 0 };
  for (const link of links) {
    const kind = primaryKind(link);
    if (kind) counts[kind]++;
  }
  return counts;
}
