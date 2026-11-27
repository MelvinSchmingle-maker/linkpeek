/**
 * What kind of source each result is, and which results are really the same
 * report.
 *
 * Ten sites running the same Reuters story are one source, not ten
 * confirmations. Results are grouped when they credit the same news agency,
 * carry largely the same text, or have the same headline. Each group counts
 * once when deciding whether something is confirmed.
 *
 * The lists here are rough rules, like the primary-source list in the
 * extension (src/core/source/primary.ts). They decide ordering and labels
 * ("News agency", "Official source"), never a trust score, and nothing on
 * them is shown as "trusted".
 */
import type { SourceKind } from './contract.js';
import type { SearchHit } from './providers/types.js';
import { jaccard, shingles, terms } from './text.js';

/** News agencies: their reports are syndicated widely. Host suffix -> name. */
const AGENCIES: Record<string, string> = {
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'afp.com': 'AFP',
  'pa.media': 'PA Media',
  'ansa.it': 'ANSA',
  'dpa.com': 'dpa',
  'efe.com': 'EFE',
  'aap.com.au': 'AAP',
  'kyodonews.net': 'Kyodo News',
  'upi.com': 'UPI',
  'xinhuanet.com': 'Xinhua',
  'tass.com': 'TASS',
  'pti.in': 'PTI',
  'thecanadianpress.com': 'The Canadian Press',
};

/** How agencies are credited in copies: "(Reuters) -", "By The Associated Press", "AFP". */
const AGENCY_CREDIT: [RegExp, string][] = [
  [/\(Reuters\)|\bReuters\b\s*[-—–]|\bby Reuters\b|Reporting by .*?(Reuters)?;? Editing by/i, 'Reuters'],
  [/\(AP\)\s*[-—–]|\bThe Associated Press\b|\bAssociated Press\b/i, 'Associated Press'],
  [/\(AFP\)|\bAgence France-Presse\b|\bAFP\b\s*[-—–]/i, 'AFP'],
  [/\bPA Media\b|\(PA\)\s*[-—–]|\bPress Association\b/i, 'PA Media'],
];

const SOCIAL = [
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com', 'youtube.com', 'threads.net',
  'bsky.app', 'linkedin.com', 't.me', 'truthsocial.com', 'mastodon.social', 'snapchat.com', 'quora.com', 'medium.com',
  'substack.com', 'tumblr.com', 'pinterest.com', 'weibo.com',
];

/** Government, police, courts, parliaments, and international organisations (.int: the UN agencies, WHO, NATO, Interpol). */
const PRIMARY_HOST = /(^|\.)(gov|gov\.[a-z]{2}|gouv\.[a-z]{2}|gob\.[a-z]{2}|govt\.nz|mil|int|police\.uk|nhs\.uk|parliament\.uk|judiciary\.uk|europa\.eu|un\.org|uscourts\.gov|supremecourt\.gov)$/i;
const PRIMARY_LABEL = /(^|\.)(police|polizei|court|courts|justice|parliament|senate|congress)\./i;

/** A short list of news organisations. Unknown sites are "other", never a negative. */
const NEWS: Record<string, string> = {
  'bbc.co.uk': 'BBC News', 'bbc.com': 'BBC News', 'theguardian.com': 'The Guardian', 'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post', 'wsj.com': 'The Wall Street Journal', 'ft.com': 'Financial Times',
  'cnn.com': 'CNN', 'nbcnews.com': 'NBC News', 'cbsnews.com': 'CBS News', 'abcnews.go.com': 'ABC News', 'npr.org': 'NPR',
  'latimes.com': 'Los Angeles Times', 'usatoday.com': 'USA Today', 'politico.com': 'Politico', 'politico.eu': 'Politico Europe',
  'axios.com': 'Axios', 'bloomberg.com': 'Bloomberg', 'economist.com': 'The Economist', 'theatlantic.com': 'The Atlantic',
  'telegraph.co.uk': 'The Telegraph', 'thetimes.com': 'The Times', 'thetimes.co.uk': 'The Times', 'independent.co.uk': 'The Independent',
  'news.sky.com': 'Sky News', 'itv.com': 'ITV News', 'channel4.com': 'Channel 4 News', 'aljazeera.com': 'Al Jazeera',
  'dw.com': 'DW', 'france24.com': 'France 24', 'lemonde.fr': 'Le Monde', 'spiegel.de': 'Der Spiegel', 'elpais.com': 'El País',
  'abc.net.au': 'ABC News (Australia)', 'cbc.ca': 'CBC News', 'irishtimes.com': 'The Irish Times', 'rte.ie': 'RTÉ',
  'scotsman.com': 'The Scotsman', 'thehill.com': 'The Hill', 'foxnews.com': 'Fox News', 'nypost.com': 'New York Post',
  'dailymail.co.uk': 'Daily Mail', 'mirror.co.uk': 'Daily Mirror', 'thesun.co.uk': 'The Sun', 'variety.com': 'Variety',
  'billboard.com': 'Billboard', 'rollingstone.com': 'Rolling Stone', 'hollywoodreporter.com': 'The Hollywood Reporter',
  'people.com': 'People', 'tmz.com': 'TMZ', 'eonline.com': 'E! News', 'time.com': 'Time', 'newsweek.com': 'Newsweek',
  'cnbc.com': 'CNBC', 'marketwatch.com': 'MarketWatch', 'forbes.com': 'Forbes', 'businessinsider.com': 'Business Insider',
  'theverge.com': 'The Verge', 'wired.com': 'Wired', 'arstechnica.com': 'Ars Technica', 'techcrunch.com': 'TechCrunch',
  'nature.com': 'Nature', 'science.org': 'Science', 'newscientist.com': 'New Scientist', 'pbs.org': 'PBS',
};

const OPINION_PATH = /\/(opinion|opinions|comment|commentisfree|op-?ed|editorials?|columns?|columnists?|views|letters|blogs?)\//i;
const OPINION_TITLE = /^(opinion|comment|analysis|view|editorial|column)\s*[:|–—-]/i;

/**
 * Links that only redirect to a story and hide its publisher (Google News's
 * article links, seen in Tavily's news results with about 150 characters of
 * text). Dropped: a source has to say who published it.
 */
export function isRedirectWrapper(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'news.google.com' || /(^|\.)google\.[a-z.]+$/.test(host) || host === 'l.facebook.com' || host === 't.co';
  } catch {
    return true;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m|amp|mobile|edition|uk|us|eu)\./, '');
  } catch {
    return '';
  }
}

function lookup<T>(table: Record<string, T>, host: string): T | undefined {
  for (let h = host; h.includes('.'); h = h.slice(h.indexOf('.') + 1)) if (table[h] !== undefined) return table[h];
  return undefined;
}

export function sourceKind(url: string, title = ''): SourceKind {
  const host = hostOf(url);
  if (lookup(AGENCIES, host)) return 'agency';
  if (PRIMARY_HOST.test(host) || PRIMARY_LABEL.test(`${host}.`)) return 'primary';
  if (SOCIAL.some((s) => host === s || host.endsWith(`.${s}`))) return 'social';
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    // Not an address.
  }
  if (OPINION_PATH.test(path) || OPINION_TITLE.test(title)) return 'opinion';
  if (lookup(NEWS, host) || /\/(news|world|politics|uk-news|us-news|business|local)\//i.test(path) || /\/(19|20)\d{2}\/\d{1,2}\//.test(path)) {
    return 'news';
  }
  return 'other';
}

export function publisherName(url: string, given?: string): string {
  const host = hostOf(url);
  const known = lookup(AGENCIES, host) ?? lookup(NEWS, host);
  if (known) return known;
  if (given && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(given)) return given.slice(0, 100);
  return host || 'Unknown site';
}

/**
 * The same page under different addresses: "www.", "amp." and "m." hosts,
 * /amp endings, tracking parameters, a trailing slash.
 */
export function canonicalKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ocid|cmpid|ref|output(type)?|amp)/i.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const host = u.hostname.toLowerCase().replace(/^(www|m|amp|mobile)\./, '');
    const path = u.pathname.replace(/\/amp\/?$|\.amp(\.html)?$/i, '').replace(/\/+$/, '');
    return `${host}${path}${u.search}`;
  } catch {
    return url;
  }
}

/** The agency a report credits, from its address, author or text. */
export function creditedAgency(hit: SearchHit): string | undefined {
  const own = lookup(AGENCIES, hostOf(hit.url));
  if (own) return own;
  const text = [hit.author ?? '', hit.description ?? '', ...hit.passages].join(' \n ');
  for (const [pattern, name] of AGENCY_CREDIT) if (pattern.test(text)) return name;
  return undefined;
}

export interface Grouping {
  /** For each hit (by index), its group number. Hits in one group are one report. */
  group: number[];
  /** For each hit, the index of the hit it copies, if it isn't the group's original. */
  copyOf: (number | undefined)[];
  /** The agency each group credits, if any. */
  via: (string | undefined)[];
}

/**
 * Groups hits that are the same report: credited to the same agency, largely
 * the same text (five-word shingles), or the same headline. The group's
 * original is the agency's own page if present, else the earliest dated.
 */
export function groupReports(hits: SearchHit[]): Grouping {
  const parent = hits.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const agency = hits.map(creditedAgency);
  const text = hits.map((h) => shingles([h.description ?? '', ...h.passages].join(' ')));
  const title = hits.map((h) => terms(h.title).join(' '));
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      if (agency[i] && agency[i] === agency[j]) join(i, j);
      else if (title[i] && title[i] === title[j] && hostOf(hits[i]!.url) !== hostOf(hits[j]!.url)) join(i, j);
      else if (jaccard(text[i]!, text[j]!) >= 0.5) join(i, j);
    }
  }
  const roots = hits.map((_, i) => find(i));
  const original = new Map<number, number>();
  for (let i = 0; i < hits.length; i++) {
    const r = roots[i]!;
    const cur = original.get(r);
    if (cur === undefined) {
      original.set(r, i);
      continue;
    }
    const better =
      (sourceKind(hits[i]!.url) === 'agency' && sourceKind(hits[cur]!.url) !== 'agency') ||
      (sourceKind(hits[cur]!.url) !== 'agency' && (hits[i]!.published ?? '9999') < (hits[cur]!.published ?? '9999'));
    if (better) original.set(r, i);
  }
  const groupIds = [...new Set(roots)];
  return {
    group: roots.map((r) => groupIds.indexOf(r)),
    copyOf: roots.map((r, i) => (original.get(r) === i ? undefined : original.get(r))),
    via: roots.map((r) => {
      const members = hits.map((_, i) => i).filter((i) => roots[i] === r);
      return members.map((i) => agency[i]).find(Boolean);
    }),
  };
}
