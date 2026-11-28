/**
 * What kind of source each result is, and which results are really the same
 * report.
 *
 * Ten sites running the same Reuters story are one source, not ten
 * confirmations. Results are grouped when they carry the same agency's
 * dateline or byline, largely the same text, or say they first appeared in
 * another's pages. A shared headline alone is not enough: independently
 * written reports often get the same headline (D70). Each group counts once
 * when deciding whether something is confirmed.
 *
 * Which sources can confirm (corroborates): news agencies and the news
 * organisations listed here. An official source can establish what it
 * announced (a statement attributed to someone), not every detail of an
 * event. Opinion, social media and sites LinkPeek doesn't recognise never
 * count towards confirmation, whatever the AI says. The same rule decides
 * when the search has found enough (investigate.ts) and what the report may
 * call confirmed (report.ts).
 *
 * The lists here are rough rules, like the primary-source list in the
 * extension (src/core/source/primary.ts). They decide ordering, labels
 * ("News agency", "Official source") and what can confirm, never a trust
 * score, and nothing on them is shown as "trusted".
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

/**
 * How agencies are credited in their copies: a dateline ("PARIS (Reuters) -",
 * "(AP) —", "Paris (AFP) –") or a byline ("By The Associated Press"). A
 * report that only mentions an agency ("the Associated Press reported") is
 * not a copy of it.
 */
const AGENCY_CREDIT: [RegExp, string][] = [
  [/\(Reuters\)\s*[-—–]|\bBy Reuters\b|\bReporting by\b[^.]{0,160}\bEditing by\b/, 'Reuters'],
  [/\(AP\)\s*[-—–]|\bBy (The )?Associated Press\b|\bBy (THE )?ASSOCIATED PRESS\b/, 'Associated Press'],
  [/\(AFP\)\s*[-—–]|\bBy AFP\b|©\s*(AFP|Agence France-Presse)\b/, 'AFP'],
  [/\(PA\)\s*[-—–]|\bBy PA (Media|Reporters?)\b/, 'PA Media'],
];
/** An author field that is an agency's own name. */
const AGENCY_AUTHOR: Record<string, string> = { reuters: 'Reuters', 'associated press': 'Associated Press', 'the associated press': 'Associated Press', ap: 'Associated Press', afp: 'AFP', 'pa media': 'PA Media' };
/** "This article was originally published in The Example Times", "first appeared on", "republished from". */
const FIRST_APPEARED = /\b(?:originally|first) (?:published|appeared) (?:in|on|by|at) (?:the )?([A-Z][\w&.'’ -]{1,60}?)(?=\s*(?:[.,;:)]|$|\s(?:and|on|as|under|with)\b))|\brepublished (?:with permission )?from (?:the )?([A-Z][\w&.'’ -]{1,60}?)(?=\s*(?:[.,;:)]|$|\s(?:and|on|as|under|with)\b))/;

const SOCIAL = [
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com', 'youtube.com', 'threads.net',
  'bsky.app', 'linkedin.com', 't.me', 'truthsocial.com', 'mastodon.social', 'snapchat.com', 'quora.com', 'medium.com',
  'substack.com', 'tumblr.com', 'pinterest.com', 'weibo.com',
];

/** Government, police, courts, parliaments, and international organisations (.int: the UN agencies, WHO, NATO, Interpol). */
const PRIMARY_HOST = /(^|\.)(gov|gov\.[a-z]{2}|gouv\.[a-z]{2}|gob\.[a-z]{2}|govt\.nz|mil|int|va|police\.uk|nhs\.uk|parliament\.uk|judiciary\.uk|europa\.eu|un\.org|uscourts\.gov|supremecourt\.gov)$/i;
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
  // Beyond the UK and US, so international stories can be confirmed by the outlets that report them first.
  'lefigaro.fr': 'Le Figaro', 'liberation.fr': 'Libération', 'francetvinfo.fr': 'franceinfo', 'ouest-france.fr': 'Ouest-France',
  'leparisien.fr': 'Le Parisien', 'rfi.fr': 'RFI', 'faz.net': 'Frankfurter Allgemeine', 'sueddeutsche.de': 'Süddeutsche Zeitung',
  'zeit.de': 'Die Zeit', 'tagesschau.de': 'Tagesschau', 'elmundo.es': 'El Mundo', 'corriere.it': 'Corriere della Sera',
  'repubblica.it': 'la Repubblica', 'nos.nl': 'NOS', 'euronews.com': 'Euronews', 'swissinfo.ch': 'Swissinfo', 'rtbf.be': 'RTBF',
  'independent.ie': 'Irish Independent', 'thejournal.ie': 'TheJournal.ie', 'heraldscotland.com': 'The Herald',
  'standard.co.uk': 'The Standard', 'inews.co.uk': 'The i Paper', 'theglobeandmail.com': 'The Globe and Mail',
  'ctvnews.ca': 'CTV News', 'thestar.com': 'Toronto Star', 'smh.com.au': 'The Sydney Morning Herald', 'theage.com.au': 'The Age',
  'nzherald.co.nz': 'NZ Herald', 'rnz.co.nz': 'RNZ', 'hindustantimes.com': 'Hindustan Times', 'thehindu.com': 'The Hindu',
  'indianexpress.com': 'The Indian Express', 'timesofindia.indiatimes.com': 'The Times of India', 'ndtv.com': 'NDTV',
  'dawn.com': 'Dawn', 'scmp.com': 'South China Morning Post', 'japantimes.co.jp': 'The Japan Times',
  'straitstimes.com': 'The Straits Times', 'haaretz.com': 'Haaretz', 'timesofisrael.com': 'The Times of Israel',
  'news24.com': 'News24', 'nation.africa': 'Nation', 'africanews.com': 'Africanews', 'kyivindependent.com': 'The Kyiv Independent',
  'chicagotribune.com': 'Chicago Tribune', 'bostonglobe.com': 'The Boston Globe', 'propublica.org': 'ProPublica',
};

/**
 * Made-up sites on the reserved .example domain (RFC 2606), for the offline
 * end-to-end cases (src/eval/story/cases.ts): they let those cases test
 * confirmation, agencies and social posts without putting made-up stories
 * under real outlets' names. A .example address can't exist, so no real
 * search result can ever match one of these.
 */
const EXAMPLE_SITES: Record<string, { kind: 'news' | 'agency' | 'social'; name: string }> = {
  'harbourgazette.example': { kind: 'news', name: 'Harbour Gazette' },
  'elsworthtimes.example': { kind: 'news', name: 'Elsworth Times' },
  'coastnews.example': { kind: 'news', name: 'Coast News' },
  'northernpost.example': { kind: 'news', name: 'Northern Post' },
  'dailyledger.example': { kind: 'news', name: 'Daily Ledger' },
  'leveilleur.example': { kind: 'news', name: 'Le Veilleur' },
  'courrierdelondine.example': { kind: 'news', name: "Le Courrier de l'Ondine" },
  'coastalwire.example': { kind: 'agency', name: 'Coastal Wire' },
  'chirp.example': { kind: 'social', name: 'Chirp' },
  'clipshare.example': { kind: 'social', name: 'Clipshare' },
};
const exampleSite = (host: string) => (host.endsWith('.example') ? EXAMPLE_SITES[host] : undefined);

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
  const example = exampleSite(host);
  if (lookup(AGENCIES, host) || example?.kind === 'agency') return 'agency';
  if (PRIMARY_HOST.test(host) || PRIMARY_LABEL.test(`${host}.`)) return 'primary';
  if (SOCIAL.some((s) => host === s || host.endsWith(`.${s}`)) || example?.kind === 'social') return 'social';
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    // Not an address.
  }
  if (OPINION_PATH.test(path) || OPINION_TITLE.test(title)) return 'opinion';
  // Only news organisations LinkPeek recognises. A /news/ path or a date in the address doesn't make a site one (D70).
  if (lookup(NEWS, host) || example?.kind === 'news') return 'news';
  return 'other';
}

/** Sources whose reports count towards confirmation: news agencies and recognised news organisations. */
export function corroborates(kind: SourceKind): boolean {
  return kind === 'agency' || kind === 'news';
}

/** How many independent groups among these sources (by index) can corroborate. Copies of one report count once. */
export function corroboratingGroups(indexes: number[], grouping: Grouping, kinds: SourceKind[]): number {
  return new Set(indexes.filter((i) => corroborates(kinds[i]!)).map((i) => grouping.group[i])).size;
}

/**
 * Enough independent support to call a story's main facts established, the
 * same rule for stopping the search and for "strong evidence": two
 * independent corroborating reports, or an official source and one.
 */
export function wellSupported(indexes: number[], grouping: Grouping, kinds: SourceKind[]): boolean {
  const groups = corroboratingGroups(indexes, grouping, kinds);
  return groups >= 2 || (groups >= 1 && indexes.some((i) => kinds[i] === 'primary'));
}

/**
 * A claim an official source can establish on its own: what someone said or
 * announced, or what an authority itself did ("prosecutors have opened an
 * inquiry"). Not every detail of the event it concerns. Rough, like the lists
 * above.
 */
export const ATTRIBUTED = /\b(said|says|say|announced|announces|stated|states|confirmed|confirms|told|according to|declared|issued|published|reported|reports|added)\b|\b(police|prosecutors?|court|judges?|ministry|ministers?|government|council|authorities|officials?|department|coroner|regulator|parliament|commission|the vatican|holy see)\b/i;

export function publisherName(url: string, given?: string): string {
  const host = hostOf(url);
  const known = lookup(AGENCIES, host) ?? lookup(NEWS, host) ?? exampleSite(host)?.name;
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

/** The agency a report is a copy of: its own site, an agency author, or an agency's dateline or byline. */
export function creditedAgency(hit: SearchHit): string | undefined {
  const own = lookup(AGENCIES, hostOf(hit.url));
  if (own) return own;
  const author = AGENCY_AUTHOR[(hit.author ?? '').trim().toLowerCase()];
  if (author) return author;
  // A dateline or byline opens an article: only the first paragraphs of its text count, not a teaser further down.
  const text = [hit.description ?? '', ...hit.passages, ...(hit.text ?? []).slice(0, 2)].join(' \n ');
  for (const [pattern, name] of AGENCY_CREDIT) if (pattern.test(text)) return name;
  return undefined;
}

/** The publication a report says it first appeared in, if it says so. */
export function firstAppearedIn(hit: SearchHit): string | undefined {
  const m = [hit.description ?? '', ...hit.passages, ...(hit.text ?? [])].join(' ').match(FIRST_APPEARED);
  return (m?.[1] ?? m?.[2])?.trim();
}

const sameName = (a: string, b: string) => a.toLowerCase().replace(/^the\s+/, '') === b.toLowerCase().replace(/^the\s+/, '');

/** Reports this far apart are about different events, however alike their headlines. */
const COPY_WINDOW_DAYS = 30;

export interface Grouping {
  /** For each hit (by index), its group number. Hits in one group are one report. */
  group: number[];
  /** For each hit, the index of the hit it copies, if it isn't the group's original. */
  copyOf: (number | undefined)[];
  /** The agency each group credits, if any. */
  via: (string | undefined)[];
}

/**
 * Groups hits that are the same report: the same agency's dateline or byline,
 * a statement that one first appeared in the other's pages, or largely the
 * same text (five-word shingles). The same headline counts only together with
 * reused passages, or when there is no text to compare at all; never for
 * reports more than a month apart, which are different events. The group's
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
  const firstIn = hits.map(firstAppearedIn);
  const publisher = hits.map((h) => publisherName(h.url, h.publisher));
  const text = hits.map((h) => shingles([h.description ?? '', ...h.passages].join(' ')));
  const title = hits.map((h) => terms(h.title).join(' '));
  const apart = (i: number, j: number) => {
    const a = hits[i]!.published;
    const b = hits[j]!.published;
    return Boolean(a && b && Math.abs(Date.parse(a) - Date.parse(b)) > COPY_WINDOW_DAYS * 86_400_000);
  };
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      if (agency[i] && agency[i] === agency[j]) join(i, j);
      else if ((firstIn[i] && sameName(firstIn[i]!, publisher[j]!)) || (firstIn[j] && sameName(firstIn[j]!, publisher[i]!))) join(i, j);
      else if (apart(i, j)) continue;
      else if (jaccard(text[i]!, text[j]!) >= 0.5) join(i, j);
      else if (title[i] && title[i] === title[j] && hostOf(hits[i]!.url) !== hostOf(hits[j]!.url)) {
        // Same headline: a copy only if passages are reused, or if there's no text to tell them apart.
        const noText = !text[i]!.size && !text[j]!.size;
        if (noText || jaccard(text[i]!, text[j]!) >= 0.3) join(i, j);
      }
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
