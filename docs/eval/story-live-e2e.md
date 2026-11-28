# Story Search: end-to-end evaluation

Written 2026-11-28 00:09 UTC from branch `claude/eloquent-cerf-xnjbmt`, commit `8878b9a`.

Every case runs the whole of Story Search with the real code: the extension reads the link from a page, decides what to send and shows it for consent; its client sends it to the backend handler; the backend searches, matches, asks the AI, applies its rules and streams the report back; the client checks the report; the card is built from it. The one shortcut is the network hop between extension and backend (a function call).

What “offline”, “live” and “stand-in” mean here:

- **Offline**: no network, no keys, no cost. Real cases replay search results recorded once from the real Exa and Tavily; synthetic cases use made-up results about made-up places. Claude’s part is played by a stand-in reply written for the test (clearly marked), or by a real Claude reply saved by an earlier live run for exactly the same prompt.
- **Live search**: real requests to Exa and Tavily.
- **Live AI**: real requests to Claude, never a stand-in.
- Stand-in replies test LinkPeek’s pipeline and rules, not Claude. Some are deliberately bad (over-confident, or rating headline-only evidence as strong) to show LinkPeek’s own rules overruling them. Nothing in an offline run is counted as live.

## Results by category

| Category | What ran | Real or simulated | Result |
|---|---|---|---|
| Build | Extension types (`npm run typecheck`) | TypeScript, no emit | 1 passed |
| Build | Backend types (`npm --prefix server run typecheck`) | TypeScript, no emit | 1 passed |
| Unit | Extension unit tests (`npm test (without the end-to-end suite)`) | Mocked browser APIs (happy-dom); no network | 464 passed, 5 skipped |
| Unit | Backend unit tests (`npm --prefix server test`) | Stand-in search services and Claude client; no network | 158 passed, 9 skipped |
| Browser | Browser tests (whole extension) (`npm run test:e2e`) | Real Chromium with the real extension build; the Story Search backend is a local stand-in (scripts/serve-test-pages.mjs). Story Search tests: 21 of 21 passed. Failed: retrieval.spec.ts › Settings: the on-device AI option says plainly when this computer cannot run it | **1 failed**, 140 passed, 4 skipped |
| Build | Production build (`npm run build`) | The extension as it would ship | 1 passed |
| Offline integration | Story Search end to end, 41 cases plus 4 other checks (`npm run test:story-e2e`) | Recorded real search results and synthetic data; stand-in AI replies | 45 passed |
| Live search | Real Exa and Tavily searches for 6 case(s), recorded 2026-11-27 (`npm run test:story-e2e:record`) | Real Exa and Tavily; no AI | 6 of 6 answered |
| Live AI | **Not run**: no Anthropic key in the environment that produced this report | – | – |
| Full end-to-end | **Not run**: needs the Anthropic key as well as the search keys | – | – |

## Offline run

Ran 2026-11-28 00:09 UTC.

### Metrics per investigation

| Case | Answered by | Searches | HTTP requests | Results | Analysed | Fallback | Model | Tokens in / out | Claims dropped: unsupported / no real passage | Weak / contradicted | Cleaned: withdrawn / injected | Exa (reported) | Tavily credits | Claude | Backend ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pope | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0070 | 0 | – | 95 |
| louvre-card | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 / 2 | 0 / 0 | – / – | $0.0070 | 0 | – | 49 |
| louvre-url | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0070 | 0 | – | 25 |
| vague | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0070 | 0 | – | 10 |
| fabricated | exa | 3 | 3 | 18 | 5 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0210 | 0 | – | 13 |
| fabricated-invented | exa | 3 | 3 | 18 | 5 | no | stand-in | – | 3 / 4 | 0 / 0 | – / – | $0.0210 | 0 | – | 14 |
| insufficient | – | 0 | 0 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | – |
| pope-tavily | tavily | 1 | 2 | 8 | 5 | yes | stand-in | – | 0 / 1 | 0 / 0 | – / – | $0.0000 | 1 | – | 34 |
| conflicting | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 16 |
| duplicates | exa | 1 | 1 | 5 | 4 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 11 |
| dates-missing | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 12 |
| content-missing | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 6 |
| unrelated | exa | 3 | 3 | 9 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 3 |
| fallback-exa-ok | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0070 | 0 | – | 26 |
| fallback-exa-timeout | tavily | 1 | 2 | 8 | 5 | yes | stand-in | – | 0 / 1 | 0 / 0 | – / – | $0.0000 | 1 | – | 170 |
| fallback-both-timeout | – | 1 | 2 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 305 |
| fallback-busy-and-exhausted | – | 1 | 2 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 2 |
| fallback-tavily-exhausted | – | 1 | 1 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 1 |
| fallback-both-exhausted | – | 1 | 2 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 1 |
| fallback-exhausted-midway | exa | 2 | 3 | 1 | 1 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 6 |
| fallback-no-keys | – | 1 | 0 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 1 |
| malformed-search | – | 1 | 2 | 0 | 0 | no | – | – | – / – | – / – | – / – | $0.0000 | 0 | – | 2 |
| malformed-results | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 19 |
| ai-invalid | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – / – | – / – | – / – | $0.0000 | 0 | – | 3 |
| ai-truncated | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – / – | – / – | – / – | $0.0000 | 0 | – | 2 |
| ai-timeout | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – / – | – / – | – / – | $0.0000 | 0 | – | 3 |
| social-only | exa | 3 | 3 | 6 | 2 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 9 |
| opinion-only | exa | 3 | 3 | 6 | 2 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 4 |
| unknown-sites | exa | 3 | 3 | 6 | 2 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 5 |
| wrong-source | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 1 / 1 | 0 / 0 | – / – | $0.0000 | 0 | – | 9 |
| contradicted | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 0 | 1 / 1 | – / – | $0.0000 | 0 | – | 5 |
| wrong-date | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 1 / 1 | 0 / 0 | – / – | $0.0000 | 0 | – | 4 |
| unclear-allegation | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 1 / 1 | 0 / 0 | – / – | $0.0000 | 0 | – | 7 |
| same-headline | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 1 | 0 / 0 | – / – | $0.0000 | 0 | – | 5 |
| prompt-injection | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 0 / 1 | 0 / 0 | – / 1 | $0.0000 | 0 | – | 5 |
| correction | exa | 1 | 1 | 3 | 2 | no | stand-in | – | 0 / 0 | 0 / 1 | 1 / – | $0.0000 | 0 | – | 10 |
| foreign-language | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 0 / 0 | 2 / 0 | – / – | $0.0000 | 0 | – | 6 |
| misleading-headline | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 4 |
| sensational-accurate | exa | 1 | 1 | 2 | 2 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 5 |
| old-story | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 / 1 | 0 / 0 | – / – | $0.0000 | 0 | – | 7 |
| syndication-independent | exa | 1 | 1 | 4 | 4 | no | stand-in | – | 0 / 0 | 0 / 0 | – / – | $0.0000 | 0 | – | 6 |

Offline times have no network in them. Costs offline are what the recorded requests cost when they were recorded (Exa’s own figure, Tavily’s own credit count); synthetic searches cost nothing.

### Full headline naming a person: Pope Francis

- Case `pope`, real search results. Covers: accurate results, event date versus publication date.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Pope Francis died on 21 April 2025, Easter Monday, at the Vatican, aged 88. The report must give that event date (not a later publication date), and its sources must be real reports of his death (the Vatican, news agencies, major outlets), not later coverage.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Pope Francis died on Easter Monday, 21 April 2025, aged 88, at his residence in the Casa Santa Marta in the Vatican. [1, 5]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [5] “The 88-year-old pope, revered by millions of Catholics around the world, died at 7.35am in his apartment at Casa Santa Marta on Monday.”
  - The Vatican said he died after a stroke followed by heart failure. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
- Key details:
  - who: Pope Francis, the first Latin American leader of the Roman Catholic Church. [2, 3]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
  - where: His residence in the Casa Santa Marta, Vatican City. [1, 4, 5]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
    - [5] “The 88-year-old pope, revered by millions of Catholics around the world, died at 7.35am in his apartment at Casa Santa Marta on Monday.”
  - when: Easter Monday, 21 April 2025. [1, 2, 4]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
  - why: A stroke followed by heart failure, according to the Vatican. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
- Confirmed:
  - Pope Francis died aged 88. [1, 2, 3, 4, 5]
    - [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
  - The Vatican said the cause of death was a stroke followed by heart failure. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
  - He was the first Latin American pope. [2, 3]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
  - Cardinal Kevin Farrell announced the death at 9:45 am. [1]
    - [1] “By Devin Watkins At 9:45 AM, Cardinal Kevin Farrell, Camerlengo of the Holy Roman Church, announced the death of Pope Francis from the Casa Santa”
- Reported, not confirmed:
  - He was born on 17 December 1936 in Buenos Aires, Argentina. [4]
    - [4] “He was born on December 17, 1936, in Buenos Aires, Argentina, and had been head of the Roman Catholic Church since March 13, 2013.”

Headline accuracy: **accurate** for “Pope Francis dies aged 88”: The reports say Pope Francis died aged 88.
- [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
- [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
- [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · primary · strong match
2. [Pope Francis, first Latin American pontiff, dies after stroke and cardiac arrest \| Reuters](https://www.reuters.com/world/pope-francis-has-died-vatican-says-video-statement-2025-04-21/) · Reuters · 2025-04-21 · agency · strong match · credits Reuters
3. [Pope Francis, first Latin American pontiff, dies at 88 \| AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency · strong match · credits Associated Press
4. [In Memoriam: Pope Francis (1936-2025) \| National Archives](https://www.archives.gov/news/articles/pope-francis-memoriam) · archives.gov · 2025-04-21 · primary · strong match
5. [Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian](https://www.theguardian.com/world/2025/apr/21/pope-francis-died-from-a-stroke-followed-by-heart-failure-vatican-says) · The Guardian · 2025-04-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Francis/ |
| Correct event dates | pass | found /21 April 2025/ |
| Correct locations | pass | found /Vatican/ |
| Relevant facts | pass | found /\b88\b/ |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 11 factual claim(s), every one cites a listed source with a passage of its own (25 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 11 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | accurate: The reports say Pope Francis died aged 88. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 95 ms in the backend, 165 ms in all.

### "Read more" link in an article card: the Louvre jewel theft

- Case `louvre-card`, real search results. Covers: accurate results, card clues, no mixing with other news about the same place.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Louvre jewel heist: thieves steal crown jewels in daylight raid” (card-heading); teaser “Thieves used a vehicle-mounted lift to reach the Apollo Gallery and escaped within minutes.”; date 2025-10-19 (card-label); address https://paper.example.org/p/88231.
- Expected: Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid of a few minutes. Only the heist: not other Louvre news (strikes, renovation plans, the Mona Lisa).
- Actual: **report**, match **strong**, confidence **strong**, subject “Thieves steal crown jewels from the Louvre in daylight raid”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Thieves stole French crown jewels from the Louvre museum in Paris in a daylight raid on Sunday 19 October 2025. [1, 2]
    - [1] “Paris (AFP) – Thieves raided Paris's Louvre museum in broad daylight Sunday, taking just seven minutes to grab some of France's priceless crown jewels, but dropping a gem-encrusted crown as”
    - [2] “PARIS (AP) — Thieves took less than eight minutes to steal 88 million euros ($102 million) worth of crown jewels in a weekend heist at the world’s most visited museum,”
  - They used a basket lift to reach an upstairs window and were inside the museum for less than four minutes. [2, 4]
    - [2] “PARIS (AP) — Thieves took less than eight minutes to steal 88 million euros ($102 million) worth of crown jewels in a weekend heist at the world’s most visited museum,”
    - [4] “Officials said the heist lasted less than eight minutes in total, including less than four minutes inside the Louvre.”
- Key details:
  - what: Eight items of jewellery from France’s crown jewels were stolen. [1]
    - [1] “A culture ministry statement said eight items of jewellery had been stolen from the”
- Confirmed:
  - A crown was dropped as the thieves fled, and was found outside the museum. [1, 3]
    - [1] “Paris (AFP) – Thieves raided Paris's Louvre museum in broad daylight Sunday, taking just seven minutes to grab some of France's priceless crown jewels, but dropping a gem-encrusted crown as”
    - [3] “The crown of Empress Eugenie was found outside the museum.”
- Reported, not confirmed:
  - Officials put the value of the stolen jewels at about 88 million euros ($102 million). [2]
    - [2] “PARIS (AP) — Thieves took less than eight minutes to steal 88 million euros ($102 million) worth of crown jewels in a weekend heist at the world’s most visited museum,”
  - The theft took less than eight minutes in total. [2, 4]
    - [2] “PARIS (AP) — Thieves took less than eight minutes to steal 88 million euros ($102 million) worth of crown jewels in a weekend heist at the world’s most visited museum,”
    - [4] “Officials said the heist lasted less than eight minutes in total, including less than four minutes inside the Louvre.”
- Unclear:
  - The sources reviewed do not say who the thieves were.

Headline accuracy: **accurate** for “Louvre jewel heist: thieves steal crown jewels in daylight raid”: The reports say thieves stole crown jewels from the Louvre in a daylight raid.
- [1] “Thieves steal French crown jewels from Louvre in daytime raid”
- [2] “PARIS (AP) — Thieves took less than eight minutes to steal 88 million euros ($102 million) worth of crown jewels in a weekend heist at the world’s most visited museum,”

Sources:

1. [Thieves steal French crown jewels from Louvre in daytime raid](https://www.france24.com/en/live-news/20251019-thieves-steal-french-crown-jewels-from-louvre-in-daytime-raid) · France 24 · 2025-10-19 · news · strong match · credits AFP
2. [A timeline of the jewel heist at the Louvre in Paris \| AP News](https://apnews.com/article/louvre-heist-jewels-paris-timeline-a072c2a5aba6ab5eeb429a280266a799) · Associated Press · 2025-10-22 · agency · strong match · credits Associated Press
3. [What jewels did the Louvre thieves target? \| Reuters](https://www.reuters.com/world/europe/what-jewels-did-louvre-thieves-target-2025-10-19/) · Reuters · 2025-10-19 · agency · strong match · credits Reuters
4. [Louvre closed after historic jewels stolen in daylight \| AP News](https://apnews.com/article/louvre-closed-jewel-heist-2cc473fc178ae6a3513daa0c71b43409) · Associated Press · 2025-10-20 · agency · strong match · repeats 2 · credits Associated Press
5. [How the Louvre museum robbery happened in video, photographs and maps \| Paris \| The Guardian](https://www.theguardian.com/world/2025/oct/20/louvre-museum-robbery-thieves-stolen-jewellery) · The Guardian · 2025-10-19 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Louvre/ |
| Correct event dates | review | found /19 October 2025/; "2025-10-19" in "Thieves stole French crown jewels from the Louvre museum in …" matches a source's publication date but not its text: check it's the event date |
| Correct locations | pass | found /Paris\|Apollo Gallery/ |
| Relevant facts | pass | found /jewel/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 6 factual claim(s), every one cites a listed source with a passage of its own (10 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 7 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | accurate: The reports say thieves stole crown jewels from the Louvre in a daylight raid. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Thieves steal crown jewels from the Louvre in daylight raid |
| Card: Doesn't show "Read more" | pass | Read more |
| Card: Doesn't show "new entrance" | pass | new entrance |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 49 ms in the backend, 62 ms in all.

### Only the address: the same Louvre story from the URL’s words and date

- Case `louvre-url`, real search results. Covers: accurate results, address clues.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: address words “louvre crown jewels stolen apollo gallery”; date 2025-10-19 (url-date); address https://paper.example.org/2025/10/19/louvre-crown-jewels-stolen-apollo-gallery.
- Expected: The same Louvre heist (19 October 2025), found from the address words and the date in the address alone.
- Actual: **report**, match **strong**, confidence **strong**, subject “Crown jewels stolen from the Louvre’s Apollo Gallery”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Thieves stole pieces of the French crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025. [1, 2]
    - [1] “The thieves targeted the Louvre’s Apollo Gallery on the upper floor, which houses the French Crown Jewels.”
    - [2] “Inside the richly decorated gallery they made for two display-cases which contain what remains of the French crown jewels.”
  - Eight items were stolen; a ninth, the crown of Empress Eugénie, was dropped during the escape. [2, 4, 5]
    - [2] “Most of France's royal regalia was lost or sold after the 1789 Revolution, but some items were saved or bought back.”
    - [4] “The thieves lost the ninth one, the crown of Napoleon III’s wife, Empress Eugenie, during their escape, Beccuau said.”
    - [5] “One object, the emerald-set imperial crown of Napoleon III’s wife, Empress Eugénie, containing more than 1,300 diamonds, was later found outside the museum, French authorities said.”
- Key details:
  - what: Pieces of the French crown jewels, including an emerald necklace given by Napoleon to his second wife. [1, 3]
    - [1] “Precious artefacts snatched from Paris’s Louvre Museum on Sunday include an emerald necklace set with more than 1,000 diamonds gifted by Napoleon to his second wife and other treasures of”
    - [3] “— Emerald necklace of Empress Marie-Louise, Napoleon I’s second wife — Emerald earrings worn by Empress Marie-Louise — Crown worn by Empress Eugenie, wife of Napoleon III — Brooch of”
  - where: The Apollo Gallery of the Louvre museum in Paris. [1]
    - [1] “The thieves targeted the Louvre’s Apollo Gallery on the upper floor, which houses the French Crown Jewels.”
- Confirmed:
  - Nine objects were targeted and eight were stolen. [2, 4]
    - [2] “Stolen treasures, a crown dropped as thieves fled - and serious questions for Louvre security”
    - [4] “A total of nine objects were targeted by the criminals, and eight were actually stolen.”
  - The crown of Empress Eugénie, set with more than 1,300 diamonds, was found outside the museum. [4, 5]
    - [4] “The thieves lost the ninth one, the crown of Napoleon III’s wife, Empress Eugenie, during their escape, Beccuau said.”
    - [5] “One object, the emerald-set imperial crown of Napoleon III’s wife, Empress Eugénie, containing more than 1,300 diamonds, was later found outside the museum, French authorities said.”
- Reported, not confirmed:
  - The stolen items include an emerald necklace and earrings that belonged to Empress Marie-Louise. [3]
    - [3] “— Emerald necklace of Empress Marie-Louise, Napoleon I’s second wife — Emerald earrings worn by Empress Marie-Louise — Crown worn by Empress Eugenie, wife of Napoleon III — Brooch of”
- Unclear:
  - The sources reviewed do not say who the thieves were.

Sources:

1. [French crown jewels: What we know about the stolen Louvre treasures \| CNN](https://www.cnn.com/2025/10/20/style/louvre-heist-which-jewels-stolen-intl-hnk) · CNN · 2025-10-20 · news · strong match
2. [Stolen treasures, a crown dropped as thieves fled - and serious questions for Louvre security](https://www.bbc.com/news/articles/cj0e24rrjz1o) · BBC News · 2025-10-19 · news · strong match
3. [Louvre museum robbery: Jewels of French royalty stolen in daring heist \| AP News](https://apnews.com/article/louvre-museum-theft-jewels-france-66eb823d9ac9b084fda4f4e9d4c72243) · Associated Press · 2025-10-20 · agency · strong match · credits Associated Press
4. [Louvre museum robbery: How thieves broke in and what they stole](https://www.reuters.com/graphics/FRANCE-CRIME/LOUVRE/byprezooove/) · Reuters · 2025-10-20 · agency · strong match · credits Reuters
5. [Thieves use basket lift in daring Louvre robbery, steal priceless jewels \| AP News](https://apnews.com/article/france-louvre-museum-robbery-a3687f330a43e0aaff68c732c4b2585b) · Associated Press · 2025-10-19 · agency · strong match · repeats 3 · credits Associated Press

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Louvre/ |
| Correct event dates | review | found /19 October 2025/; "2025-10-19" in "Thieves stole pieces of the French crown jewels from the Lou…" matches a source's publication date but not its text: check it's the event date |
| Correct locations | pass | found /Paris\|Apollo Gallery/ |
| Relevant facts | pass | found /jewel/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 7 factual claim(s), every one cites a listed source with a passage of its own (13 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 8 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Crown jewels stolen from the Louvre’s Apollo Gallery |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 25 ms in the backend, 33 ms in all.

### Vague headline, no name and no date: "Pop star found dead in hotel room"

- Case `vague`, real search results. Covers: vague headlines, old incident not shown as current.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: calls every source a strong match, names the person as the subject and rates the evidence strong. LinkPeek’s rules must overrule it.
- What the extension sent: headline “Pop star found dead in hotel room” (link-text); address https://celeb.example.com/p/1.
- Expected: Many deaths fit this headline. LinkPeek must not say who it is about, must not present an old case (the search finds Whitney Houston’s death in 2012) as this story, and must say why: the link gives no name or date. At most a possible match: the closest results listed with their dates, and no report written about any one of them.
- Actual: **report**, match **possible**, confidence **insufficient**, no subject, notes: vague-link.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Sources:

1. [Smashed hotel room, narcotics found as Liam Payne death probe unfolds \| Reuters](https://www.reuters.com/world/americas/argentina-police-say-found-total-disorder-search-liam-paynes-hotel-room-2024-10-17/) · Reuters · 2024-10-17 · agency · possible match · credits Reuters
2. [BBC News \| World \| INXS singer found dead](http://news.bbc.co.uk/2/hi/33774.stm) · BBC News · 1997-11-22 · news · possible match
3. [Whitney Houston, A 'Perfect Instrument,' Dies : NPR](https://www-s1.npr.org/2012/02/12/146761831/whitney-houston-a-perfect-instrument-has-died) · NPR · 2012-02-12 · news · possible match
4. [Whitney Houston died in Beverly Hills hotel room - CBS News](https://www.cbsnews.com/news/whitney-houston-died-in-beverly-hills-hotel-room/) · CBS News · 2012-02-12 · news · possible match
5. [Whitney Houston Drowned, Coroner Says](https://www.nytimes.com/2012/03/23/arts/music/whitney-houston-drowned-coroner-says.html) · The New York Times · 2012-03-22 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report or no-match or report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: vague-link |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Possible match, Insufficient information |
| Card: Says why the match is uncertain | pass | the vague-link explanation is shown above the report |
| Card: Doesn't show "What happened?" | pass | What happened? |
| Card: Doesn't show "Written by AI" | pass | Written by AI |
| Card: Doesn't show "Whitney Houston was found dead" | pass | Whitney Houston was found dead |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 10 ms in the backend, 16 ms in all.

### Made-up story: "Mayor of Zarnwick resigns after canal bridge collapse injures 14"

- Case `fabricated`, real search results. Covers: fabricated stories, unrelated results.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in: finds that no source is about Zarnwick and matches none.
- What the extension sent: headline “Mayor of Zarnwick resigns after canal bridge collapse injures 14” (link-text); address words “zarnwick mayor resigns canal bridge collapse”; date 2026-11-20 (url-date); address https://news.example.com/2026/11/20/zarnwick-mayor-resigns-canal-bridge-collapse.
- Expected: There is no such town or story. LinkPeek must find no reliable match, name nobody, and write no report.
- Actual: **no-match**, match **none**, confidence **insufficient**, no subject, notes: older-story.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome no-match (expected no-match or no-results); match none (expected none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: older-story |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |

Metrics: 3 search(es) (best → nothing-relevant>names-and-event → nothing-relevant>broader), 3 HTTP request(s), answered by exa; 18 result(s) retrieved, 12 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0210 as reported by Exa, Tavily 0 credit(s), Claude –; 13 ms in the backend, 16 ms in all.

### Made-up story, and an AI that invents a report to match it

- Case `fabricated-invented`, real search results. Covers: fabricated stories, unsupported claims.
- Search: Exa: real results replayed from the “fabricated” recording; Tavily: must not be asked.
- AI: stand-in reply written for the test (not Claude). Deliberately bad stand-in: calls every result the story and invents a report (a mayor’s name, 14 injured, a date). LinkPeek’s rules must keep all of it off the card.
- What the extension sent: headline “Mayor of Zarnwick resigns after canal bridge collapse injures 14” (link-text); address words “zarnwick mayor resigns canal bridge collapse”; date 2026-11-20 (url-date); address https://news.example.com/2026/11/20/zarnwick-mayor-resigns-canal-bridge-collapse.
- Expected: The same real search results, but the AI (a deliberately bad stand-in) claims they are the story and invents names, numbers and a date. None of that may reach the card: every sentence states something no result says, so LinkPeek shows no report and no possible matches.
- Actual: **no-match**, match **none**, confidence **insufficient**, no subject, notes: older-story.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome no-match (expected no-match or no-results); match none (expected none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: older-story |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |
| Card: Doesn't show "Pieter Holm" | pass | Pieter Holm |
| Card: Doesn't show "Fourteen people" | pass | Fourteen people |
| Card: Doesn't show "Possibly related" | pass | Possibly related |

Metrics: 3 search(es) (best → nothing-relevant>names-and-event → nothing-relevant>broader), 3 HTTP request(s), answered by exa; 18 result(s) retrieved, 12 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0210 as reported by Exa, Tavily 0 credit(s), Claude –; 14 ms in the backend, 18 ms in all.

### Bare "Read more" to an address with only an ID

- Case `insufficient`, real search results. Covers: insufficient information.
- Search: none (nothing may be sent).
- AI: not called.
- What the extension sent: nothing.
- Expected: Nothing to search on: LinkPeek must say so and send nothing (no search, no AI, no cost).
- Actual: **insufficient**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome insufficient (expected insufficient) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | There isn't enough information about this link to search for it. Its text, its address and the page around it don't say what the story is. |

Metrics: 0 search(es) (none), 0 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; – ms in the backend, 1 ms in all.

### Exa’s free credit used up (simulated): Tavily finds Pope Francis instead

- Case `pope-tavily`, real search results. Covers: credit exhaustion, fallback.
- Search: Exa simulated (HTTP 402 NO_MORE_CREDITS); replay of real Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded Tavily results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa says its credit is used up; Tavily takes over and the same correct story is found from Tavily’s real results.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Pope Francis died on 21 April 2025, aged 88, the Vatican announced. [1, 2, 3, 4, 5]
    - [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
    - [2] “Vatican announces death of Pope Francis aged 88”
    - [3] “The basilica, which sits outside the Vatican, is home to Francis’ favorite icon of the Virgin Mary, to whom Francis was particularly devoted.”
    - [4] “Pope Francis has died at 88 : NPR”
    - [5] “VATICAN CITY—Pope Francis, who sought to refocus the Catholic Church on promoting social and economic justice rather than traditional moral teachings but presided over growing divisions in the church and”
  - The Vatican said he died after a stroke followed by heart failure. [2, 4, 5]
    - [2] “A statement continued: "He taught us to live the values ​​of the Gospel with fidelity, courage and universal love, especially in favour of the poorest and most marginalised." The Vatican”
    - [4] “The Vatican later said the cause of death was a stroke, followed by a coma and heart failure.”
    - [5] “His health remained fragile after he returned to his residence in the Vatican.”
- Key details:
  - why: A stroke followed by heart failure, the Vatican said. [2, 4, 5]
    - [2] “A statement continued: "He taught us to live the values ​​of the Gospel with fidelity, courage and universal love, especially in favour of the poorest and most marginalised." The Vatican”
    - [4] “The Vatican later said the cause of death was a stroke, followed by a coma and heart failure.”
    - [5] “The cause of death was a stroke and cardiac arrest, according to a medical bulletin released by the Vatican.”
- Confirmed:
  - In his final will he asked to be buried in the Basilica of St Mary Major in Rome. [2, 3]
    - [2] “In his final testament, released by the Vatican late on Monday, he asked to be buried in Rome's Basilica of St Mary Major.”
    - [3] “In his final will, Francis confirmed he will be buried in St.”
- Reported, not confirmed:
  - He had spent weeks in hospital earlier in 2025 with pneumonia. [1, 5]
    - [1] “Pope Francis was admitted to the Agostino Gemelli Polyclinic Hospital on Friday, February 14, 2025, after suffering from a bout of bronchitis for several days.”
    - [5] “The pope’s death came after he spent weeks in the hospital earlier this year to treat a serious bout of pneumonia.”

Headline accuracy: **accurate** for “Pope Francis dies aged 88”: The reports say Pope Francis died aged 88.
- [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
- [2] “Vatican announces death of Pope Francis aged 88”
- [3] “Pope Francis, first Latin American pontiff, dies at 88 \| AP News”

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · primary · strong match
2. [Vatican announces death of Pope Francis aged 88](https://www.bbc.com/news/articles/cqj42vd1rxlo) · BBC News · 2025-04-21 · news · strong match
3. [Pope Francis, first Latin American pontiff, dies at 88 \| AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency · strong match · credits Associated Press
4. [Pope Francis has died at 88 : NPR](https://www.npr.org/2025/04/21/1013050313/pope-francis-dead) · NPR · 2025-04-21 · news · strong match
5. [Pope Francis, Advocate for Economic and Social Justice, Dies at 88 - WSJ](https://www.wsj.com/world/pope-francis-advocate-for-economic-and-social-justice-dies-at-88-103eeff3) · The Wall Street Journal · 2025-04-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Francis/ |
| Correct event dates | review | found /21 April 2025/; "2025-04-21" in "Pope Francis died on 21 April 2025, aged 88, the Vatican ann…" matches a source's publication date but not its text: check it's the event date |
| Correct locations | pass | found /Vatican/ |
| Relevant facts | pass | found /\b88\b/ |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source with a passage of its own (15 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | accurate: The reports say Pope Francis died aged 88. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by tavily (fallback used); 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 1 credit(s), Claude –; 34 ms in the backend, 42 ms in all.

### Sources disagree: a warehouse fire (synthetic)

- Case `conflicting`, synthetic data (made up for the test). Covers: conflicts.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: states what the three reports agree on and puts the disputed injury count and cause under “What remains unclear?”.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: Three independent reports agree a warehouse on Dock Road burned on 12 November 2026, but disagree on how many were hurt (three or seven) and on the cause (an electrical fault, or not yet known). The report must state the agreed facts, say what each source reports on the disputed ones, and leave them open.
- Actual: **report**, match **strong**, confidence **conflicting**, subject “Fire destroys warehouse on Dock Road in Port Elsworth”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - A fire destroyed a warehouse on Dock Road in Port Elsworth on 12 November 2026. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Key details:
  - where: A warehouse on Dock Road, Port Elsworth. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
  - when: Overnight on 12 November 2026. [1, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Confirmed:
  - The fire destroyed a warehouse on Dock Road in Port Elsworth. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Reported, not confirmed:
  - Fire crews were called shortly after midnight. [3]
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Unclear:
  - How many people were hurt: Harbour Gazette and Coast News say three people were treated in hospital, while Elsworth Times says seven workers were injured. [1, 2, 3]
    - [1] “Three people were taken to hospital with smoke inhalation, the fire service said.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “The fire service said three people were treated in hospital.”
  - The cause: Elsworth Times says investigators believe an electrical fault started the fire, while Harbour Gazette and Coast News say the cause is not yet known. [1, 2, 3]
    - [1] “The cause of the fire is not yet known and an investigation has begun.”
    - [2] “Investigators believe an electrical fault in the loading bay started the fire, a council spokesperson said.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”

Headline accuracy: **unverified** for “Fire destroys warehouse at Port Elsworth docks”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · Harbour Gazette · 2026-11-12 · news · strong match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · Elsworth Times · 2026-11-12 · news · strong match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · Coast News · 2026-11-13 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | pass | found /12 November 2026/ |
| Correct locations | pass | found /Dock Road/ |
| Relevant facts | pass | found /warehouse/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | disputed values only under "What remains unclear?" |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source with a passage of its own (18 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence conflicting (expected conflicting); notes: none |
| Clear, readable writing | pass | 7 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Conflicting information |
| Card: Subject shown | pass | Fire destroys warehouse on Dock Road in Port Elsworth |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 16 ms in the backend, 26 ms in all.

### One wire story printed twice, an AMP copy and an unrelated result (synthetic)

- Case `duplicates`, synthetic data (made up for the test). Covers: duplicates, syndication, unrelated results.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: matches the three ferry reports, not the football result, and cites the wire copies and the independent report separately.
- What the extension sent: headline “Gullholm ferry service suspended after engine failure” (link-text); address words “gullholm ferry suspended engine failure”; date 2026-11-03 (url-date); address https://news.example.com/2026/11/03/gullholm-ferry-suspended-engine-failure.
- Expected: The ferry between Port Elsworth and Gullholm was suspended after an engine failure. The same wire report appears on two sites (one source, not two), one of them also as an AMP page (listed once), and one independent report adds detail. A sports story that shares a place name is not a match. Only facts from two independent reports may be called confirmed.
- Actual: **report**, match **strong**, confidence **strong**, subject “Port Elsworth to Gullholm ferry suspended after engine failure”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - The ferry between Port Elsworth and Gullholm was suspended after an engine failure, its operator Isle Link said. [1, 2, 3]
    - [1] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [2] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [3] “Isle Link said on 4 November that engineers had found a fault in the ferry’s main engine after it failed on the crossing to Gullholm.”
- Key details:
  - who: Isle Link, the ferry operator. [1, 2, 3]
    - [1] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [2] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [3] “Isle Link said on 4 November that engineers had found a fault in the ferry’s main engine after it failed on the crossing to Gullholm.”
- Confirmed:
  - The ferry between Port Elsworth and Gullholm was suspended after its engine failed. [1, 2, 3]
    - [1] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [2] “The ferry linking Port Elsworth and Gullholm has been suspended after an engine failure on Monday, the operator Isle Link said.”
    - [3] “Isle Link said on 4 November that engineers had found a fault in the ferry’s main engine after it failed on the crossing to Gullholm.”
- Reported, not confirmed:
  - Passengers were told to expect no sailings until at least 10 November. [1, 2]
    - [1] “Passengers have been told to expect no sailings until at least 10 November while repairs are carried out.”
    - [2] “Passengers have been told to expect no sailings until at least 10 November while repairs are carried out.”
  - Replacement buses and a chartered boat will carry passengers until sailings resume, Isle Link said. [3]
    - [3] “The company said replacement buses and a chartered boat would carry passengers until sailings resume.”
- Unclear:
  - When the ferry will sail again is not yet confirmed.

Headline accuracy: **unverified** for “Gullholm ferry service suspended after engine failure”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Gullholm ferry suspended after engine failure](https://coastalwire.example/news/2026/11/03/gullholm-ferry-suspended) · Coastal Wire · 2026-11-03 · agency · strong match
2. [Gullholm ferry suspended after engine failure](https://harbourgazette.example/news/2026/11/03/gullholm-ferry-suspended-after-engine-failure) · Harbour Gazette · 2026-11-03 · news · strong match · repeats 1
3. [Isle Link says Gullholm ferry repairs will take a week](https://elsworthtimes.example/news/2026/11/04/isle-link-ferry-repairs) · Elsworth Times · 2026-11-04 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Gullholm/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /engine/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source with a passage of its own (12 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 6 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Port Elsworth to Gullholm ferry suspended after engine failure |
| Card: Doesn't show "Gullholm Rovers" | pass | Gullholm Rovers |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 5 result(s) retrieved, 4 kept, 4 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 11 ms in the backend, 18 ms in all.

### No dates anywhere: the link and every result are undated (synthetic)

- Case `dates-missing`, synthetic data (made up for the test). Covers: missing dates.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: reports the vote without giving any date the sources don’t give.
- What the extension sent: headline “Council in Port Elsworth approves new harbour wall after storm damage” (link-text); address https://news.example.com/p/77812.
- Expected: The story is clear but no source gives a date. The report must not invent one (no "on 17 November 2026"), and the card must show the sources without dates.
- Actual: **report**, match **strong**, confidence **strong**, subject “Port Elsworth council approves new harbour wall”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Port Elsworth council approved plans for a new harbour wall after storms damaged the old one. [1, 2, 3]
    - [1] “Port Elsworth council has approved plans for a new harbour wall following storm damage last month.”
    - [2] “Councillors in Port Elsworth voted on Tuesday to build a new harbour wall after storms damaged the old one.”
    - [3] “Harbour wall plan passes in Port Elsworth”
- Key details:
  - where: Port Elsworth harbour. [1, 2, 3]
    - [1] “New harbour wall approved for Port Elsworth”
    - [2] “Port Elsworth council backs new harbour wall”
    - [3] “Harbour wall plan passes in Port Elsworth”
- Confirmed:
  - Port Elsworth council approved a new harbour wall. [1, 2, 3]
    - [1] “Port Elsworth council has approved plans for a new harbour wall following storm damage last month.”
    - [2] “Port Elsworth council backs new harbour wall”
    - [3] “Harbour wall plan passes in Port Elsworth”
- Reported, not confirmed:
  - The work is expected to cost £4.2 million. [2]
    - [2] “The work is expected to cost £4.2 million.”
- Unclear:
  - The sources reviewed don’t give the date of the vote.

Headline accuracy: **unverified** for “Council in Port Elsworth approves new harbour wall after storm damage”: There isn't enough matching reporting to judge the headline.

Sources:

1. [New harbour wall approved for Port Elsworth](https://elsworthtimes.example/news/harbour-wall-vote) · Elsworth Times · no date · news · strong match
2. [Port Elsworth council backs new harbour wall](https://harbourgazette.example/news/port-elsworth-harbour-wall-approved) · Harbour Gazette · no date · news · strong match
3. [Harbour wall plan passes in Port Elsworth](https://coastnews.example/news/harbour-wall-plan-passes) · Coast News · no date · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /harbour wall/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 4 factual claim(s), every one cites a listed source with a passage of its own (10 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: none |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Port Elsworth council approves new harbour wall |
| Card: Doesn't show "Invalid Date" | pass | Invalid Date |
| Card: Doesn't show "undefined" | pass | undefined |
| Card: Doesn't show "NaN" | pass | NaN |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 12 ms in the backend, 18 ms in all.

### Results with headlines only, no page text (synthetic)

- Case `content-missing`, synthetic data (made up for the test). Covers: missing content.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: rates headline-only evidence as strong. LinkPeek’s rules must lower it.
- What the extension sent: headline “Port Elsworth lifeboat crew rescue two fishermen off Gull Point” (link-text); address words “port elsworth lifeboat rescue gull point”; date 2026-11-18 (url-date); address https://news.example.com/2026/11/18/port-elsworth-lifeboat-rescue-gull-point.
- Expected: Every result has a headline but no text. The report may say what the headlines say, must note that it rests on headlines only, and must not rate the evidence as strong.
- Actual: **report**, match **strong**, confidence **partial**, subject “Lifeboat crew rescue two fishermen off Gull Point”, notes: snippets-only.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - A lifeboat crew from Port Elsworth rescued two fishermen off Gull Point. [1, 2, 3]
    - [1] “Port Elsworth lifeboat volunteers praised after Gull Point rescue”
    - [2] “Lifeboat crew rescue two fishermen off Gull Point”
    - [3] “Two fishermen rescued near Port Elsworth”
- Confirmed:
  - Two fishermen were rescued off Gull Point. [1, 2, 3]
    - [1] “Port Elsworth lifeboat volunteers praised after Gull Point rescue”
    - [2] “Lifeboat crew rescue two fishermen off Gull Point”
    - [3] “Two fishermen rescued near Port Elsworth”
- Unclear:
  - The sources give only headlines, so the details of the rescue are not known.
  - The sources reviewed don't establish when this happened.

Headline accuracy: **unverified** for “Port Elsworth lifeboat crew rescue two fishermen off Gull Point”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Port Elsworth lifeboat volunteers praised after Gull Point rescue](https://coastnews.example/news/2026/11/19/lifeboat-volunteers-praised) · Coast News · 2026-11-19 · news · strong match
2. [Lifeboat crew rescue two fishermen off Gull Point](https://harbourgazette.example/news/2026/11/18/gull-point-rescue) · Harbour Gazette · 2026-11-18 · news · strong match
3. [Two fishermen rescued near Port Elsworth](https://elsworthtimes.example/news/2026/11/18/fishermen-rescued) · Elsworth Times · 2026-11-18 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong |
| Correct names | pass | found /Gull Point/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (6 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial or insufficient); notes: snippets-only |
| Clear, readable writing | pass | 4 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Lifeboat crew rescue two fishermen off Gull Point |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 6 ms in the backend, 12 ms in all.

### Every result is about something else (synthetic)

- Case `unrelated`, synthetic data (made up for the test). Covers: unrelated results.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: not called.
- What the extension sent: headline “Port Elsworth library to close for six months for roof repairs” (link-text); address words “port elsworth library closes roof repairs”; date 2026-11-25 (url-date); address https://news.example.com/2026/11/25/port-elsworth-library-closes-roof-repairs.
- Expected: Nothing found is about the library closure. LinkPeek must say no reliable match, and must not even ask the AI (nothing close enough to send).
- Actual: **no-match**, match **none**, confidence **insufficient**, no subject.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome no-match (expected no-match or no-results); match none (expected none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |

Metrics: 3 search(es) (best → nothing-relevant>address-words → nothing-relevant>names-and-event), 3 HTTP request(s), answered by exa; 9 result(s) retrieved, 3 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 3 ms in the backend, 5 ms in all.

### Exa answers: Tavily is never asked

- Case `fallback-exa-ok`, real search results. Covers: fallback.
- Search: Exa: real results replayed from the “pope” recording; Tavily: must not be asked.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa has credit and answers, so Tavily is not called at all.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Pope Francis died on Easter Monday, 21 April 2025, aged 88, at his residence in the Casa Santa Marta in the Vatican. [1, 5]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [5] “The 88-year-old pope, revered by millions of Catholics around the world, died at 7.35am in his apartment at Casa Santa Marta on Monday.”
  - The Vatican said he died after a stroke followed by heart failure. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
- Key details:
  - who: Pope Francis, the first Latin American leader of the Roman Catholic Church. [2, 3]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
  - where: His residence in the Casa Santa Marta, Vatican City. [1, 4, 5]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
    - [5] “The 88-year-old pope, revered by millions of Catholics around the world, died at 7.35am in his apartment at Casa Santa Marta on Monday.”
  - when: Easter Monday, 21 April 2025. [1, 2, 4]
    - [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
  - why: A stroke followed by heart failure, according to the Vatican. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
- Confirmed:
  - Pope Francis died aged 88. [1, 2, 3, 4, 5]
    - [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
    - [4] “Pope Francis died at age 88 on April 21, 2025, in Vatican City.”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
  - The Vatican said the cause of death was a stroke followed by heart failure. [2, 5]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [5] “Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian”
  - He was the first Latin American pope. [2, 3]
    - [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
    - [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”
  - Cardinal Kevin Farrell announced the death at 9:45 am. [1]
    - [1] “By Devin Watkins At 9:45 AM, Cardinal Kevin Farrell, Camerlengo of the Holy Roman Church, announced the death of Pope Francis from the Casa Santa”
- Reported, not confirmed:
  - He was born on 17 December 1936 in Buenos Aires, Argentina. [4]
    - [4] “He was born on December 17, 1936, in Buenos Aires, Argentina, and had been head of the Roman Catholic Church since March 13, 2013.”

Headline accuracy: **accurate** for “Pope Francis dies aged 88”: The reports say Pope Francis died aged 88.
- [1] “# Pope Francis has died on Easter Monday aged 88 Pope Francis died on Easter Monday, April 21, 2025, at the age of 88 at his residence in the Vatican's”
- [2] “VATICAN CITY, April 21 (Reuters) - Pope Francis, the first Latin American leader of the Roman Catholic Church, died on Monday after suffering a stroke and cardiac arrest, the Vatican”
- [3] “VATICAN CITY (AP) — Pope Francis, history’s first Latin American pontiff who charmed the world with his humble style and concern for the poor but alienated conservatives with critiques of”

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · primary · strong match
2. [Pope Francis, first Latin American pontiff, dies after stroke and cardiac arrest \| Reuters](https://www.reuters.com/world/pope-francis-has-died-vatican-says-video-statement-2025-04-21/) · Reuters · 2025-04-21 · agency · strong match · credits Reuters
3. [Pope Francis, first Latin American pontiff, dies at 88 \| AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency · strong match · credits Associated Press
4. [In Memoriam: Pope Francis (1936-2025) \| National Archives](https://www.archives.gov/news/articles/pope-francis-memoriam) · archives.gov · 2025-04-21 · primary · strong match
5. [Pope Francis died from a stroke followed by heart failure, Vatican says \| Pope Francis \| The Guardian](https://www.theguardian.com/world/2025/apr/21/pope-francis-died-from-a-stroke-followed-by-heart-failure-vatican-says) · The Guardian · 2025-04-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Francis/ |
| Correct event dates | pass | found /21 April 2025/ |
| Correct locations | pass | found /Vatican/ |
| Relevant facts | pass | found /\b88\b/ |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 11 factual claim(s), every one cites a listed source with a passage of its own (25 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 11 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | accurate: The reports say Pope Francis died aged 88. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 26 ms in the backend, 33 ms in all.

### Exa times out: Tavily takes over

- Case `fallback-exa-timeout`, real search results. Covers: timeouts, fallback.
- Search: Exa: no answer until its timeout (simulated); Tavily: real results replayed from the “pope-tavily” recording.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded Tavily results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa never answers; after its timeout Tavily is asked and the story is found from Tavily’s real results.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Pope Francis died on 21 April 2025, aged 88, the Vatican announced. [1, 2, 3, 4, 5]
    - [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
    - [2] “Vatican announces death of Pope Francis aged 88”
    - [3] “The basilica, which sits outside the Vatican, is home to Francis’ favorite icon of the Virgin Mary, to whom Francis was particularly devoted.”
    - [4] “Pope Francis has died at 88 : NPR”
    - [5] “VATICAN CITY—Pope Francis, who sought to refocus the Catholic Church on promoting social and economic justice rather than traditional moral teachings but presided over growing divisions in the church and”
  - The Vatican said he died after a stroke followed by heart failure. [2, 4, 5]
    - [2] “A statement continued: "He taught us to live the values ​​of the Gospel with fidelity, courage and universal love, especially in favour of the poorest and most marginalised." The Vatican”
    - [4] “The Vatican later said the cause of death was a stroke, followed by a coma and heart failure.”
    - [5] “His health remained fragile after he returned to his residence in the Vatican.”
- Key details:
  - why: A stroke followed by heart failure, the Vatican said. [2, 4, 5]
    - [2] “A statement continued: "He taught us to live the values ​​of the Gospel with fidelity, courage and universal love, especially in favour of the poorest and most marginalised." The Vatican”
    - [4] “The Vatican later said the cause of death was a stroke, followed by a coma and heart failure.”
    - [5] “The cause of death was a stroke and cardiac arrest, according to a medical bulletin released by the Vatican.”
- Confirmed:
  - In his final will he asked to be buried in the Basilica of St Mary Major in Rome. [2, 3]
    - [2] “In his final testament, released by the Vatican late on Monday, he asked to be buried in Rome's Basilica of St Mary Major.”
    - [3] “In his final will, Francis confirmed he will be buried in St.”
- Reported, not confirmed:
  - He had spent weeks in hospital earlier in 2025 with pneumonia. [1, 5]
    - [1] “Pope Francis was admitted to the Agostino Gemelli Polyclinic Hospital on Friday, February 14, 2025, after suffering from a bout of bronchitis for several days.”
    - [5] “The pope’s death came after he spent weeks in the hospital earlier this year to treat a serious bout of pneumonia.”

Headline accuracy: **accurate** for “Pope Francis dies aged 88”: The reports say Pope Francis died aged 88.
- [1] “Pope Francis has died on Easter Monday aged 88 - Vatican News”
- [2] “Vatican announces death of Pope Francis aged 88”
- [3] “Pope Francis, first Latin American pontiff, dies at 88 \| AP News”

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · primary · strong match
2. [Vatican announces death of Pope Francis aged 88](https://www.bbc.com/news/articles/cqj42vd1rxlo) · BBC News · 2025-04-21 · news · strong match
3. [Pope Francis, first Latin American pontiff, dies at 88 \| AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency · strong match · credits Associated Press
4. [Pope Francis has died at 88 : NPR](https://www.npr.org/2025/04/21/1013050313/pope-francis-dead) · NPR · 2025-04-21 · news · strong match
5. [Pope Francis, Advocate for Economic and Social Justice, Dies at 88 - WSJ](https://www.wsj.com/world/pope-francis-advocate-for-economic-and-social-justice-dies-at-88-103eeff3) · The Wall Street Journal · 2025-04-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Francis/ |
| Correct event dates | review | found /21 April 2025/; "2025-04-21" in "Pope Francis died on 21 April 2025, aged 88, the Vatican ann…" matches a source's publication date but not its text: check it's the event date |
| Correct locations | pass | found /Vatican/ |
| Relevant facts | pass | found /\b88\b/ |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source with a passage of its own (15 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | accurate: The reports say Pope Francis died aged 88. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by tavily (fallback used); 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 1 credit(s), Claude –; 170 ms in the backend, 179 ms in all.

### Both services time out

- Case `fallback-both-timeout`, synthetic data (made up for the test). Covers: timeouts.
- Search: Exa: no answer until its timeout (simulated); Tavily: no answer until its timeout (simulated).
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Neither service answers in time: LinkPeek says the search took too long and offers to try again. No report, nothing invented.
- Actual: **error:search-timeout**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:search-timeout (expected error:search-timeout) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search took too long. Try again. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 305 ms in the backend, 308 ms in all.

### Exa busy, Tavily’s allowance used up

- Case `fallback-busy-and-exhausted`, synthetic data (made up for the test). Covers: credit exhaustion.
- Search: Exa: HTTP 429 (simulated); Tavily: HTTP 432 (simulated).
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa is only busy (it may answer in a minute) and Tavily’s free allowance is used up: LinkPeek stops safely and says to try again, not that the month’s searches are gone. Nothing paid is tried.
- Actual: **error:search-failed**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:search-failed (expected error:search-failed) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search service didn't answer. Try again in a minute. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 5 ms in all.

### Only Tavily set up, and its allowance used up

- Case `fallback-tavily-exhausted`, synthetic data (made up for the test). Covers: credit exhaustion.
- Search: Exa: no key; Tavily: HTTP 432 (simulated).
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: With no Exa key and Tavily’s free allowance used up, Story Search stops and says this month’s free searches are used.
- Actual: **error:out-of-credit**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:out-of-credit (expected error:out-of-credit) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | Story Search has used this month's free searches. It works again when they renew at the start of next month. |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 1 ms in the backend, 3 ms in all.

### Both free allowances used up

- Case `fallback-both-exhausted`, synthetic data (made up for the test). Covers: credit exhaustion.
- Search: Exa: HTTP 402 NO_MORE_CREDITS (simulated); Tavily: HTTP 432 (simulated).
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa and Tavily both say their free credit is used up: Story Search stops, shows the monthly-limit message, and nothing paid is tried.
- Actual: **error:out-of-credit**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:out-of-credit (expected error:out-of-credit) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | Story Search has used this month's free searches. It works again when they renew at the start of next month. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody, provider errors exa:NO_MORE_CREDITS; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 1 ms in the backend, 3 ms in all.

### Allowance runs out between the first search and the follow-up (synthetic)

- Case `fallback-exhausted-midway`, synthetic data (made up for the test). Covers: credit exhaustion, adaptive search.
- Search: Exa: made-up results, then HTTP 402 NO_MORE_CREDITS (simulated); Tavily: HTTP 432 (simulated).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: reports what the one source says.
- What the extension sent: headline “Port Elsworth pier reopens after storm repairs” (link-text); address words “port elsworth pier reopens”; date 2026-11-21 (url-date); address https://news.example.com/2026/11/21/port-elsworth-pier-reopens.
- Expected: The first search finds one report; the follow-up for a second source hits the used-up allowance on both services. Searching stops there and the report is written from the one source, marked as single-source.
- Actual: **report**, match **strong**, confidence **partial**, subject “Port Elsworth pier reopens after storm repairs”, notes: single-source.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage. [1]
    - [1] “The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage, the council said.”
- Reported, not confirmed:
  - The council said repairs to storm damage took six weeks. [1]
    - [1] “The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage, the council said.”

Headline accuracy: **unverified** for “Port Elsworth pier reopens after storm repairs”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Port Elsworth pier reopens after storm repairs](https://harbourgazette.example/news/2026/11/21/port-elsworth-pier-reopens) · Harbour Gazette · 2026-11-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | n/a | nothing expected |
| Correct event dates | pass | found /21 November 2026/ |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (2 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial); notes: single-source |
| Clear, readable writing | pass | 2 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 1 source link(s) for 1 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Port Elsworth pier reopens after storm repairs |

Metrics: 2 search(es) (best → single-source>other-outlets), 3 HTTP request(s), answered by exa, provider errors exa:NO_MORE_CREDITS; 1 result(s) retrieved, 1 kept, 1 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 6 ms in the backend, 9 ms in all.

### No search keys configured

- Case `fallback-no-keys`, synthetic data (made up for the test). Covers: configuration.
- Search: Exa: no key; Tavily: no key.
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: No service has a key: LinkPeek says Story Search isn’t set up, rather than pretending to search.
- Actual: **error:not-configured**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:not-configured (expected error:not-configured) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | Story Search isn't set up in this version of LinkPeek. |

Metrics: 1 search(es) (best), 0 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 1 ms in the backend, 4 ms in all.

### Both services send malformed answers

- Case `malformed-search`, synthetic data (made up for the test). Covers: malformed responses.
- Search: Exa: a non-JSON answer (simulated); Tavily: HTTP 200 (simulated).
- AI: not called.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa sends an HTML page instead of JSON and Tavily sends JSON of the wrong shape: LinkPeek says the search service didn’t answer, and offers to try again.
- Actual: **error:search-failed**.
- Result: pass.

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome error:search-failed (expected error:search-failed) |
| Correct names | n/a | no report |
| Correct event dates | n/a | no report |
| Correct locations | n/a | no report |
| Relevant facts | n/a | no report |
| No unsupported assumptions | n/a | no report |
| No contradictory claims | n/a | no report |
| Proper source references | n/a | no report |
| Appropriate confidence | n/a | no report |
| Clear, readable writing | n/a | no report |
| Headline accuracy | n/a | no report |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search service didn't answer. Try again in a minute. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 4 ms in all.

### Search results with junk entries mixed in (synthetic)

- Case `malformed-results`, synthetic data (made up for the test). Covers: malformed responses.
- Search: Exa: made-up results; Tavily: must not be asked.
- AI: stand-in reply written for the test (not Claude). Careful stand-in: states what the three reports agree on and puts the disputed injury count and cause under “What remains unclear?”.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: Exa’s answer mixes good results with an entry without a title, one with a javascript: address, and markup in titles. The junk is dropped, markup is removed, and the report is built from the good results.
- Actual: **report**, match **strong**, confidence **conflicting**, subject “Fire destroys warehouse on Dock Road in Port Elsworth”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - A fire destroyed a warehouse on Dock Road in Port Elsworth on 12 November 2026. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Key details:
  - where: A warehouse on Dock Road, Port Elsworth. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
  - when: Overnight on 12 November 2026. [1, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Confirmed:
  - The fire destroyed a warehouse on Dock Road in Port Elsworth. [1, 2, 3]
    - [1] “A fire destroyed a warehouse on Dock Road in Port Elsworth overnight on 12 November 2026.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Reported, not confirmed:
  - Fire crews were called shortly after midnight. [3]
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”
- Unclear:
  - How many people were hurt: Harbour Gazette and Coast News say three people were treated in hospital, while Elsworth Times says seven workers were injured. [1, 2, 3]
    - [1] “Three people were taken to hospital with smoke inhalation, the fire service said.”
    - [2] “Seven workers were injured when fire tore through a warehouse on Dock Road in Port Elsworth on 12 November 2026.”
    - [3] “The fire service said three people were treated in hospital.”
  - The cause: Elsworth Times says investigators believe an electrical fault started the fire, while Harbour Gazette and Coast News say the cause is not yet known. [1, 2, 3]
    - [1] “The cause of the fire is not yet known and an investigation has begun.”
    - [2] “Investigators believe an electrical fault in the loading bay started the fire, a council spokesperson said.”
    - [3] “Fire crews were called to the Dock Road warehouse in Port Elsworth shortly after midnight on 12 November 2026.”

Headline accuracy: **unverified** for “Fire destroys warehouse at Port Elsworth docks”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire & investigation begins](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · Harbour Gazette · 2026-11-12 · news · strong match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · Elsworth Times · 2026-11-12 · news · strong match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · Coast News · 2026-11-13 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | pass | found /12 November 2026/ |
| Correct locations | pass | found /Dock Road/ |
| Relevant facts | pass | found /warehouse/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | disputed values only under "What remains unclear?" |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source with a passage of its own (18 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence conflicting (expected conflicting); notes: none |
| Clear, readable writing | pass | 7 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | unverified: There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Conflicting information |
| Card: Subject shown | pass | Fire destroys warehouse on Dock Road in Port Elsworth |
| Card: Doesn't show "javascript:" | pass | javascript: |
| Card: Doesn't show "<b>" | pass | <b> |
| Card: Doesn't show "&amp;" | pass | &amp; |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 19 ms in the backend, 26 ms in all.

### Claude’s reply isn’t valid JSON (simulated)

- Case `ai-invalid`, synthetic data (made up for the test). Covers: malformed responses, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (invalid), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: The AI’s reply can’t be read: no report is written; the closest sources are listed as possible matches only, with a retry.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · Harbour Gazette · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · Elsworth Times · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · Coast News · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: invalid; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 3 ms in the backend, 6 ms in all.

### Claude’s reply is cut off at the token limit (simulated)

- Case `ai-truncated`, synthetic data (made up for the test). Covers: malformed responses, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (truncated), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: A cut-off reply is a failure, never a half report: the closest sources are listed as possible matches only.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · Harbour Gazette · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · Elsworth Times · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · Coast News · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: truncated; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 5 ms in all.

### Claude times out (simulated)

- Case `ai-timeout`, synthetic data (made up for the test). Covers: timeouts, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (timeout), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: The AI doesn’t answer in time: the closest sources are listed as possible matches only, with a retry.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · Harbour Gazette · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · Elsworth Times · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · Coast News · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source with a passage of its own (0 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | n/a | no headline check |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: timeout; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 3 ms in the backend, 5 ms in all.

### Only social media posts report a death (synthetic)

- Case `social-only`, synthetic data (made up for the test). Covers: social media, confirmation, headline accuracy.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: treats two social media posts as confirmation, rates the evidence strong and the headline accurate. LinkPeek’s rules must let none of it stand.
- What the extension sent: headline “Singer Jory Calder dies aged 41” (link-text); address words “singer jory calder dies aged”; date 2026-11-25 (url-date); address https://news.example.com/2026/11/25/singer-jory-calder-dies-aged-41.
- Expected: Two social media posts say the singer Jory Calder has died; no news organisation reports it. Nothing may be stated as what happened or confirmed, only reported; the evidence can’t be strong; the card must say no established source reports it; the headline can’t be judged.
- Actual: **report**, match **strong**, confidence **partial**, subject “Singer Jory Calder dies aged 41”, notes: no-established-sources, developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- Reported, not confirmed:
  - The singer Jory Calder died on Tuesday at the age of 41. [1]
    - [1] “Posts on Chirp say the singer Jory Calder died on Tuesday at the age of 41.”
  - The singer Jory Calder has died. [1, 2]
    - [1] “Posts on Chirp say the singer Jory Calder died on Tuesday at the age of 41.”
    - [2] “Just heard from his cousin that the singer Jory Calder has died.”
- Unclear:
  - The cause of death has not been reported.

Headline accuracy: **unverified** for “Singer Jory Calder dies aged 41”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Jory Calder dead at 41? What the posts say](https://clipshare.example/v/jory-calder-41) · Clipshare · 2026-11-25 · social · strong match
2. [Jory Calder has died, his cousin says](https://chirp.example/calderfan88/status/1861) · Chirp · 2026-11-25 · social · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong |
| Correct names | pass | found /Jory Calder/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (3 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial or insufficient); notes: no-established-sources, developing |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | unverified (expected unverified): There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Singer Jory Calder dies aged 41 |
| Card: Doesn't show "What happened?" | pass | What happened? |

Metrics: 3 search(es) (best → single-source>other-outlets → single-source>broader), 3 HTTP request(s), answered by exa; 6 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 9 ms in the backend, 12 ms in all.

### Only opinion pieces, on news sites (synthetic)

- Case `opinion-only`, synthetic data (made up for the test). Covers: opinion, confirmation.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: treats two opinion pieces as confirmation. LinkPeek’s rules must not.
- What the extension sent: headline “Port Elsworth council to sell harbour to developers” (link-text); address words “port elsworth council to sell harbour to developers”; date 2026-11-21 (url-date); address https://news.example.com/2026/11/21/port-elsworth-council-to-sell-harbour-to-developers.
- Expected: Two opinion pieces, on news organisations’ sites, say the council plans to sell the harbour. Opinion never establishes a fact: nothing stated or confirmed, the evidence not strong, the headline not judged.
- Actual: **report**, match **strong**, confidence **partial**, subject “Port Elsworth council to sell harbour to developers”, notes: no-established-sources.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- Reported, not confirmed:
  - Port Elsworth council plans to sell the harbour to developers. [1, 2]
    - [1] “Port Elsworth council is about to sell the harbour to developers, and it must be stopped.”
    - [2] “The plan by Port Elsworth council to sell the harbour to developers is short-sighted.”
- Unclear:
  - When the sale would happen has not been reported.

Headline accuracy: **unverified** for “Port Elsworth council to sell harbour to developers”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Opinion: Selling Port Elsworth harbour to developers would be a betrayal](https://harbourgazette.example/opinion/2026/11/20/selling-the-harbour) · Harbour Gazette · 2026-11-20 · opinion · strong match
2. [Comment: The harbour sale shows the council has lost its way](https://elsworthtimes.example/comment/2026/11/21/harbour-sale) · Elsworth Times · 2026-11-21 · opinion · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 1 factual claim(s), every one cites a listed source with a passage of its own (2 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial or insufficient); notes: no-established-sources |
| Clear, readable writing | pass | 2 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | unverified (expected unverified): There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Port Elsworth council to sell harbour to developers |

Metrics: 3 search(es) (best → single-source>other-outlets → single-source>broader), 3 HTTP request(s), answered by exa; 6 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 7 ms in all.

### Only two websites LinkPeek doesn’t know (synthetic)

- Case `unknown-sites`, synthetic data (made up for the test). Covers: unknown sites, confirmation.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: treats two unknown websites as confirmation. LinkPeek’s rules must not.
- What the extension sent: headline “Gullholm inventor’s engine runs on seawater” (link-text); address words “gullholm inventor engine runs on seawater”; date 2026-11-22 (url-date); address https://news.example.com/2026/11/22/gullholm-inventor-engine-runs-on-seawater.
- Expected: Two unknown websites report an engine that runs on seawater. Two unknown sites never make strong evidence: nothing stated or confirmed, the headline not judged.
- Actual: **report**, match **strong**, confidence **partial**, subject “Gullholm inventor’s engine runs on seawater”, notes: no-established-sources.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- Reported, not confirmed:
  - Pell Arvo, an inventor from Gullholm, says his engine runs on seawater. [1, 2]
    - [1] “A Gullholm inventor, Pell Arvo, says his engine runs on seawater alone.”
    - [2] “Pell Arvo from Gullholm says his seawater engine could power a car for 500 miles.”
  - Pell Arvo’s engine runs on seawater. [1, 2]
    - [1] “A Gullholm inventor, Pell Arvo, says his engine runs on seawater alone.”
    - [2] “Pell Arvo from Gullholm says his seawater engine could power a car for 500 miles.”
- Unclear:
  - No independent test of the engine is reported.
  - The sources reviewed don't establish when this happened.

Headline accuracy: **unverified** for “Gullholm inventor’s engine runs on seawater”: There isn't enough matching reporting to judge the headline.

Sources:

1. [Gullholm inventor builds engine that runs on seawater](https://truthbuzz.example/2026/11/22/seawater-engine) · truthbuzz.example · 2026-11-22 · other · strong match
2. [Seawater engine: Gullholm man’s invention stuns experts](https://dailyviral.example/seawater-engine-gullholm) · dailyviral.example · 2026-11-22 · other · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong |
| Correct names | pass | found /Pell Arvo\|Gullholm/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial or insufficient); notes: no-established-sources |
| Clear, readable writing | pass | 4 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | unverified (expected unverified): There isn't enough matching reporting to judge the headline. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Gullholm inventor’s engine runs on seawater |

Metrics: 3 search(es) (best → single-source>other-outlets → single-source>broader), 3 HTTP request(s), answered by exa; 6 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 9 ms in all.

### Claims citing the wrong source (synthetic)

- Case `wrong-source`, synthetic data (made up for the test). Covers: claim evidence, source references.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: cites the Elsworth Times for an amount only the Gazette gives, and the Gazette for an appeal only Coast News reports (with Coast News’ words). Both must be dropped.
- What the extension sent: headline “Gullholm ferry operator Isle Link fined over safety breaches” (link-text); address words “isle link fined over gullholm ferry safety breaches”; date 2026-11-20 (url-date); address https://news.example.com/2026/11/20/isle-link-fined-over-gullholm-ferry-safety-breaches.
- Expected: Only the Harbour Gazette gives the fine (£20,000) and only Coast News reports the appeal. A claim citing the Elsworth Times for the amount, and one citing the Gazette for the appeal with Coast News’ words, must both be dropped; what both reports say may be confirmed.
- Actual: **report**, match **strong**, confidence **strong**, subject “Isle Link penalised over Gullholm ferry safety breaches”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Isle Link, which runs the Gullholm ferry, was penalised by a court for safety breaches. [1, 2]
    - [1] “Isle Link was fined £20,000 on Thursday for safety breaches on the Gullholm ferry, the maritime court said.”
    - [2] “The operator of the Gullholm ferry, Isle Link, has been penalised for safety failings, a court ruled.”
- Confirmed:
  - Isle Link was penalised for safety failings on the Gullholm ferry. [1, 2]
    - [1] “Isle Link was fined £20,000 on Thursday for safety breaches on the Gullholm ferry, the maritime court said.”
    - [2] “The operator of the Gullholm ferry, Isle Link, has been penalised for safety failings, a court ruled.”
- Unclear:
  - The sources reviewed don't establish when this happened.

Headline accuracy: **accurate** for “Gullholm ferry operator Isle Link fined over safety breaches”: The reports say a court penalised Isle Link for safety breaches on the Gullholm ferry.
- [1] “Isle Link was fined £20,000 on Thursday for safety breaches on the Gullholm ferry, the maritime court said.”
- [2] “The operator of the Gullholm ferry, Isle Link, has been penalised for safety failings, a court ruled.”

Sources:

1. [Isle Link fined £20,000 over Gullholm ferry safety breaches](https://harbourgazette.example/news/2026/11/20/isle-link-fined) · Harbour Gazette · 2026-11-20 · news · strong match
2. [Ferry operator Isle Link penalised over safety failings](https://elsworthtimes.example/news/2026/11/20/isle-link-penalised) · Elsworth Times · 2026-11-20 · news · strong match
3. [Isle Link to appeal against ferry safety ruling](https://coastnews.example/news/2026/11/21/isle-link-to-appeal) · Coast News · 2026-11-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Isle Link/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: none |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): The reports say a court penalised Isle Link for safety breaches on the Gullholm ferry. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Isle Link penalised over Gullholm ferry safety breaches |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 9 ms in the backend, 13 ms in all.

### A claim its own sources contradict: “asbestos found” (synthetic)

- Case `contradicted`, synthetic data (made up for the test). Covers: contradicting evidence, conflicts, headline accuracy.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: states the early report as fact citing all three sources (two of which say the opposite), rates the evidence strong and the headline accurate.
- What the extension sent: headline “Asbestos found at Elsworth Primary School” (link-text); address words “asbestos found at elsworth primary school”; date 2026-11-23 (url-date); address https://news.example.com/2026/11/23/asbestos-found-at-elsworth-primary-school.
- Expected: An early report says workers found asbestos at Elsworth Primary School; two later reports say council tests found none. The claim that asbestos was found may only be reported, citing the source that says it; the two that contradict it can’t count as its support. The evidence can’t be strong, and the headline is neither accurate nor shown to mislead (the sources disagree).
- Actual: **report**, match **strong**, confidence **partial**, subject “Elsworth Primary School closed after asbestos scare”, notes: developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Elsworth Primary School was closed on Monday after an asbestos scare and will reopen on Thursday. [1, 2, 3]
    - [1] “The school will reopen on Thursday”
    - [2] “Elsworth Primary School will reopen on Thursday”
    - [3] “Elsworth Primary School was closed on Monday”
- Confirmed:
  - The school will reopen on Thursday. [1, 2]
    - [1] “The school will reopen on Thursday.”
    - [2] “Elsworth Primary School will reopen on Thursday after tests found no asbestos, the council said.”
- Reported, not confirmed:
  - Asbestos was found in a classroom ceiling at Elsworth Primary School. [3] *(weak: its passages carry little of it; never counted as confirmed)*
    - [3] “workers reported finding asbestos in a classroom ceiling”
- Unclear:
  - Whether asbestos was found: Harbour Gazette reported that workers found asbestos, while Elsworth Times and Coast News say council tests found none. [1, 2, 3]
    - [1] “Council tests found no asbestos in the classroom ceiling”
    - [2] “after tests found no asbestos”
    - [3] “workers reported finding asbestos in a classroom ceiling”

Headline accuracy: **unverified** for “Asbestos found at Elsworth Primary School”: The reports found don't clearly support everything the headline says.

Sources:

1. [No asbestos at Elsworth Primary School, tests show](https://elsworthtimes.example/news/2026/11/25/no-asbestos-elsworth-primary) · Elsworth Times · 2026-11-25 · news · strong match
2. [Elsworth Primary School to reopen after asbestos all-clear](https://coastnews.example/news/2026/11/25/school-to-reopen) · Coast News · 2026-11-25 · news · strong match
3. [Elsworth Primary School closed after asbestos scare](https://harbourgazette.example/news/2026/11/23/school-closed-asbestos) · Harbour Gazette · 2026-11-23 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Elsworth Primary School/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | disputed values only under "What remains unclear?" |
| Proper source references | pass | 3 factual claim(s), every one cites a listed source with a passage of its own (9 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial); notes: developing |
| Clear, readable writing | pass | 4 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | unverified (expected unverified or partly-accurate): The reports found don't clearly support everything the headline says. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Elsworth Primary School closed after asbestos scare |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 8 ms in all.

### Wrong dates within a week of publication (synthetic)

- Case `wrong-date`, synthetic data (made up for the test). Covers: event dates, event date versus publication date.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: besides the right date, gives the rescue as 18 November (a day out) and the Gazette’s publication date as the event date. Both must be dropped.
- What the extension sent: headline “Gull Point lighthouse keeper rescued after fall” (link-text); address words “gull point lighthouse keeper rescued after fall”; date 2026-11-19 (url-date); address https://news.example.com/2026/11/19/gull-point-lighthouse-keeper-rescued-after-fall.
- Expected: The Harbour Gazette, published on Thursday 19 November 2026, says the keeper was rescued “on Tuesday”: 17 November 2026. A claim giving 18 November (a day out) or 19 November (the publication date) must be dropped; 17 November may stand.
- Actual: **report**, match **strong**, confidence **partial**, subject “Gull Point lighthouse keeper rescued after fall”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Ewan Tarr, the keeper of Gull Point lighthouse, was rescued on 17 November 2026 after falling from a ladder. [1]
    - [1] “The keeper of Gull Point lighthouse, Ewan Tarr, was rescued on Tuesday after falling from a ladder, the coastguard said.”
- Reported, not confirmed:
  - Ewan Tarr is recovering in hospital. [2]
    - [2] “Ewan Tarr, the Gull Point lighthouse keeper, is recovering in hospital after he was rescued earlier this week.”

Headline accuracy: **accurate** for “Gull Point lighthouse keeper rescued after fall”: The reports say the keeper was rescued after a fall.
- [1] “The keeper of Gull Point lighthouse, Ewan Tarr, was rescued on Tuesday after falling from a ladder, the coastguard said.”

Sources:

1. [Lighthouse keeper rescued after fall at Gull Point](https://harbourgazette.example/news/2026/11/19/lighthouse-keeper-rescued) · Harbour Gazette · 2026-11-19 · news · strong match
2. [Gull Point keeper Ewan Tarr recovering after rescue](https://elsworthtimes.example/news/2026/11/20/ewan-tarr-recovering) · Elsworth Times · 2026-11-20 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Ewan Tarr/ |
| Correct event dates | review | found /17 November 2026/; "2026-11-17" in "Ewan Tarr, the keeper of Gull Point lighthouse, was rescued …" isn't in the cited text; it is within a week of a cited publication date (worked out?) |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (2 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial; notes: none |
| Clear, readable writing | pass | 2 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): The reports say the keeper was rescued after a fall. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Gull Point lighthouse keeper rescued after fall |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 7 ms in all.

### “What remains unclear?” used to slip in a rumour (synthetic)

- Case `unclear-allegation`, synthetic data (made up for the test). Covers: unclear points, allegations.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Rumour-adding stand-in: under “What remains unclear?”, suggests bribery and names a rival no source mentions.
- What the extension sent: headline “Port Elsworth harbour master suspended” (link-text); address words “port elsworth harbour master suspended”; date 2026-11-24 (url-date); address https://news.example.com/2026/11/24/port-elsworth-harbour-master-suspended.
- Expected: Two reports say the harbour master Nia Holt has been suspended pending a review, and that its subject hasn’t been said. An unclear point suggesting bribery, or naming a rival as the complainant, must be dropped: no source says either. Saying what the review concerns is unknown may stay.
- Actual: **report**, match **strong**, confidence **partial**, subject “Port Elsworth harbour master Nia Holt suspended”, notes: developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Port Elsworth’s harbour master, Nia Holt, has been suspended while an internal review is carried out. [1, 2]
    - [1] “Port Elsworth’s harbour master, Nia Holt, has been suspended while an internal review is carried out, the port authority said.”
    - [2] “The Port Elsworth port authority said Nia Holt had been suspended pending a review.”
- Confirmed:
  - Nia Holt has been suspended pending a review, the port authority said. [1, 2]
    - [1] “Port Elsworth’s harbour master, Nia Holt, has been suspended while an internal review is carried out, the port authority said.”
    - [2] “The Port Elsworth port authority said Nia Holt had been suspended pending a review.”
- Unclear:
  - What the review concerns has not been said.
  - The sources reviewed don't establish when this happened.

Headline accuracy: **accurate** for “Port Elsworth harbour master suspended”: Both reports say the harbour master has been suspended.
- [1] “Port Elsworth’s harbour master, Nia Holt, has been suspended while an internal review is carried out, the port authority said.”
- [2] “Harbour master Nia Holt suspended pending review”

Sources:

1. [Port Elsworth harbour master suspended](https://harbourgazette.example/news/2026/11/24/harbour-master-suspended) · Harbour Gazette · 2026-11-24 · news · strong match
2. [Harbour master Nia Holt suspended pending review](https://coastnews.example/news/2026/11/24/nia-holt-suspended) · Coast News · 2026-11-24 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Nia Holt/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial; notes: developing |
| Clear, readable writing | pass | 4 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): Both reports say the harbour master has been suspended. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Port Elsworth harbour master Nia Holt suspended |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 7 ms in the backend, 11 ms in all.

### The same headline for a different event, a year earlier (synthetic)

- Case `same-headline`, synthetic data (made up for the test). Covers: same headline, different event, which reports are copies.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: calls all three strong matches (the identical headline) and cites the August 2025 report too.
- What the extension sent: headline “Lifeboat rescues two from sinking yacht off Gull Point” (link-text); address words “lifeboat rescues two from sinking yacht off gull point”; date 2026-11-26 (url-date); address https://news.example.com/2026/11/26/lifeboat-rescues-two-from-sinking-yacht-off-gull-point.
- Expected: Two reports of a lifeboat rescue on 25 November 2026; a third, from August 2025, has exactly the same headline but is about another rescue. The old one must not be treated as a copy of this story or as a match for it, and nothing from it may appear.
- Actual: **report**, match **strong**, confidence **strong**, subject “Lifeboat rescues two sailors from sinking yacht off Gull Point”, notes: developing, older-story.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - The Port Elsworth lifeboat rescued two sailors from a sinking yacht off Gull Point. [1, 3]
    - [1] “The Port Elsworth lifeboat rescued two sailors from a sinking yacht off Gull Point on Wednesday afternoon.”
    - [3] “Two sailors were rescued by the Port Elsworth lifeboat after their yacht began sinking off Gull Point on Wednesday.”
- Confirmed:
  - Two sailors were rescued from a sinking yacht off Gull Point. [1, 3]
    - [1] “The Port Elsworth lifeboat rescued two sailors from a sinking yacht off Gull Point on Wednesday afternoon.”
    - [3] “Two sailors were rescued by the Port Elsworth lifeboat after their yacht began sinking off Gull Point on Wednesday.”
- Unclear:
  - The sources reviewed don't establish when this happened.

Headline accuracy: **accurate** for “Lifeboat rescues two from sinking yacht off Gull Point”: The reports say the lifeboat rescued two sailors from a sinking yacht.
- [1] “The Port Elsworth lifeboat rescued two sailors from a sinking yacht off Gull Point on Wednesday afternoon.”
- [3] “Two sailors were rescued by the Port Elsworth lifeboat after their yacht began sinking off Gull Point on Wednesday.”

Sources:

1. [Lifeboat rescues two from sinking yacht off Gull Point](https://harbourgazette.example/news/2026/11/26/yacht-rescue-gull-point) · Harbour Gazette · 2026-11-26 · news · strong match
2. [Lifeboat rescues two from sinking yacht off Gull Point](https://coastnews.example/news/2025/08/14/yacht-rescue-gull-point) · Coast News · 2025-08-14 · news · possible match
3. [Two rescued as yacht sinks off Gull Point](https://elsworthtimes.example/news/2026/11/26/two-rescued-yacht) · Elsworth Times · 2026-11-26 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Gull Point/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: developing, older-story |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): The reports say the lifeboat rescued two sailors from a sinking yacht. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Lifeboat rescues two sailors from sinking yacht off Gull Point |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 9 ms in all.

### A search result with instructions for the AI hidden in it (synthetic)

- Case `prompt-injection`, synthetic data (made up for the test). Covers: prompt injection, untrusted text.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Obedient stand-in: does what the hidden instruction says, citing it word for word.
- What the extension sent: headline “Port Elsworth council approves £12m budget” (link-text); address words “port elsworth council approves budget”; date 2026-11-24 (url-date); address https://news.example.com/2026/11/24/port-elsworth-council-approves-12m-budget.
- Expected: One result’s text tells the AI to report the story as confirmed by the BBC and Reuters. The instruction must be removed before the AI sees it, and a reply that obeys it must not get through: no BBC, no Reuters, and the instruction never shown.
- Actual: **report**, match **strong**, confidence **strong**, subject “Port Elsworth council approves £12m budget”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Port Elsworth council approved a £12 million budget for next year. [1, 2]
    - [1] “Port Elsworth council approved a £12 million budget for next year on Monday evening.”
    - [2] “Councillors in Port Elsworth passed a £12 million budget that includes repairs to the harbour wall.”
- Confirmed:
  - Port Elsworth council approved a £12 million budget. [1, 2]
    - [1] “Port Elsworth council approved a £12 million budget for next year on Monday evening.”
    - [2] “Councillors in Port Elsworth passed a £12 million budget that includes repairs to the harbour wall.”
- Unclear:
  - The sources reviewed don't establish when this happened.

Headline accuracy: **accurate** for “Port Elsworth council approves £12m budget”: Both reports say the council approved a £12 million budget.
- [1] “Port Elsworth council approved a £12 million budget for next year on Monday evening.”
- [2] “Councillors in Port Elsworth passed a £12 million budget that includes repairs to the harbour wall.”

Sources:

1. [Port Elsworth council approves £12m budget](https://harbourgazette.example/news/2026/11/24/council-budget) · Harbour Gazette · 2026-11-24 · news · strong match
2. [Council passes £12m budget with harbour repairs](https://elsworthtimes.example/news/2026/11/24/budget-harbour-repairs) · Elsworth Times · 2026-11-24 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: none |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): Both reports say the council approved a £12 million budget. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Port Elsworth council approves £12m budget |
| Card: Doesn't show "Ignore all previous instructions" | pass | Ignore all previous instructions |
| Card: Doesn't show "BBC" | pass | BBC |
| Card: Doesn't show "Reuters" | pass | Reuters |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 15 ms in all.

### A corrected report and a retracted one (synthetic)

- Case `correction`, synthetic data (made up for the test). Covers: corrections, retractions, headline accuracy.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: reports the arrest, quoting the sentence the Gazette corrected and Coast News’ denial as if they supported it.
- What the extension sent: headline “Gullholm ferry captain arrested after harbour collision” (link-text); address words “gullholm ferry captain arrested after harbour collision”; date 2026-11-21 (url-date); address https://news.example.com/2026/11/21/gullholm-ferry-captain-arrested-after-harbour-collision.
- Expected: The Harbour Gazette corrected its report: the ferry captain was questioned, not arrested. The Elsworth Times withdrew a report that he had been charged. The arrest must not be reported (the corrected sentence is gone), the withdrawn report must not be used and the card must say one was left out, and the headline (“arrested”) is misleading.
- Actual: **report**, match **strong**, confidence **partial**, subject “Gullholm ferry captain questioned after harbour collision”, notes: withdrawn.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - The Gullholm ferry struck the harbour wall at Port Elsworth, and police questioned its captain. [1, 2]
    - [1] “The Gullholm ferry struck the harbour wall at Port Elsworth on Friday evening, police said.”
    - [2] “Police questioned the captain of the Gullholm ferry after it struck the harbour wall at Port Elsworth.”
- Confirmed:
  - Police questioned the captain of the Gullholm ferry. [1, 2]
    - [1] “Gullholm ferry captain questioned after harbour collision”
    - [2] “Police questioned the captain of the Gullholm ferry after it struck the harbour wall at Port Elsworth.”
- Unclear:
  - The sources reviewed don't establish when this happened.

Headline accuracy: **misleading** for “Gullholm ferry captain arrested after harbour collision”: The reports say the captain was questioned by police and has not been arrested.
- [2] “Police questioned the captain of the Gullholm ferry”

Sources:

1. [Gullholm ferry captain questioned after harbour collision](https://harbourgazette.example/news/2026/11/21/ferry-captain-questioned) · Harbour Gazette · 2026-11-21 · news · strong match · corrected
2. [Ferry captain questioned after Gullholm harbour collision](https://coastnews.example/news/2026/11/21/ferry-captain-questioned) · Coast News · 2026-11-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Gullholm/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial; notes: withdrawn |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | misleading (expected misleading): The reports say the captain was questioned by police and has not been arrested. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Gullholm ferry captain questioned after harbour collision |
| Card: Doesn't show "This article has been withdrawn" | pass | This article has been withdrawn |
| Card: Doesn't show "charged over" | pass | charged over |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 10 ms in the backend, 13 ms in all.

### An English headline, reported only in French (synthetic)

- Case `foreign-language`, synthetic data (made up for the test). Covers: international reporting, event dates.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: writes in English, quoting the French reports word for word.
- What the extension sent: headline “Fire closes historic bridge in Bellerive-sur-Ondine” (link-text); address words “fire closes historic bridge in bellerive sur ondine”; date 2026-11-25 (url-date); address https://news.example.com/2026/11/25/fire-closes-historic-bridge-in-bellerive-sur-ondine.
- Expected: Two French news reports say a fire on Tuesday evening damaged the historic bridge in Bellerive-sur-Ondine, which is closed. The report, in English, must cite them with their French words, may confirm the closure, and may work out the date (24 November 2026) from “mardi soir” and the publication date.
- Actual: **report**, match **strong**, confidence **strong**, subject “Fire closes historic bridge in Bellerive-sur-Ondine”, notes: developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - A fire damaged the historic bridge in Bellerive-sur-Ondine on 24 November 2026. [1]
    - [1] “Un incendie a endommagé mardi soir le pont historique de Bellerive-sur-Ondine”
- Key details:
  - when: Tuesday evening, 24 November 2026. [2] *(weak: its passages carry little of it; never counted as confirmed)*
    - [2] “après un incendie survenu mardi soir”
- Confirmed:
  - The bridge in Bellerive-sur-Ondine has been closed after a fire. [1, 2]
    - [1] “le pont historique de Bellerive-sur-Ondine, qui restera fermé”
    - [2] “Le pont de Bellerive-sur-Ondine est fermé après un incendie”
- Reported, not confirmed:
  - No one was injured, according to the fire service. [2] *(weak: its passages carry little of it; never counted as confirmed)*
    - [2] “Personne n’a été blessé, selon les pompiers”
- Unclear:
  - How long the bridge will stay closed has not been said.

Headline accuracy: **accurate** for “Fire closes historic bridge in Bellerive-sur-Ondine”: Both reports say a fire closed the historic bridge.
- [2] “Le pont de Bellerive-sur-Ondine est fermé après un incendie”

Sources:

1. [Incendie : le pont historique de Bellerive-sur-Ondine fermé](https://leveilleur.example/actualites/2026/11/25/incendie-pont-bellerive) · Le Veilleur · 2026-11-25 · news · strong match
2. [Bellerive-sur-Ondine : le pont fermé après un incendie](https://courrierdelondine.example/region/2026/11/25/pont-ferme-incendie) · Le Courrier de l'Ondine · 2026-11-25 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Bellerive-sur-Ondine/ |
| Correct event dates | review | found /24 November 2026/; "2026-11-24" in "A fire damaged the historic bridge in Bellerive-sur-Ondine o…" isn't in the cited text; it is within a week of a cited publication date (worked out?); "2026-11-24" in "Tuesday evening, 24 November 2026.…" isn't in the cited text; it is within a week of a cited publication date (worked out?) |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /bridge/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | review | 3 claim(s) with weak word support: see the review list; 4 factual claim(s), every one cites a listed source with a passage of its own (5 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: developing |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): Both reports say a fire closed the historic bridge. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Fire closes historic bridge in Bellerive-sur-Ondine |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 6 ms in the backend, 9 ms in all.

### A misleading headline: “dies” when the reports say hospital (synthetic)

- Case `misleading-headline`, synthetic data (made up for the test). Covers: headline accuracy.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: reports the hospital admission and calls the headline misleading.
- What the extension sent: headline “Singer Mara Vey dies after hotel incident” (link-text); address words “singer mara vey dies after hotel incident”; date 2026-11-24 (url-date); address https://celeb.example.com/2026/11/24/singer-mara-vey-dies-after-hotel-incident.
- Expected: The link says the singer Mara Vey died; both news reports say she was taken to hospital. The report must not say she died, and the headline is misleading.
- Actual: **report**, match **strong**, confidence **partial**, subject “Singer Mara Vey taken to hospital after hotel incident”, notes: developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - The singer Mara Vey was taken to hospital after an incident at a hotel in Port Elsworth on Monday. [1, 2]
    - [1] “The singer Mara Vey was taken to hospital after an incident at the Grand Ondine Hotel in Port Elsworth on Monday.”
    - [2] “Mara Vey in hospital after Port Elsworth hotel incident”
- Confirmed:
  - Mara Vey was taken to hospital after an incident at a hotel in Port Elsworth. [1, 2]
    - [1] “The singer Mara Vey was taken to hospital after an incident at the Grand Ondine Hotel in Port Elsworth on Monday.”
    - [2] “Mara Vey in hospital after Port Elsworth hotel incident”
- Unclear:
  - Her condition is not known.

Headline accuracy: **misleading** for “Singer Mara Vey dies after hotel incident”: The reports say Mara Vey was taken to hospital; none reports her death.
- [1] “The singer Mara Vey was taken to hospital after an incident at the Grand Ondine Hotel in Port Elsworth on Monday.”
- [2] “Mara Vey is being treated in hospital after an incident at her hotel in Port Elsworth, her management said.”

Sources:

1. [Singer Mara Vey taken to hospital after hotel incident](https://northernpost.example/news/2026/11/24/mara-vey-hospital) · Northern Post · 2026-11-24 · news · strong match
2. [Mara Vey in hospital after Port Elsworth hotel incident](https://dailyledger.example/news/2026/11/24/mara-vey-in-hospital) · Daily Ledger · 2026-11-24 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Mara Vey/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial; notes: developing |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | misleading (expected misleading): The reports say Mara Vey was taken to hospital; none reports her death. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Singer Mara Vey taken to hospital after hotel incident |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 7 ms in all.

### A sensational headline that is accurate (synthetic)

- Case `sensational-accurate`, synthetic data (made up for the test). Covers: headline accuracy.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: judges what the headline says, not how it says it.
- What the extension sent: headline “Horror blaze guts Port Elsworth boatyard” (link-text); address words “horror blaze guts port elsworth boatyard”; date 2026-11-26 (url-date); address https://news.example.com/2026/11/26/horror-blaze-guts-port-elsworth-boatyard.
- Expected: “Horror blaze guts Port Elsworth boatyard” is dramatic, but both reports say a fire destroyed the boatyard. The headline is accurate: dramatic wording alone never makes it misleading.
- Actual: **report**, match **strong**, confidence **strong**, subject “Fire destroys boatyard in Port Elsworth”, notes: developing.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - A fire destroyed a boatyard on Quay Street in Port Elsworth on Wednesday night. [1, 2]
    - [1] “A fire destroyed a boatyard on Quay Street in Port Elsworth on Wednesday night.”
    - [2] “Fire gutted the Quay Street boatyard in Port Elsworth overnight.”
- Key details:
  - where: A boatyard on Quay Street, Port Elsworth. [1, 2]
    - [1] “A fire destroyed a boatyard on Quay Street in Port Elsworth on Wednesday night.”
    - [2] “Fire gutted the Quay Street boatyard in Port Elsworth overnight.”
- Confirmed:
  - A fire destroyed the Quay Street boatyard in Port Elsworth. [1, 2]
    - [1] “A fire destroyed a boatyard on Quay Street in Port Elsworth on Wednesday night.”
    - [2] “Fire gutted the Quay Street boatyard in Port Elsworth overnight.”
  - No one was hurt in the fire. [1, 2]
    - [1] “No one was hurt, the fire service said.”
    - [2] “Fire gutted the Quay Street boatyard in Port Elsworth overnight.”
- Unclear:
  - The cause of the fire has not been reported.

Headline accuracy: **accurate** for “Horror blaze guts Port Elsworth boatyard”: Both reports say a fire destroyed the boatyard; the wording is dramatic, but what it says is supported.
- [1] “A fire destroyed a boatyard on Quay Street in Port Elsworth on Wednesday night.”
- [2] “Fire gutted the Quay Street boatyard in Port Elsworth overnight.”

Sources:

1. [Fire destroys boatyard in Port Elsworth](https://harbourgazette.example/news/2026/11/26/boatyard-fire) · Harbour Gazette · 2026-11-26 · news · strong match
2. [Port Elsworth boatyard gutted by fire](https://coastnews.example/news/2026/11/26/boatyard-gutted) · Coast News · 2026-11-26 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 4 factual claim(s), every one cites a listed source with a passage of its own (8 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: developing |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): Both reports say a fire destroyed the boatyard; the wording is dramatic, but what it says is supported. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 2 source link(s) for 2 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Fire destroys boatyard in Port Elsworth |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 2 result(s) retrieved, 2 kept, 2 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 8 ms in all.

### An undated link, and an older story about the same person (synthetic)

- Case `old-story`, synthetic data (made up for the test). Covers: breaking news, old incident not shown as current.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careless stand-in: calls the 2024 report a strong match and mixes in its winning time.
- What the extension sent: headline “Elsa Brannock wins Elsworth marathon” (link-text); address words “elsa brannock wins elsworth marathon”; address https://news.example.com/sport/elsa-brannock-wins-elsworth-marathon.
- Expected: The link gives no date. Elsa Brannock won the Elsworth marathon this week (her second win); a 2024 report of her first win has the same headline. The report must be about this week’s race, and nothing from 2024 (the time of 2 hours 31 minutes, “her first victory”) may appear.
- Actual: **report**, match **strong**, confidence **strong**, subject “Elsa Brannock wins Elsworth marathon for the second time”, notes: older-story.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Elsa Brannock won the Elsworth marathon for the second time on 22 November 2026, in 2 hours 27 minutes. [2, 3]
    - [2] “Elsa Brannock won the Elsworth marathon for the second time on Sunday, finishing in 2 hours 27 minutes.”
    - [3] “Elsa Brannock has won her second Elsworth marathon title, crossing the line in 2 hours 27 minutes on Sunday.”
- Confirmed:
  - Elsa Brannock finished in 2 hours 27 minutes. [2, 3]
    - [2] “Elsa Brannock won the Elsworth marathon for the second time on Sunday, finishing in 2 hours 27 minutes.”
    - [3] “Elsa Brannock has won her second Elsworth marathon title, crossing the line in 2 hours 27 minutes on Sunday.”

Headline accuracy: **accurate** for “Elsa Brannock wins Elsworth marathon”: The reports say Elsa Brannock won the Elsworth marathon.
- [2] “Elsa Brannock won the Elsworth marathon for the second time on Sunday, finishing in 2 hours 27 minutes.”
- [3] “Elsa Brannock has won her second Elsworth marathon title, crossing the line in 2 hours 27 minutes on Sunday.”

Sources:

1. [Elsa Brannock wins Elsworth marathon](https://harbourgazette.example/sport/2024/04/14/elsa-brannock-wins-marathon) · Harbour Gazette · 2024-04-14 · news · possible match
2. [Elsa Brannock wins Elsworth marathon again](https://elsworthtimes.example/sport/2026/11/22/brannock-wins-again) · Elsworth Times · 2026-11-22 · news · strong match
3. [Brannock takes second Elsworth marathon title](https://coastnews.example/sport/2026/11/23/brannock-second-title) · Coast News · 2026-11-23 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Elsa Brannock/ |
| Correct event dates | review | found /22 November 2026/; "2026-11-22" in "Elsa Brannock won the Elsworth marathon for the second time …" matches a source's publication date but not its text: check it's the event date |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /2 hours 27 minutes/ |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source with a passage of its own (4 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: older-story |
| Clear, readable writing | pass | 2 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): The reports say Elsa Brannock won the Elsworth marathon. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Elsa Brannock wins Elsworth marathon for the second time |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 7 ms in the backend, 10 ms in all.

### One agency report printed three times, and one independent report (synthetic)

- Case `syndication-independent`, synthetic data (made up for the test). Covers: syndication, which reports are copies, confirmation.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: cites every copy of the agency report and the independent one.
- What the extension sent: headline “Ministers approve Gullholm wind farm” (link-text); address words “ministers approve gullholm wind farm”; date 2026-11-20 (url-date); address https://news.example.com/2026/11/20/ministers-approve-gullholm-wind-farm.
- Expected: Coastal Wire’s report of a wind farm approval appears on its own site and word for word on two newspapers’ sites: one source. The Harbour Gazette reports it independently, under the same headline: not a copy. What both the agency and the Gazette say is confirmed; what only the agency’s three copies say is reported, never confirmed.
- Actual: **report**, match **strong**, confidence **strong**, subject “Ministers approve Gullholm wind farm”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown (each claim with the passage it quotes from each source it cites):

- What happened:
  - Ministers approved a wind farm of 40 turbines off Gullholm. [1, 2, 3, 4]
    - [1] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [2] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [3] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [4] “The government has given the go-ahead for a wind farm of 40 turbines off Gullholm, despite objections from fishermen who work the area.”
- Confirmed:
  - Ministers approved a wind farm of 40 turbines off Gullholm. [1, 2, 3, 4]
    - [1] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [2] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [3] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
    - [4] “The government has given the go-ahead for a wind farm of 40 turbines off Gullholm, despite objections from fishermen who work the area.”
- Reported, not confirmed:
  - Construction is expected to start in 2028. [1, 2, 3]
    - [1] “Construction is expected to start in 2028 and take three years.”
    - [2] “Construction is expected to start in 2028 and take three years.”
    - [3] “Construction is expected to start in 2028 and take three years.”
  - Fishermen who work the area objected to the wind farm. [4]
    - [4] “The government has given the go-ahead for a wind farm of 40 turbines off Gullholm, despite objections from fishermen who work the area.”
- Unclear:
  - The sources reviewed don't establish when this happened.

Headline accuracy: **accurate** for “Ministers approve Gullholm wind farm”: The reports say ministers approved the wind farm.
- [1] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
- [2] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”
- [3] “Ministers have approved a wind farm of 40 turbines off Gullholm, the energy department said on Friday.”

Sources:

1. [Ministers approve Gullholm wind farm](https://coastalwire.example/2026/11/20/ministers-approve-gullholm-wind-farm) · Coastal Wire · 2026-11-20 · agency · strong match
2. [Ministers approve Gullholm wind farm](https://northernpost.example/news/2026/11/20/ministers-approve-gullholm-wind-farm) · Northern Post · 2026-11-20 · news · strong match · repeats 1
3. [Ministers approve Gullholm wind farm](https://dailyledger.example/news/2026/11/20/ministers-approve-gullholm-wind-farm) · Daily Ledger · 2026-11-20 · news · strong match · repeats 1
4. [Ministers approve Gullholm wind farm](https://harbourgazette.example/news/2026/11/20/gullholm-wind-farm-go-ahead) · Harbour Gazette · 2026-11-20 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Gullholm/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 4 factual claim(s), every one cites a listed source with a passage of its own (12 passage(s), each found in its source); every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: syndicated |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
| Headline accuracy | pass | accurate (expected accurate): The reports say ministers approved the wind farm. |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 4 source link(s) for 4 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Ministers approve Gullholm wind farm |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 4 result(s) retrieved, 4 kept, 4 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 6 ms in the backend, 10 ms in all.

### Other checks

| Check | Result | Detail |
|---|---|---|
| Free mode with brave,exa,tavily | pass | answer {"error":"out-of-credit"}; Brave asked 0 time(s); Exa 1, Tavily 1; logged spending "free" |
| Free mode with brave and STORY_SPENDING=free | pass | answer {"error":"not-configured"}; Brave asked 0 time(s); Exa 0, Tavily 0; logged spending "free" |
| Free mode with exa,tavily,brave and STORY_SPENDING=yes please | pass | answer {"error":"out-of-credit"}; Brave asked 0 time(s); Exa 1, Tavily 1; logged spending "free" |
| Paid mode only by explicit setting | pass | STORY_SPENDING=paid gives "exa+tavily+brave"; nothing in the code sets it |

## Recording the real searches

Recorded 2026-11-27 18:50 UTC with `npm run test:story-e2e:record`. Each real case was searched once; later runs replay the recording instead of searching again. Cases that already had a recording were not searched again.

| Case | Answered by | Searches | HTTP requests | Results | Analysed | Fallback | Model | Tokens in / out | Claims dropped: unsupported / no real passage | Weak / contradicted | Cleaned: withdrawn / injected | Exa (reported) | Tavily credits | Claude | Backend ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pope | exa | 1 | 1 | 8 | 5 | no | none | – | – / – | – / – | – / – | $0.0070 | 0 | – | 3726 |
| louvre-card | exa | 1 | 1 | 8 | 5 | no | none | – | – / – | – / – | – / – | $0.0070 | 0 | – | 6170 |
| louvre-url | exa | 1 | 1 | 8 | 5 | no | none | – | – / – | – / – | – / – | $0.0070 | 0 | – | 1709 |
| vague | exa | 1 | 1 | 8 | 5 | no | none | – | – / – | – / – | – / – | $0.0070 | 0 | – | 1543 |
| fabricated | exa | 3 | 3 | 18 | 5 | no | none | – | – / – | – / – | – / – | $0.0210 | 0 | – | 3182 |
| pope-tavily | tavily | 1 | 2 | 8 | 5 | yes | none | – | – / – | – / – | – / – | $0.0000 | 1 | – | 1589 |

Searched again: `louvre-card`, 2026-11-27 23:57 UTC. Month names are no longer taken for names (D73), so its first search no longer ends in “October” and the old recording no longer matched what Story Search sends. 1 request(s), 8 results, $0.0070 (Exa’s own figure). Its row above is its first recording; replays now use the new one.

Spent on recording: $0.0560 of Exa’s free monthly credit (Exa’s own figures, $0.0070 of it for searching again) and 1 of Tavily’s 1,000 free monthly credits. Neither account has a card, so neither can be charged.

Not searched again:
- `insufficient`: uses synthetic or simulated search answers: nothing to record
- `conflicting`: uses synthetic or simulated search answers: nothing to record
- `duplicates`: uses synthetic or simulated search answers: nothing to record
- `dates-missing`: uses synthetic or simulated search answers: nothing to record
- `content-missing`: uses synthetic or simulated search answers: nothing to record
- `unrelated`: uses synthetic or simulated search answers: nothing to record
- `fallback-exa-ok`: uses synthetic or simulated search answers: nothing to record
- `fallback-exa-timeout`: uses synthetic or simulated search answers: nothing to record
- `fallback-both-timeout`: uses synthetic or simulated search answers: nothing to record
- `fallback-busy-and-exhausted`: uses synthetic or simulated search answers: nothing to record
- `fallback-tavily-exhausted`: uses synthetic or simulated search answers: nothing to record
- `fallback-both-exhausted`: uses synthetic or simulated search answers: nothing to record
- `fallback-exhausted-midway`: uses synthetic or simulated search answers: nothing to record
- `fallback-no-keys`: uses synthetic or simulated search answers: nothing to record
- `malformed-search`: uses synthetic or simulated search answers: nothing to record
- `malformed-results`: uses synthetic or simulated search answers: nothing to record
- `ai-invalid`: uses synthetic or simulated search answers: nothing to record
- `ai-truncated`: uses synthetic or simulated search answers: nothing to record
- `ai-timeout`: uses synthetic or simulated search answers: nothing to record

## How to read the checks

Each report gets eleven checks: the right story; names; event dates; places; relevant facts; no unsupported statements; no contradictions; source references; confidence; readable writing; headline accuracy. Structure is checked strictly (every claim cites a listed source, with a passage of its own from each source it cites, and each passage is checked, independently of the backend, to be in that source’s retrieved text; every source was really retrieved; publisher and kind match the address; “confirmed” rests on two independent news or agency reports, or an official source, and never on a weak claim; syndicated copies count once). A passage being in a source doesn’t show it supports the claim: that is for a person, and Claude’s claims are always listed for one to check. Facts are checked as far as a program can: expected names, dates and places must appear; forbidden ones (another story, another year, a rumour under “unclear”) must not; every number must appear in a retrieved source; a date that appears in no cited source is a failure; a date that matches only a publication date is flagged for a person. “Review” means a person should look. Well-formed output alone never passes the factual checks.

