/**
 * The Story Search end-to-end cases: the page each link sits on, how its
 * search is answered, the reply that stands in for Claude offline, and what
 * a correct result looks like.
 *
 * Real cases replay searches recorded once from the real Exa and Tavily
 * (recordings/<id>.json). Synthetic cases use made-up search results about
 * made-up places (Port Elsworth, Gullholm) on made-up sites (.example), so
 * nothing here can be mistaken for a real report by a real outlet.
 *
 * Offline, Claude's part is played by a stand-in: a reply written for the
 * test, run through LinkPeek's real reply checks. Each says what it is.
 * Some are deliberately bad (over-confident, or inventing a story), to show
 * what LinkPeek's own rules catch. Stand-ins test LinkPeek, not Claude: only
 * the live mode (real Claude) says anything about the AI's reports.
 */
import type { AiReport } from '../../../server/src/story/analyse';
import type { Quote } from '../../../server/src/story/evidence';
import type { Expectation } from './validate';

export interface PromptSource {
  id: number;
  site: string;
  kind: string;
  published?: string;
  agency?: string;
  sameAs?: number;
  title: string;
  /** Title, description and passages, as the AI was given them. */
  text: string;
  /** The same, one part each (a quote never runs from one part into the next). */
  parts: string[];
}

/** The sources in a Story Search prompt, as storyUserMessage wrote them. */
export function promptSources(userMessage: string): PromptSource[] {
  const out: PromptSource[] = [];
  for (const m of userMessage.matchAll(/<source ([^>]*)>\n([\s\S]*?)\n<\/source>/g)) {
    const attrs = Object.fromEntries([...m[1]!.matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!]));
    const body = m[2]!;
    out.push({
      id: Number(attrs.id),
      site: attrs.site ?? '',
      kind: attrs.kind ?? '',
      ...(attrs.published && attrs.published !== 'unknown' ? { published: attrs.published } : {}),
      ...(attrs.credited_agency ? { agency: attrs.credited_agency } : {}),
      ...(attrs.same_report_as ? { sameAs: Number(attrs.same_report_as) } : {}),
      title: body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '',
      text: body.replace(/<\/?[a-z_]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      parts: [...body.matchAll(/<(title|description|passage)>([\s\S]*?)<\/\1>/g)].map((p) => p[2]!.replace(/…$/, '').trim()),
    });
  }
  return out;
}

/** Ids of the sources whose text matches every pattern. */
export function ids(sources: PromptSource[], ...patterns: RegExp[]): number[] {
  return sources.filter((s) => patterns.every((p) => p.test(s.text))).map((s) => s.id);
}

/** A claim in a written reply: the sources it rests on, or the exact passages (see toAiReport). */
export interface StandInClaim {
  text: string;
  sources?: number[];
  evidence?: Quote[];
}

export interface StandInReply extends Omit<AiReport, 'what_happened' | 'details' | 'facts' | 'unclear' | 'headline'> {
  what_happened: StandInClaim[];
  details: (StandInClaim & { label: AiReport['details'][number]['label'] })[];
  facts: StandInClaim[];
  unclear: StandInClaim[];
  headline?: { verdict: AiReport['headline']['verdict']; reason: string; sources?: number[]; evidence?: Quote[] };
}

export interface StandIn {
  /** What this reply is, for the report. */
  note: string;
  reply(sources: PromptSource[]): StandInReply;
}

const wordsOf = (t: string) => new Set((t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));

/**
 * A written reply in the shape Claude must use: every claim with passages
 * copied from its sources. Where the reply only lists sources, each gets its
 * sentence most like the claim, copied from the prompt, so it is always a real
 * passage of that source. Explicit `evidence` is passed on as written (that's
 * how the deliberately wrong stand-ins quote the wrong source).
 */
export function toAiReport(r: StandInReply, sources: PromptSource[]): AiReport {
  const quote = (claim: string, id: number): Quote | undefined => {
    const src = sources.find((s) => s.id === id);
    if (!src) return { source: id, quote: 'a passage that is in no source at all' };
    const want = wordsOf(claim);
    const sentences = src.parts.flatMap((p) => p.split(/(?<=[.!?])\s+/)).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 4);
    const best = sentences.map((x) => ({ x, n: [...wordsOf(x)].filter((w) => want.has(w)).length })).sort((a, b) => b.n - a.n)[0];
    return best ? { source: id, quote: best.x.split(/\s+/).slice(0, 30).join(' ') } : undefined;
  };
  const fill = <T extends StandInClaim>(c: T) => {
    const { sources: cited, ...rest } = c;
    return { ...rest, evidence: c.evidence ?? (cited ?? []).map((id) => quote(c.text, id)).filter((q): q is Quote => Boolean(q)) };
  };
  const h = r.headline;
  return {
    ...r,
    what_happened: r.what_happened.map(fill),
    details: r.details.map(fill),
    facts: r.facts.map(fill),
    unclear: r.unclear.map(fill),
    headline: h ? { verdict: h.verdict, reason: h.reason, evidence: h.evidence ?? (h.sources ?? []).map((id) => quote(h.reason, id)).filter((q): q is Quote => Boolean(q)) } : { verdict: 'unverified', reason: '', evidence: [] },
  } as AiReport;
}

export interface PageFixture {
  /** The page the link is on. Its address is never sent. */
  url: string;
  body: string;
  head?: string;
  /** Text the reader had selected. */
  selection?: string;
}

/** One search answer in Exa's format, for synthetic cases. */
export interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
}

/** How one search service behaves in a simulated case. */
export type Sim =
  /** An HTTP answer: an error status (402 used up, 432 Tavily's limit, 429 busy) or an odd body. */
  | { kind: 'status'; status: number; body?: unknown }
  /** A body that isn't JSON. */
  | { kind: 'garbage'; status: number; text: string }
  /** Never answers: the adapter's own timeout ends it. */
  | { kind: 'hang' }
  /** No key configured. */
  | { kind: 'no-key' }
  /** Must not be asked at all. */
  | { kind: 'forbidden' }
  /** This service's real answers, replayed from another case's recording. */
  | { kind: 'replay'; from: string }
  /** Made-up results, in Exa's format (Exa only). */
  | { kind: 'results'; results: ExaResult[] }
  /** One behaviour per request, in turn; the last repeats. */
  | { kind: 'sequence'; steps: Sim[] };

export type SearchSetup =
  /** Replays recordings/<id>.json; recorded from the real Exa (and Tavily, if Exa didn't answer). */
  | { kind: 'recording' }
  /** Each service simulated. Never makes a real request, and has no recording of its own. */
  | { kind: 'simulated'; exa: Sim; tavily: Sim }
  /** Exa answers "credit used up" (simulated); Tavily's answers are replayed from a real recording. */
  | { kind: 'recording-tavily'; exa: { status: number; body: unknown } }
  /** Made-up Exa answers, one per search in turn (the last repeats). */
  | { kind: 'synthetic'; replies: ExaResult[][] }
  /** Nothing may be sent. */
  | { kind: 'none' };

export interface E2ECase {
  id: string;
  title: string;
  /** Which of the brief's situations this covers. */
  covers: string[];
  data: 'real' | 'synthetic';
  /** What a correct result looks like, for the person reading the report. */
  expected: string;
  page: PageFixture;
  search: SearchSetup;
  maxSearches?: number;
  /** Offline reply. Without one, the AI must not be called. */
  standIn?: StandIn;
  /** Use another case's stand-in and saved Claude replies (same link, same results, same prompt). */
  reuse?: string;
  /** Claude fails in this way (simulated, in every mode: a live Claude can't be made to fail on purpose). */
  aiFailure?: 'invalid' | 'truncated' | 'refused' | 'timeout';
  /** The search services' timeout, shortened for timeout cases. */
  searchTimeoutMs?: number;
  /** Checks on the report shown, whoever wrote it. */
  expect: Expectation;
  /** Extra checks on the card the reader sees. */
  card?: { includes?: string[]; excludes?: string[] };
}

const FEED = (items: string) =>
  `<header><nav><a href="/">Home</a> <a href="/world">World</a> <a href="/culture">Culture</a></nav></header><main><section><h2>Latest</h2><ul class="feed">${items}</ul></section></main>`;

const MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

// ---------- Real cases (recorded searches) ----------

const pope: E2ECase = {
  id: 'pope',
  title: 'Full headline naming a person: Pope Francis',
  covers: ['accurate results', 'event date versus publication date'],
  data: 'real',
  expected:
    'Pope Francis died on 21 April 2025, Easter Monday, at the Vatican, aged 88. The report must give that event date (not a later publication date), and its sources must be real reports of his death (the Vatican, news agencies, major outlets), not later coverage.',
  page: {
    url: 'https://news.example.com/',
    body: FEED(
      '<li><a href="/2025/04/20/easter-crowds-st-peters">Easter crowds fill St Peter’s Square</a></li><li><a data-case href="https://news.example.com/2025/04/21/pope-francis-dies-aged-88">Pope Francis dies aged 88</a></li><li><a href="/2025/04/21/markets-closed-easter-monday">Markets closed for Easter Monday</a></li>',
    ),
  },
  search: { kind: 'recording' },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    confidence: ['strong', 'partial'],
    subject: { must: [/Francis/] },
    names: [/Francis/],
    eventDate: [/21 April 2025/],
    locations: [/Vatican/],
    facts: [/\b88\b/],
    forbidden: [/\bdied\b[^.]*\b(2024|2026)\b/i, /\bLeo XIV\b[^.]*\b(died|dies)\b/i],
    minSources: 2,
    hostsAnyOf: ['vaticannews.va', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'npr.org', 'theguardian.com'],
    forbiddenNotes: ['vague-link', 'older-story'],
  },
};

const louvreCard: E2ECase = {
  id: 'louvre-card',
  title: '"Read more" link in an article card: the Louvre jewel theft',
  covers: ['accurate results', 'card clues', 'no mixing with other news about the same place'],
  data: 'real',
  expected:
    'Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid of a few minutes. Only the heist: not other Louvre news (strikes, renovation plans, the Mona Lisa).',
  page: {
    url: 'https://paper.example.org/',
    body: `<main><section><h2>Culture</h2>
      <article class="story-card">
        <span class="kicker">Culture</span>
        <h3>Louvre jewel heist: thieves steal crown jewels in daylight raid</h3>
        <p class="summary">Thieves used a vehicle-mounted lift to reach the Apollo Gallery and escaped within minutes.</p>
        <time datetime="2025-10-19T13:00:00Z">19 October 2025</time>
        <a data-case href="https://paper.example.org/p/88231">Read more</a>
      </article>
      <article class="story-card"><h3>Louvre to get a new entrance under renovation plan</h3><p class="summary">The museum will be overhauled over the next decade.</p><a href="https://paper.example.org/p/70110">Read more</a></article>
    </section></main>`,
  },
  search: { kind: 'recording' },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    confidence: ['strong', 'partial'],
    subject: { must: [/Louvre/i] },
    names: [/Louvre/],
    eventDate: [/19 October 2025/],
    locations: [/Paris|Apollo Gallery/],
    facts: [/jewel/i],
    forbidden: [/Mona Lisa (was|had been) stolen/i, /\b(2024|2026)\b[^.]*\b(stole|stolen|heist|raid)\b/i, /\b(new entrance|renovation plan)\b/i],
    minSources: 2,
    hostsAnyOf: ['france24.com', 'apnews.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'reuters.com', 'usatoday.com', 'npr.org'],
    forbiddenNotes: ['vague-link', 'older-story'],
  },
  card: { excludes: ['Read more', 'new entrance'] },
};

const louvreUrl: E2ECase = {
  id: 'louvre-url',
  title: 'Only the address: the same Louvre story from the URL’s words and date',
  covers: ['accurate results', 'address clues'],
  data: 'real',
  expected: 'The same Louvre heist (19 October 2025), found from the address words and the date in the address alone.',
  page: {
    url: 'https://forum.example.net/thread/556',
    body: '<main><article class="post"><p>Has anyone seen this?</p><p><a data-case href="https://paper.example.org/2025/10/19/louvre-crown-jewels-stolen-apollo-gallery">paper.example.org/2025/10/19/louvre-crown-jewels-stolen-apollo-gallery</a></p></article></main>',
  },
  search: { kind: 'recording' },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    confidence: ['strong', 'partial'],
    subject: { must: [/Louvre/i] },
    names: [/Louvre/],
    eventDate: [/19 October 2025/],
    locations: [/Paris|Apollo Gallery/],
    facts: [/jewel/i],
    forbidden: [/Mona Lisa (was|had been) stolen/i, /\b(2024|2026)\b[^.]*\b(stole|stolen|heist|raid)\b/i],
    minSources: 2,
    hostsAnyOf: ['france24.com', 'apnews.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'reuters.com', 'usatoday.com', 'npr.org'],
    forbiddenNotes: ['vague-link', 'older-story'],
  },
};

const vague: E2ECase = {
  id: 'vague',
  title: 'Vague headline, no name and no date: "Pop star found dead in hotel room"',
  covers: ['vague headlines', 'old incident not shown as current'],
  data: 'real',
  expected:
    'Many deaths fit this headline. LinkPeek must not say who it is about, must not present an old case (the search finds Whitney Houston’s death in 2012) as this story, and must say why: the link gives no name or date. At most a possible match: the closest results listed with their dates, and no report written about any one of them.',
  page: {
    url: 'https://celeb.example.com/',
    body: FEED('<li><a data-case href="https://celeb.example.com/p/1">Pop star found dead in hotel room</a></li><li><a href="https://celeb.example.com/p/2">Ten red-carpet looks from the weekend</a></li>'),
  },
  search: { kind: 'recording' },
  // Deliberately over-confident: names the person, calls every source a strong match, rates the evidence strong.
  standIn: {
    note: 'Over-confident stand-in: calls every source a strong match, names the person as the subject and rates the evidence strong. LinkPeek’s rules must overrule it.',
    reply: (sources) => {
      const all = sources.map((s) => s.id);
      const named = ids(sources, /Whitney Houston/i);
      return {
        matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'Same kind of event.' })),
        subject: 'Whitney Houston found dead in Beverly Hills hotel',
        what_happened: [{ text: 'Singer Whitney Houston was found dead in a Beverly Hills hotel room.', sources: named.length ? named : all }],
        details: [{ label: 'who', text: 'Whitney Houston, singer.', sources: named.length ? named : all }],
        facts: [{ text: 'Whitney Houston was found dead in a hotel room in Beverly Hills.', sources: named.length ? named : all }],
        unclear: [],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  expect: {
    outcome: ['report', 'no-match', 'report-failed'],
    match: ['possible', 'none'],
    confidence: ['insufficient'],
    subject: { absent: true },
    notes: ['vague-link'],
    forbiddenNotes: ['older-story'],
    empty: ['whatHappened', 'details', 'confirmed', 'reported'],
  },
  card: { excludes: ['What happened?', 'Written by AI', 'Whitney Houston was found dead'] },
};

const fabricated: E2ECase = {
  id: 'fabricated',
  title: 'Made-up story: "Mayor of Zarnwick resigns after canal bridge collapse injures 14"',
  covers: ['fabricated stories', 'unrelated results'],
  data: 'real',
  expected: 'There is no such town or story. LinkPeek must find no reliable match, name nobody, and write no report.',
  page: {
    url: 'https://news.example.com/',
    body: FEED('<li><a data-case href="https://news.example.com/2026/11/20/zarnwick-mayor-resigns-canal-bridge-collapse">Mayor of Zarnwick resigns after canal bridge collapse injures 14</a></li>'),
  },
  search: { kind: 'recording' },
  standIn: {
    note: 'Careful stand-in: finds that no source is about Zarnwick and matches none.',
    reply: (sources) => ({
      matches: sources.map((s) => ({ source: s.id, status: 'none', reason: 'A different place and event; no source mentions Zarnwick.' })),
      subject: '',
      what_happened: [],
      details: [],
      facts: [],
      unclear: [{ text: 'No source reviewed reports a bridge collapse or a resignation in Zarnwick.', sources: [] }],
      conflicting: false,
      developing: false,
      confidence: 'insufficient',
    }),
  },
  expect: {
    outcome: ['no-match', 'no-results'],
    match: ['none'],
    confidence: ['insufficient'],
    subject: { absent: true },
    empty: ['whatHappened', 'details', 'confirmed', 'reported'],
  },
};

const fabricatedInvented: E2ECase = {
  ...fabricated,
  id: 'fabricated-invented',
  title: 'Made-up story, and an AI that invents a report to match it',
  covers: ['fabricated stories', 'unsupported claims'],
  expected:
    'The same real search results, but the AI (a deliberately bad stand-in) claims they are the story and invents names, numbers and a date. None of that may reach the card: every sentence states something no result says, so LinkPeek shows no report and no possible matches.',
  search: { kind: 'simulated', exa: { kind: 'replay', from: 'fabricated' }, tavily: { kind: 'forbidden' } },
  standIn: {
    note: 'Deliberately bad stand-in: calls every result the story and invents a report (a mayor’s name, 14 injured, a date). LinkPeek’s rules must keep all of it off the card.',
    reply: (sources) => {
      const all = sources.map((s) => s.id);
      return {
        matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'Same story.' })),
        subject: 'Mayor of Zarnwick resigns after canal bridge collapse',
        what_happened: [
          { text: 'The mayor of Zarnwick, Pieter Holm, resigned after the canal bridge collapsed on 19 November 2026, injuring 14 people.', sources: all },
          { text: 'Zarnwick council said repairs to the bridge had been delayed for two years.', sources: all.slice(0, 2) },
        ],
        details: [
          { label: 'who', text: 'Mayor Pieter Holm of Zarnwick.', sources: all.slice(0, 1) },
          { label: 'where', text: 'The Zarnwick canal bridge.', sources: all.slice(0, 1) },
        ],
        facts: [
          { text: 'Fourteen people were injured when the Zarnwick canal bridge fell.', sources: all },
          { text: 'Pieter Holm had been mayor since 2019.', sources: all.slice(0, 1) },
        ],
        unclear: [],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  expect: {
    outcome: ['no-match', 'no-results'],
    match: ['none'],
    confidence: ['insufficient'],
    subject: { absent: true },
    empty: ['whatHappened', 'details', 'confirmed', 'reported'],
    forbidden: [/Zarnwick|Holm|\b14\b|Fourteen/],
  },
  card: { excludes: ['Pieter Holm', 'Fourteen people', 'Possibly related'] },
};

const insufficient: E2ECase = {
  id: 'insufficient',
  title: 'Bare "Read more" to an address with only an ID',
  covers: ['insufficient information'],
  data: 'real',
  expected: 'Nothing to search on: LinkPeek must say so and send nothing (no search, no AI, no cost).',
  page: { url: 'https://news.example.com/', body: '<main><div><p>Weekend round-up.</p><a data-case href="https://example.com/p/12345">Read more</a></div></main>' },
  search: { kind: 'none' },
  expect: { outcome: ['insufficient'] },
};

const popeTavily: E2ECase = {
  id: 'pope-tavily',
  title: 'Exa’s free credit used up (simulated): Tavily finds Pope Francis instead',
  covers: ['credit exhaustion', 'fallback'],
  data: 'real',
  expected: 'Exa says its credit is used up; Tavily takes over and the same correct story is found from Tavily’s real results.',
  page: pope.page,
  search: { kind: 'recording-tavily', exa: { status: 402, body: { error: 'You have run out of credits', tag: 'NO_MORE_CREDITS' } } },
  expect: { ...pope.expect, providersUsed: ['tavily'] },
};

// ---------- Synthetic cases (made-up results about made-up places) ----------

const fire = {
  gazette: {
    title: 'Warehouse destroyed in Port Elsworth dock fire',
    url: 'https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire',
    publishedDate: '2026-11-12T09:00:00.000Z',
    highlights: [
      'A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026. Three people were taken to hospital with smoke inhalation, the fire service said.',
      'The cause of the fire is not yet known and an investigation has begun.',
    ],
  },
  times: {
    title: 'Seven injured as blaze guts Port Elsworth warehouse',
    url: 'https://elsworthtimes.example/news/2026/11/12/dock-road-blaze',
    publishedDate: '2026-11-12T11:30:00.000Z',
    highlights: [
      'Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.',
      'Investigators believe an electrical fault in the loading bay started the fire, a council spokesperson said.',
    ],
  },
  coast: {
    title: 'Port Elsworth warehouse fire: what we know',
    url: 'https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know',
    publishedDate: '2026-11-13T08:00:00.000Z',
    highlights: [
      'Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.',
      'The fire service said three people were treated in hospital. It said it was too early to say what caused the fire.',
    ],
  },
};

const conflicting: E2ECase = {
  id: 'conflicting',
  title: 'Sources disagree: a warehouse fire (synthetic)',
  covers: ['conflicts'],
  data: 'synthetic',
  expected:
    'Three independent reports agree a warehouse on Dock Road burned on 12 November 2026, but disagree on how many were hurt (three or seven) and on the cause (an electrical fault, or not yet known). The report must state the agreed facts, say what each source reports on the disputed ones, and leave them open.',
  page: {
    url: 'https://local.example.net/',
    body: `<main><section><h2>Local</h2><article class="story-card">
      <h3>Fire destroys warehouse at Port Elsworth docks</h3>
      <p class="summary">Firefighters spent the night tackling the blaze on Dock Road.</p>
      <time datetime="2026-11-12T07:30:00Z">12 November</time>
      <a data-case href="https://local.example.net/p/40213">Read more</a>
    </article></section></main>`,
  },
  search: { kind: 'synthetic', replies: [[fire.gazette, fire.times, fire.coast]] },
  standIn: {
    note: 'Careful stand-in: states what the three reports agree on and puts the disputed injury count and cause under “What remains unclear?”.',
    reply: (sources) => {
      const g = ids(sources, /smoke inhalation/);
      const t = ids(sources, /Seven workers/);
      const c = ids(sources, /too early to say/);
      const all = [...g, ...t, ...c];
      const site = (list: number[]) => sources.find((s) => s.id === list[0])?.site ?? 'one source';
      return {
        matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'Same fire, same warehouse, same night.' })),
        subject: 'Fire destroys warehouse on Dock Road in Port Elsworth',
        what_happened: [{ text: 'A fire destroyed a warehouse on Dock Road in Port Elsworth on 12 November 2026.', sources: all }],
        details: [
          { label: 'where', text: 'A warehouse on Dock Road, Port Elsworth.', sources: all },
          { label: 'when', text: 'Overnight on 12 November 2026.', sources: [...g, ...c] },
        ],
        facts: [
          { text: 'The fire destroyed a warehouse on Dock Road in Port Elsworth.', sources: all },
          { text: 'Fire crews were called shortly after midnight.', sources: c },
        ],
        unclear: [
          { text: `How many people were hurt: ${site(g)} and ${site(c)} say three people were treated in hospital, while ${site(t)} says seven workers were injured.`, sources: all },
          { text: `The cause: ${site(t)} says investigators believe an electrical fault started the fire, while ${site(g)} and ${site(c)} say the cause is not yet known.`, sources: all },
        ],
        conflicting: true,
        developing: false,
        confidence: 'conflicting',
      };
    },
  },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    confidence: ['conflicting'],
    names: [/Port Elsworth/],
    eventDate: [/12 November 2026/],
    locations: [/Dock Road/],
    facts: [/warehouse/i],
    disputed: [/\bthree\b/i, /\bseven\b/i],
    contradictions: [[/\bthree (people|workers)\b/i, /\bseven (people|workers)\b/i]],
    forbidden: [/\b(was|were) (caused|started) by an electrical fault/i, /^An electrical fault (caused|started)/i],
    minSources: 3,
  },
};

const ferryWire = {
  title: 'Gullholm ferry suspended after engine failure',
  publishedDate: '2026-11-03T07:00:00.000Z',
  highlights: [
    'The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.',
    'Passengers have been told to expect no sailings until at least 10 November while repairs are carried out.',
  ],
};

const duplicates: E2ECase = {
  id: 'duplicates',
  title: 'One wire story printed twice, an AMP copy and an unrelated result (synthetic)',
  covers: ['duplicates', 'syndication', 'unrelated results'],
  data: 'synthetic',
  expected:
    'The ferry between Port Elsworth and Gullholm was suspended after an engine failure. The same wire report appears on two sites (one source, not two), one of them also as an AMP page (listed once), and one independent report adds detail. A sports story that shares a place name is not a match. Only facts from two independent reports may be called confirmed.',
  page: {
    url: 'https://news.example.com/',
    body: FEED('<li><a data-case href="https://news.example.com/2026/11/03/gullholm-ferry-suspended-engine-failure">Gullholm ferry service suspended after engine failure</a></li>'),
  },
  search: {
    kind: 'synthetic',
    replies: [
      [
        { ...ferryWire, url: 'https://coastalwire.example/news/2026/11/03/gullholm-ferry-suspended' },
        { ...ferryWire, url: 'https://harbourgazette.example/news/2026/11/03/gullholm-ferry-suspended-after-engine-failure' },
        { ...ferryWire, url: 'https://amp.harbourgazette.example/news/2026/11/03/gullholm-ferry-suspended-after-engine-failure/amp', highlights: ferryWire.highlights.slice(0, 1) },
        {
          title: 'Isle Link says Gullholm ferry repairs will take a week',
          url: 'https://elsworthtimes.example/news/2026/11/04/isle-link-ferry-repairs',
          publishedDate: '2026-11-04T10:00:00.000Z',
          highlights: [
            'Isle Link said on 4 November that engineers had found a fault in the ferry’s main engine after it failed on the crossing to Gullholm.',
            'The company said replacement buses and a chartered boat would carry passengers until sailings resume.',
          ],
        },
        {
          title: 'Gullholm Rovers win county cup final',
          url: 'https://sportsdesk.example/2026/11/03/gullholm-rovers-cup-final',
          publishedDate: '2026-11-03T21:00:00.000Z',
          highlights: ['Gullholm Rovers beat Port Elsworth Athletic 2-1 in the county cup final on Monday night.'],
        },
      ],
    ],
  },
  standIn: {
    note: 'Careful stand-in: matches the three ferry reports, not the football result, and cites the wire copies and the independent report separately.',
    reply: (sources) => {
      const wire = ids(sources, /expect no sailings/);
      const times = ids(sources, /replacement buses/);
      const ferry = [...wire, ...times];
      return {
        matches: sources.map((s) => ({ source: s.id, status: ferry.includes(s.id) ? 'strong' : 'none', reason: ferry.includes(s.id) ? 'The same ferry suspension.' : 'A football match, not the ferry.' })),
        subject: 'Port Elsworth to Gullholm ferry suspended after engine failure',
        what_happened: [{ text: 'The ferry between Port Elsworth and Gullholm was suspended after an engine failure, its operator Isle Link said.', sources: ferry }],
        details: [{ label: 'who', text: 'Isle Link, the ferry operator.', sources: ferry }],
        facts: [
          { text: 'The ferry between Port Elsworth and Gullholm was suspended after its engine failed.', sources: ferry },
          { text: 'Passengers were told to expect no sailings until at least 10 November.', sources: wire },
          { text: 'Replacement buses and a chartered boat will carry passengers until sailings resume, Isle Link said.', sources: times },
        ],
        unclear: [{ text: 'When the ferry will sail again is not yet confirmed.', sources: [] }],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    confidence: ['strong', 'partial'],
    names: [/Gullholm/],
    facts: [/engine/i],
    notes: ['syndicated'],
    forbidden: [/Rovers|cup final/i],
    minSources: 3,
  },
  card: { excludes: ['Gullholm Rovers'] },
};

const undated = (title: string, url: string, highlights: string[]): ExaResult => ({ title, url, highlights });

const datesMissing: E2ECase = {
  id: 'dates-missing',
  title: 'No dates anywhere: the link and every result are undated (synthetic)',
  covers: ['missing dates'],
  data: 'synthetic',
  expected: 'The story is clear but no source gives a date. The report must not invent one (no "on 17 November 2026"), and the card must show the sources without dates.',
  page: {
    url: 'https://news.example.com/',
    body: FEED('<li><a data-case href="https://news.example.com/p/77812">Council in Port Elsworth approves new harbour wall after storm damage</a></li>'),
  },
  search: {
    kind: 'synthetic',
    replies: [
      [
        undated('Port Elsworth council backs new harbour wall', 'https://harbourgazette.example/news/port-elsworth-harbour-wall-approved', [
          'Councillors in Port Elsworth voted on Tuesday to build a new harbour wall after storms damaged the old one.',
          'The work is expected to cost £4.2 million.',
        ]),
        undated('New harbour wall approved for Port Elsworth', 'https://elsworthtimes.example/news/harbour-wall-vote', [
          'Port Elsworth council has approved plans for a new harbour wall following storm damage last month.',
        ]),
        undated('Harbour wall plan passes in Port Elsworth', 'https://coastnews.example/news/harbour-wall-plan-passes', [
          'The council said construction of the harbour wall would begin in the spring.',
        ]),
      ],
    ],
  },
  standIn: {
    note: 'Careful stand-in: reports the vote without giving any date the sources don’t give.',
    reply: (sources) => {
      const all = sources.map((s) => s.id);
      return {
        matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'The same council decision.' })),
        subject: 'Port Elsworth council approves new harbour wall',
        what_happened: [{ text: 'Port Elsworth council approved plans for a new harbour wall after storms damaged the old one.', sources: all }],
        details: [{ label: 'where', text: 'Port Elsworth harbour.', sources: all }],
        facts: [
          { text: 'Port Elsworth council approved a new harbour wall.', sources: all },
          { text: 'The work is expected to cost £4.2 million.', sources: ids(sources, /4\.2 million/) },
        ],
        unclear: [{ text: 'The sources reviewed don’t give the date of the vote.', sources: [] }],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  expect: {
    outcome: ['report'],
    match: ['strong'],
    names: [/Port Elsworth/],
    facts: [/harbour wall/i],
    forbidden: [new RegExp(`\\b\\d{1,2} ${MONTHS.source} \\d{4}\\b`), new RegExp(`${MONTHS.source} \\d{1,2},? \\d{4}`)],
    minSources: 2,
  },
  card: { excludes: ['Invalid Date', 'undefined', 'NaN'] },
};

const contentMissing: E2ECase = {
  id: 'content-missing',
  title: 'Results with headlines only, no page text (synthetic)',
  covers: ['missing content'],
  data: 'synthetic',
  expected: 'Every result has a headline but no text. The report may say what the headlines say, must note that it rests on headlines only, and must not rate the evidence as strong.',
  page: {
    url: 'https://news.example.com/',
    body: FEED('<li><a data-case href="https://news.example.com/2026/11/18/port-elsworth-lifeboat-rescue-gull-point">Port Elsworth lifeboat crew rescue two fishermen off Gull Point</a></li>'),
  },
  maxSearches: 1,
  search: {
    kind: 'synthetic',
    replies: [
      [
        { title: 'Lifeboat crew rescue two fishermen off Gull Point', url: 'https://harbourgazette.example/news/2026/11/18/gull-point-rescue', publishedDate: '2026-11-18T10:00:00.000Z' },
        { title: 'Two fishermen rescued near Port Elsworth', url: 'https://elsworthtimes.example/news/2026/11/18/fishermen-rescued', publishedDate: '2026-11-18T12:00:00.000Z' },
        { title: 'Port Elsworth lifeboat volunteers praised after Gull Point rescue', url: 'https://coastnews.example/news/2026/11/19/lifeboat-volunteers-praised', publishedDate: '2026-11-19T08:00:00.000Z' },
      ],
    ],
  },
  standIn: {
    note: 'Over-confident stand-in: rates headline-only evidence as strong. LinkPeek’s rules must lower it.',
    reply: (sources) => {
      const all = sources.map((s) => s.id);
      return {
        matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'Same rescue.' })),
        subject: 'Lifeboat crew rescue two fishermen off Gull Point',
        what_happened: [{ text: 'A lifeboat crew from Port Elsworth rescued two fishermen off Gull Point.', sources: all }],
        details: [],
        facts: [{ text: 'Two fishermen were rescued off Gull Point.', sources: all }],
        unclear: [{ text: 'The sources give only headlines, so the details of the rescue are not known.', sources: [] }],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  expect: {
    outcome: ['report'],
    confidence: ['partial', 'insufficient'],
    notes: ['snippets-only'],
    names: [/Gull Point/],
  },
};

const unrelated: E2ECase = {
  id: 'unrelated',
  title: 'Every result is about something else (synthetic)',
  covers: ['unrelated results'],
  data: 'synthetic',
  expected: 'Nothing found is about the library closure. LinkPeek must say no reliable match, and must not even ask the AI (nothing close enough to send).',
  page: {
    url: 'https://news.example.com/',
    body: FEED('<li><a data-case href="https://news.example.com/2026/11/25/port-elsworth-library-closes-roof-repairs">Port Elsworth library to close for six months for roof repairs</a></li>'),
  },
  search: {
    kind: 'synthetic',
    replies: [
      [
        { title: 'Stock markets rally as technology shares rebound', url: 'https://moneydesk.example/news/2026/11/25/markets-rally', publishedDate: '2026-11-25T16:00:00.000Z', highlights: ['Shares rose across Europe on Wednesday.'] },
        { title: 'Recipe: winter vegetable soup', url: 'https://kitchen.example/recipes/winter-vegetable-soup', highlights: ['Chop two leeks and three carrots.'] },
        { title: 'Ski resorts open early after heavy snow', url: 'https://travelnews.example/news/2026/11/24/ski-resorts-open-early', publishedDate: '2026-11-24T09:00:00.000Z', highlights: ['Resorts in the Alps opened a week early.'] },
      ],
    ],
  },
  expect: { outcome: ['no-match', 'no-results'], match: ['none'], confidence: ['insufficient'], subject: { absent: true } },
};

// ---------- Fallback, limits and failures (simulated services) ----------

const NO_CREDIT_EXA: Sim = { kind: 'status', status: 402, body: { error: 'You have run out of credits', tag: 'NO_MORE_CREDITS' } };
const NO_CREDIT_TAVILY: Sim = { kind: 'status', status: 432, body: { detail: { error: 'This request exceeds your plan’s set usage limit.' } } };
const reportFailedExpect: Expectation = { outcome: ['report-failed'], match: ['possible', 'none'], empty: ['whatHappened', 'details', 'confirmed', 'reported'] };

/** A case on the Pope Francis link with simulated services. Synthetic unless it replays real results. */
const fallback = (c: Omit<E2ECase, 'page' | 'data'> & { page?: PageFixture; data?: E2ECase['data'] }): E2ECase => ({ page: pope.page, data: 'synthetic', ...c });

const exaOk = fallback({
  id: 'fallback-exa-ok',
  title: 'Exa answers: Tavily is never asked',
  covers: ['fallback'],
  expected: 'Exa has credit and answers, so Tavily is not called at all.',
  data: 'real',
  search: { kind: 'simulated', exa: { kind: 'replay', from: 'pope' }, tavily: { kind: 'forbidden' } },
  reuse: 'pope',
  expect: { ...pope.expect, providersUsed: ['exa'] },
});

const exaTimeout = fallback({
  id: 'fallback-exa-timeout',
  title: 'Exa times out: Tavily takes over',
  covers: ['timeouts', 'fallback'],
  expected: 'Exa never answers; after its timeout Tavily is asked and the story is found from Tavily’s real results.',
  data: 'real',
  search: { kind: 'simulated', exa: { kind: 'hang' }, tavily: { kind: 'replay', from: 'pope-tavily' } },
  searchTimeoutMs: 150,
  reuse: 'pope-tavily',
  expect: { ...pope.expect, providersUsed: ['tavily'] },
});

const bothTimeout = fallback({
  id: 'fallback-both-timeout',
  title: 'Both services time out',
  covers: ['timeouts'],
  expected: 'Neither service answers in time: LinkPeek says the search took too long and offers to try again. No report, nothing invented.',
  search: { kind: 'simulated', exa: { kind: 'hang' }, tavily: { kind: 'hang' } },
  searchTimeoutMs: 150,
  expect: { outcome: ['error:search-timeout'] },
});

const busyAndExhausted = fallback({
  id: 'fallback-busy-and-exhausted',
  title: 'Exa busy, Tavily’s allowance used up',
  covers: ['credit exhaustion'],
  expected: 'Exa is only busy (it may answer in a minute) and Tavily’s free allowance is used up: LinkPeek stops safely and says to try again, not that the month’s searches are gone. Nothing paid is tried.',
  search: { kind: 'simulated', exa: { kind: 'status', status: 429, body: { error: 'Too many requests' } }, tavily: NO_CREDIT_TAVILY },
  expect: { outcome: ['error:search-failed'] },
});

const tavilyExhausted = fallback({
  id: 'fallback-tavily-exhausted',
  title: 'Only Tavily set up, and its allowance used up',
  covers: ['credit exhaustion'],
  expected: 'With no Exa key and Tavily’s free allowance used up, Story Search stops and says this month’s free searches are used.',
  search: { kind: 'simulated', exa: { kind: 'no-key' }, tavily: NO_CREDIT_TAVILY },
  expect: { outcome: ['error:out-of-credit'] },
});

const bothExhausted = fallback({
  id: 'fallback-both-exhausted',
  title: 'Both free allowances used up',
  covers: ['credit exhaustion'],
  expected: 'Exa and Tavily both say their free credit is used up: Story Search stops, shows the monthly-limit message, and nothing paid is tried.',
  search: { kind: 'simulated', exa: NO_CREDIT_EXA, tavily: NO_CREDIT_TAVILY },
  expect: { outcome: ['error:out-of-credit'] },
});

const pier: ExaResult = {
  title: 'Port Elsworth pier reopens after storm repairs',
  url: 'https://harbourgazette.example/news/2026/11/21/port-elsworth-pier-reopens',
  publishedDate: '2026-11-21T09:00:00.000Z',
  highlights: ['The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage, the council said.'],
};

const exhaustedMidway: E2ECase = {
  id: 'fallback-exhausted-midway',
  title: 'Allowance runs out between the first search and the follow-up (synthetic)',
  covers: ['credit exhaustion', 'adaptive search'],
  data: 'synthetic',
  expected: 'The first search finds one report; the follow-up for a second source hits the used-up allowance on both services. Searching stops there and the report is written from the one source, marked as single-source.',
  page: { url: 'https://news.example.com/', body: FEED('<li><a data-case href="https://news.example.com/2026/11/21/port-elsworth-pier-reopens">Port Elsworth pier reopens after storm repairs</a></li>') },
  search: { kind: 'simulated', exa: { kind: 'sequence', steps: [{ kind: 'results', results: [pier] }, NO_CREDIT_EXA] }, tavily: NO_CREDIT_TAVILY },
  standIn: {
    note: 'Careful stand-in: reports what the one source says.',
    reply: (sources) => ({
      matches: sources.map((s) => ({ source: s.id, status: 'strong', reason: 'The same pier reopening.' })),
      subject: 'Port Elsworth pier reopens after storm repairs',
      what_happened: [{ text: 'The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage.', sources: sources.map((s) => s.id) }],
      details: [],
      facts: [{ text: 'The council said repairs to storm damage took six weeks.', sources: sources.map((s) => s.id) }],
      unclear: [],
      conflicting: false,
      developing: false,
      confidence: 'strong',
    }),
  },
  expect: { outcome: ['report'], match: ['strong'], confidence: ['partial'], notes: ['single-source'], eventDate: [/21 November 2026/], minSources: 1 },
};

const noKeys = fallback({
  id: 'fallback-no-keys',
  title: 'No search keys configured',
  covers: ['configuration'],
  expected: 'No service has a key: LinkPeek says Story Search isn’t set up, rather than pretending to search.',
  search: { kind: 'simulated', exa: { kind: 'no-key' }, tavily: { kind: 'no-key' } },
  expect: { outcome: ['error:not-configured'] },
});

const malformedSearch = fallback({
  id: 'malformed-search',
  title: 'Both services send malformed answers',
  covers: ['malformed responses'],
  expected: 'Exa sends an HTML page instead of JSON and Tavily sends JSON of the wrong shape: LinkPeek says the search service didn’t answer, and offers to try again.',
  search: { kind: 'simulated', exa: { kind: 'garbage', status: 200, text: '<html><body>Bad gateway</body></html>' }, tavily: { kind: 'status', status: 200, body: { results: 'none' } } },
  expect: { outcome: ['error:search-failed'] },
});

const malformedResults: E2ECase = {
  ...conflicting,
  id: 'malformed-results',
  title: 'Search results with junk entries mixed in (synthetic)',
  covers: ['malformed responses'],
  expected: 'Exa’s answer mixes good results with an entry without a title, one with a javascript: address, and markup in titles. The junk is dropped, markup is removed, and the report is built from the good results.',
  search: {
    kind: 'simulated',
    exa: {
      kind: 'results',
      results: [
        { title: '', url: 'https://junk.example/news/2026/11/12/untitled' },
        { title: 'Port Elsworth warehouse fire latest', url: 'javascript:alert(1)', highlights: ['A fire destroyed a warehouse on Dock Road.'] },
        { ...fire.gazette, title: '<b>Warehouse destroyed</b> in Port Elsworth dock fire &amp; investigation begins' },
        fire.times,
        fire.coast,
      ],
    },
    tavily: { kind: 'forbidden' },
  },
  reuse: 'conflicting',
  standIn: undefined,
  card: { excludes: ['javascript:', '<b>', '&amp;'] },
};

const aiFails = (failure: NonNullable<E2ECase['aiFailure']>, title: string, expected: string): E2ECase => ({
  ...conflicting,
  id: `ai-${failure}`,
  title,
  covers: failure === 'timeout' ? ['timeouts', 'AI failure'] : ['malformed responses', 'AI failure'],
  expected,
  aiFailure: failure,
  standIn: undefined,
  expect: reportFailedExpect,
  card: {},
});

const aiInvalid = aiFails('invalid', 'Claude’s reply isn’t valid JSON (simulated)', 'The AI’s reply can’t be read: no report is written; the closest sources are listed as possible matches only, with a retry.');
const aiTruncated = aiFails('truncated', 'Claude’s reply is cut off at the token limit (simulated)', 'A cut-off reply is a failure, never a half report: the closest sources are listed as possible matches only.');
const aiTimeout = aiFails('timeout', 'Claude times out (simulated)', 'The AI doesn’t answer in time: the closest sources are listed as possible matches only, with a retry.');

export const CASES: E2ECase[] = [
  pope,
  louvreCard,
  louvreUrl,
  vague,
  fabricated,
  fabricatedInvented,
  insufficient,
  popeTavily,
  conflicting,
  duplicates,
  datesMissing,
  contentMissing,
  unrelated,
  exaOk,
  exaTimeout,
  bothTimeout,
  busyAndExhausted,
  tavilyExhausted,
  bothExhausted,
  exhaustedMidway,
  noKeys,
  malformedSearch,
  malformedResults,
  aiInvalid,
  aiTruncated,
  aiTimeout,
];

/** A careful stand-in for the real cases, written once their recorded results were read. Kept apart so a re-recording shows up as a failed lookup, not silent drift. */
export function realStandIn(caseId: string): StandIn | undefined {
  return REAL_STAND_INS[caseId];
}

const strongAll = (sources: PromptSource[], reason: string) => sources.map((s) => ({ source: s.id, status: 'strong' as const, reason }));
const union = (...lists: number[][]) => [...new Set(lists.flat())].sort((a, b) => a - b);

const REAL_STAND_INS: Record<string, StandIn> = {
  pope: {
    note: 'Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.',
    reply: (src) => {
      const santaMarta = ids(src, /Casa Santa Marta/);
      const easter = ids(src, /Easter Monday/);
      const stroke = ids(src, /stroke/i);
      const latin = ids(src, /first Latin American/);
      const aged = ids(src, /\b88\b/);
      const april = ids(src, /April 21/);
      return {
        matches: strongAll(src, 'Reports the death of Pope Francis on 21 April 2025.'),
        subject: 'Pope Francis dies aged 88',
        what_happened: [
          { text: 'Pope Francis died on Easter Monday, 21 April 2025, aged 88, at his residence in the Casa Santa Marta in the Vatican.', sources: union(easter, santaMarta) },
          { text: 'The Vatican said he died after a stroke followed by heart failure.', sources: stroke },
        ],
        details: [
          { label: 'who', text: 'Pope Francis, the first Latin American leader of the Roman Catholic Church.', sources: latin },
          { label: 'where', text: 'His residence in the Casa Santa Marta, Vatican City.', sources: union(santaMarta, ids(src, /Vatican City/)) },
          { label: 'when', text: 'Easter Monday, 21 April 2025.', sources: union(easter, april) },
          { label: 'why', text: 'A stroke followed by heart failure, according to the Vatican.', sources: stroke },
        ],
        facts: [
          { text: 'Pope Francis died aged 88.', sources: aged },
          { text: 'The Vatican said the cause of death was a stroke followed by heart failure.', sources: stroke },
          { text: 'He was the first Latin American pope.', sources: latin },
          { text: 'Cardinal Kevin Farrell announced the death at 9:45 am.', sources: ids(src, /Kevin Farrell/) },
          { text: 'He was born on 17 December 1936 in Buenos Aires, Argentina.', sources: ids(src, /Buenos Aires/) },
        ],
        unclear: [],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  'louvre-card': {
    note: 'Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.',
    reply: (src) => {
      const jewels = ids(src, /crown jewels/i);
      return {
        matches: strongAll(src, 'The Louvre crown jewels theft of 19 October 2025.'),
        subject: 'Thieves steal crown jewels from the Louvre in daylight raid',
        what_happened: [
          { text: 'Thieves stole French crown jewels from the Louvre museum in Paris in a daylight raid on Sunday 19 October 2025.', sources: union(jewels, ids(src, /Oct 19|Sunday/)) },
          { text: 'They used a basket lift to reach an upstairs window and were inside the museum for less than four minutes.', sources: union(ids(src, /basket lift/), ids(src, /less than four minutes/)) },
        ],
        details: [
          { label: 'what', text: 'Eight items of jewellery from France’s crown jewels were stolen.', sources: ids(src, /eight items/) },
          { label: 'where', text: 'The Apollo Gallery of the Louvre museum in Paris.', sources: ids(src, /Apollo Gallery/) },
        ],
        facts: [
          { text: 'Officials put the value of the stolen jewels at about 88 million euros ($102 million).', sources: ids(src, /88 million/) },
          { text: 'The theft took less than eight minutes in total.', sources: ids(src, /less than eight minutes/) },
          { text: 'A crown was dropped as the thieves fled, and was found outside the museum.', sources: union(ids(src, /dropping a gem-encrusted crown/), ids(src, /found outside the museum/)) },
          { text: 'The thieves escaped on motorbikes.', sources: ids(src, /motorbikes/) },
        ],
        unclear: [{ text: 'The sources reviewed do not say who the thieves were.', sources: [] }],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  'louvre-url': {
    note: 'Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.',
    reply: (src) => {
      const apollo = ids(src, /Apollo Gallery/);
      const eight = ids(src, /eight (items|were)/);
      const crown = ids(src, /crown of Napoleon III’s wife|later found outside the museum/);
      return {
        matches: strongAll(src, 'The theft of crown jewels from the Louvre’s Apollo Gallery, October 2025.'),
        subject: 'Crown jewels stolen from the Louvre’s Apollo Gallery',
        what_happened: [
          { text: 'Thieves stole pieces of the French crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025.', sources: union(apollo, ids(src, /French crown jewels/)) },
          { text: 'Eight items were stolen; a ninth, the crown of Empress Eugénie, was dropped during the escape.', sources: union(eight, crown) },
        ],
        details: [
          { label: 'what', text: 'Pieces of the French crown jewels, including an emerald necklace given by Napoleon to his second wife.', sources: ids(src, /emerald necklace/i) },
          { label: 'where', text: 'The Apollo Gallery of the Louvre museum in Paris.', sources: apollo },
        ],
        facts: [
          { text: 'Nine objects were targeted and eight were stolen.', sources: eight },
          { text: 'The crown of Empress Eugénie, set with more than 1,300 diamonds, was found outside the museum.', sources: crown },
          { text: 'The stolen items include an emerald necklace and earrings that belonged to Empress Marie-Louise.', sources: ids(src, /Marie-Louise/) },
        ],
        unclear: [{ text: 'The sources reviewed do not say who the thieves were.', sources: [] }],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
  'pope-tavily': {
    note: 'Careful stand-in written from the recorded Tavily results: only what they say, each sentence citing the results that say it.',
    reply: (src) => {
      const aged = ids(src, /\b88\b/);
      const cause = ids(src, /stroke/i);
      return {
        matches: strongAll(src, 'Reports the death of Pope Francis on 21 April 2025.'),
        subject: 'Pope Francis dies aged 88',
        what_happened: [
          { text: 'Pope Francis died on 21 April 2025, aged 88, the Vatican announced.', sources: aged },
          { text: 'The Vatican said he died after a stroke followed by heart failure.', sources: cause },
        ],
        details: [{ label: 'why', text: 'A stroke followed by heart failure, the Vatican said.', sources: cause }],
        facts: [
          { text: 'Francis died at about 7:35 local time.', sources: ids(src, /07:35/) },
          { text: 'He had spent weeks in hospital earlier in 2025 with pneumonia.', sources: union(ids(src, /38 days in hospital/), ids(src, /weeks in the hospital/)) },
          { text: 'In his final will he asked to be buried in the Basilica of St Mary Major in Rome.', sources: union(ids(src, /St Mary Major/), ids(src, /St\. Mary Major/)) },
        ],
        unclear: [],
        conflicting: false,
        developing: false,
        confidence: 'strong',
      };
    },
  },
};
