# Story Search: end-to-end evaluation

Written 2026-11-27 19:20 UTC from branch `claude/eloquent-cerf-xnjbmt`, commit `eb587de`.

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
| Unit | Extension unit tests (`npm test (without the end-to-end suite)`) | Mocked browser APIs (happy-dom); no network | 459 passed, 5 skipped |
| Unit | Backend unit tests (`npm --prefix server test`) | Stand-in search services and Claude client; no network | 127 passed, 9 skipped |
| Browser | Browser tests (whole extension) (`npm run test:e2e`) | Real Chromium with the real extension build; the Story Search backend is a local stand-in (scripts/serve-test-pages.mjs). Story Search tests: 19 of 19 passed. Failed: retrieval.spec.ts › Settings: the on-device AI option says plainly when this computer cannot run it; on-demand.spec.ts › injecting twice is harmless: no duplicate icons Both failed the same way before any Story Search change (docs/progress.md, 26 Nov 2026): this Chromium never reports an on-device AI status, and the second is a timing race ("chrome is not defined") that passes when its spec runs alone (11/11, rerun 27 Nov 2026). | **2 failed**, 137 passed, 4 skipped |
| Build | Production build (`npm run build`) | The extension as it would ship | 1 passed |
| Offline integration | Story Search end to end, 26 cases plus 4 other checks (`npm run test:story-e2e`) | Recorded real search results and synthetic data; stand-in AI replies | 30 passed |
| Live search | Real Exa and Tavily searches for 6 case(s), recorded 2026-11-27 (`npm run test:story-e2e:record`) | Real Exa and Tavily; no AI | 6 of 6 answered |
| Live AI | **Not run**: no Anthropic key in the environment that produced this report | – | – |
| Full end-to-end | **Not run**: needs the Anthropic key as well as the search keys | – | – |

## Offline run

Ran 2026-11-27 19:20 UTC.

### Metrics per investigation

| Case | Answered by | Searches | HTTP requests | Results | Analysed | Fallback | Model | Tokens in / out | Dropped as unsupported | Exa (reported) | Tavily credits | Claude | Backend ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pope | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 | $0.0070 | 0 | – | 30 |
| louvre-card | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 | $0.0070 | 0 | – | 10 |
| louvre-url | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 | $0.0070 | 0 | – | 7 |
| vague | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 | $0.0070 | 0 | – | 6 |
| fabricated | exa | 3 | 3 | 18 | 5 | no | stand-in | – | 0 | $0.0210 | 0 | – | 7 |
| fabricated-invented | exa | 3 | 3 | 18 | 5 | no | stand-in | – | 7 | $0.0210 | 0 | – | 7 |
| insufficient | – | 0 | 0 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | – |
| pope-tavily | tavily | 1 | 2 | 8 | 5 | yes | stand-in | – | 0 | $0.0000 | 1 | – | 12 |
| conflicting | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 | $0.0000 | 0 | – | 4 |
| duplicates | exa | 1 | 1 | 5 | 4 | no | stand-in | – | 0 | $0.0000 | 0 | – | 5 |
| dates-missing | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 | $0.0000 | 0 | – | 3 |
| content-missing | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 | $0.0000 | 0 | – | 3 |
| unrelated | exa | 3 | 3 | 9 | 0 | no | – | – | – | $0.0000 | 0 | – | 2 |
| fallback-exa-ok | exa | 1 | 1 | 8 | 5 | no | stand-in | – | 0 | $0.0070 | 0 | – | 5 |
| fallback-exa-timeout | tavily | 1 | 2 | 8 | 5 | yes | stand-in | – | 0 | $0.0000 | 1 | – | 157 |
| fallback-both-timeout | – | 1 | 2 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 302 |
| fallback-busy-and-exhausted | – | 1 | 2 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 2 |
| fallback-tavily-exhausted | – | 1 | 1 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 1 |
| fallback-both-exhausted | – | 1 | 2 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 2 |
| fallback-exhausted-midway | exa | 2 | 3 | 1 | 1 | no | stand-in | – | 0 | $0.0000 | 0 | – | 4 |
| fallback-no-keys | – | 1 | 0 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 1 |
| malformed-search | – | 1 | 2 | 0 | 0 | no | – | – | – | $0.0000 | 0 | – | 2 |
| malformed-results | exa | 1 | 1 | 3 | 3 | no | stand-in | – | 0 | $0.0000 | 0 | – | 5 |
| ai-invalid | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – | $0.0000 | 0 | – | 9 |
| ai-truncated | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – | $0.0000 | 0 | – | 4 |
| ai-timeout | exa | 1 | 1 | 3 | 3 | no | simulated failure | – | – | $0.0000 | 0 | – | 4 |

Offline times have no network in them. Costs offline are what the recorded requests cost when they were recorded (Exa’s own figure, Tavily’s own credit count); synthetic searches cost nothing.

### Full headline naming a person: Pope Francis

- Case `pope`, real search results. Covers: accurate results, event date versus publication date.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Pope Francis died on 21 April 2025, Easter Monday, at the Vatican, aged 88. The report must give that event date (not a later publication date), and its sources must be real reports of his death (the Vatican, news agencies, major outlets), not later coverage.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Pope Francis died on Easter Monday, 21 April 2025, aged 88, at his residence in the Casa Santa Marta in the Vatican. [1, 5]
  - The Vatican said he died after a stroke followed by heart failure. [2, 5]
- Key details:
  - who: Pope Francis, the first Latin American leader of the Roman Catholic Church. [2, 3]
  - where: His residence in the Casa Santa Marta, Vatican City. [1, 4, 5]
  - when: Easter Monday, 21 April 2025. [1, 2, 3, 4]
  - why: A stroke followed by heart failure, according to the Vatican. [2, 5]
- Confirmed:
  - Pope Francis died aged 88. [1, 2, 3, 4, 5]
  - The Vatican said the cause of death was a stroke followed by heart failure. [2, 5]
  - He was the first Latin American pope. [2, 3]
  - He was born on 17 December 1936 in Buenos Aires, Argentina. [4]
- Reported by one source:
  - Cardinal Kevin Farrell announced the death at 9:45 am. [1]

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news · strong match
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
| Proper source references | pass | 11 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 11 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 30 ms in the backend, 91 ms in all.

### "Read more" link in an article card: the Louvre jewel theft

- Case `louvre-card`, real search results. Covers: accurate results, card clues, no mixing with other news about the same place.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Louvre jewel heist: thieves steal crown jewels in daylight raid” (card-heading); teaser “Thieves used a vehicle-mounted lift to reach the Apollo Gallery and escaped within minutes.”; date 2025-10-19 (card-label); address https://paper.example.org/p/88231.
- Expected: Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid of a few minutes. Only the heist: not other Louvre news (strikes, renovation plans, the Mona Lisa).
- Actual: **report**, match **strong**, confidence **strong**, subject “Thieves steal crown jewels from the Louvre in daylight raid”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Thieves stole French crown jewels from the Louvre museum in Paris in a daylight raid on Sunday 19 October 2025. [1, 2, 3, 4]
  - They used a basket lift to reach an upstairs window and were inside the museum for less than four minutes. [2, 5]
- Key details:
  - what: Eight items of jewellery from France’s crown jewels were stolen. [4]
  - where: The Apollo Gallery of the Louvre museum in Paris. [4]
- Confirmed:
  - Officials put the value of the stolen jewels at about 88 million euros ($102 million). [2, 4]
  - A crown was dropped as the thieves fled, and was found outside the museum. [1, 5]
- Reported by one source:
  - The theft took less than eight minutes in total. [2, 5]
  - The thieves escaped on motorbikes. [3]
- Unclear:
  - The sources reviewed do not say who the thieves were.

Sources:

1. [Thieves steal French crown jewels from Louvre in daytime raid](https://www.france24.com/en/live-news/20251019-thieves-steal-french-crown-jewels-from-louvre-in-daytime-raid) · France 24 · 2025-10-19 · news · strong match · credits AFP
2. [A timeline of the jewel heist at the Louvre in Paris \| AP News](https://apnews.com/article/louvre-heist-jewels-paris-timeline-a072c2a5aba6ab5eeb429a280266a799) · Associated Press · 2025-10-22 · agency · strong match · credits Associated Press
3. [Thieves rob priceless jewels from Paris' Louvre in brazen heist \| Reuters](https://www.reuters.com/world/europe/thieves-steal-jewels-louvre-paris-media-reports-2025-10-19/) · Reuters · 2025-10-19 · agency · strong match · credits Reuters
4. [Louvre Robbery: What Was Stolen - The New York Times](https://www.nytimes.com/2025/10/19/world/europe/louvre-heist-items.html?smid=tw-share) · The New York Times · 2025-10-19 · news · strong match
5. [Louvre closed after historic jewels stolen in daylight \| AP News](https://apnews.com/article/louvre-closed-jewel-heist-2cc473fc178ae6a3513daa0c71b43409) · Associated Press · 2025-10-20 · agency · strong match · repeats 2 · credits Associated Press

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Louvre/ |
| Correct event dates | review | found /19 October 2025/; "2025-10-19" in "Thieves stole French crown jewels from the Louvre museum in …" matches a source's publication date but not its text: check it's the event date |
| Correct locations | pass | found /Paris\|Apollo Gallery/ |
| Relevant facts | pass | found /jewel/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 8 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 9 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Thieves steal crown jewels from the Louvre in daylight raid |
| Card: Doesn't show "Read more" | pass | Read more |
| Card: Doesn't show "new entrance" | pass | new entrance |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 10 ms in the backend, 18 ms in all.

### Only the address: the same Louvre story from the URL’s words and date

- Case `louvre-url`, real search results. Covers: accurate results, address clues.
- Search: replay of real Exa/Tavily results recorded 2026-11-27.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: address words “louvre crown jewels stolen apollo gallery”; date 2025-10-19 (url-date); address https://paper.example.org/2025/10/19/louvre-crown-jewels-stolen-apollo-gallery.
- Expected: The same Louvre heist (19 October 2025), found from the address words and the date in the address alone.
- Actual: **report**, match **strong**, confidence **strong**, subject “Crown jewels stolen from the Louvre’s Apollo Gallery”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Thieves stole pieces of the French crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025. [1, 2]
  - Eight items were stolen; a ninth, the crown of Empress Eugénie, was dropped during the escape. [2, 4, 5]
- Key details:
  - what: Pieces of the French crown jewels, including an emerald necklace given by Napoleon to his second wife. [1, 3]
  - where: The Apollo Gallery of the Louvre museum in Paris. [1]
- Confirmed:
  - Nine objects were targeted and eight were stolen. [2, 4]
  - The crown of Empress Eugénie, set with more than 1,300 diamonds, was found outside the museum. [4, 5]
- Reported by one source:
  - The stolen items include an emerald necklace and earrings that belonged to Empress Marie-Louise. [3]
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
| Proper source references | pass | 7 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 8 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Crown jewels stolen from the Louvre’s Apollo Gallery |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 7 ms in the backend, 13 ms in all.

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
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: vague-link |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
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

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 6 ms in the backend, 14 ms in all.

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
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: older-story |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |

Metrics: 3 search(es) (best → nothing-relevant>names-and-event → nothing-relevant>broader), 3 HTTP request(s), answered by exa; 18 result(s) retrieved, 12 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0210 as reported by Exa, Tavily 0 credit(s), Claude –; 7 ms in the backend, 11 ms in all.

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
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: older-story |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |
| Card: Doesn't show "Pieter Holm" | pass | Pieter Holm |
| Card: Doesn't show "Fourteen people" | pass | Fourteen people |
| Card: Doesn't show "Possibly related" | pass | Possibly related |

Metrics: 3 search(es) (best → nothing-relevant>names-and-event → nothing-relevant>broader), 3 HTTP request(s), answered by exa; 18 result(s) retrieved, 12 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0210 as reported by Exa, Tavily 0 credit(s), Claude –; 7 ms in the backend, 10 ms in all.

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

Report as shown:

- What happened:
  - Pope Francis died on 21 April 2025, aged 88, the Vatican announced. [1, 2, 3, 4, 5]
  - The Vatican said he died after a stroke followed by heart failure. [1, 4, 5]
- Key details:
  - why: A stroke followed by heart failure, the Vatican said. [1, 4, 5]
- Confirmed:
  - He had spent weeks in hospital earlier in 2025 with pneumonia. [2, 5]
  - In his final will he asked to be buried in the Basilica of St Mary Major in Rome. [1, 3]
- Reported by one source:
  - Francis died at about 7:35 local time. [1]

Sources:

1. [Vatican announces death of Pope Francis aged 88](https://www.bbc.com/news/articles/cqj42vd1rxlo) · BBC News · 2025-04-21 · news · strong match
2. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news · strong match
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
| Proper source references | pass | 6 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 6 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by tavily (fallback used); 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 1 credit(s), Claude –; 12 ms in the backend, 17 ms in all.

### Sources disagree: a warehouse fire (synthetic)

- Case `conflicting`, synthetic data (made up for the test). Covers: conflicts.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: states what the three reports agree on and puts the disputed injury count and cause under “What remains unclear?”.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: Three independent reports agree a warehouse on Dock Road burned on 12 November 2026, but disagree on how many were hurt (three or seven) and on the cause (an electrical fault, or not yet known). The report must state the agreed facts, say what each source reports on the disputed ones, and leave them open.
- Actual: **report**, match **strong**, confidence **conflicting**, subject “Fire destroys warehouse on Dock Road in Port Elsworth”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - A fire destroyed a warehouse on Dock Road in Port Elsworth on 12 November 2026. [1, 2, 3]
- Key details:
  - where: A warehouse on Dock Road, Port Elsworth. [1, 2, 3]
  - when: Overnight on 12 November 2026. [1, 3]
- Confirmed:
  - The fire destroyed a warehouse on Dock Road in Port Elsworth. [1, 2, 3]
- Reported by one source:
  - Fire crews were called shortly after midnight. [3]
- Unclear:
  - How many people were hurt: harbourgazette.example and coastnews.example say three people were treated in hospital, while elsworthtimes.example says seven workers were injured. [1, 2, 3]
  - The cause: elsworthtimes.example says investigators believe an electrical fault started the fire, while harbourgazette.example and coastnews.example say the cause is not yet known. [1, 2, 3]

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · harbourgazette.example · 2026-11-12 · news · strong match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · elsworthtimes.example · 2026-11-12 · news · strong match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · coastnews.example · 2026-11-13 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | pass | found /12 November 2026/ |
| Correct locations | pass | found /Dock Road/ |
| Relevant facts | pass | found /warehouse/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | disputed values only under "What remains unclear?" |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence conflicting (expected conflicting); notes: none |
| Clear, readable writing | pass | 7 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Conflicting information |
| Card: Subject shown | pass | Fire destroys warehouse on Dock Road in Port Elsworth |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 9 ms in all.

### One wire story printed twice, an AMP copy and an unrelated result (synthetic)

- Case `duplicates`, synthetic data (made up for the test). Covers: duplicates, syndication, unrelated results.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: matches the three ferry reports, not the football result, and cites the wire copies and the independent report separately.
- What the extension sent: headline “Gullholm ferry service suspended after engine failure” (link-text); address words “gullholm ferry suspended engine failure”; date 2026-11-03 (url-date); address https://news.example.com/2026/11/03/gullholm-ferry-suspended-engine-failure.
- Expected: The ferry between Port Elsworth and Gullholm was suspended after an engine failure. The same wire report appears on two sites (one source, not two), one of them also as an AMP page (listed once), and one independent report adds detail. A sports story that shares a place name is not a match. Only facts from two independent reports may be called confirmed.
- Actual: **report**, match **strong**, confidence **strong**, subject “Port Elsworth to Gullholm ferry suspended after engine failure”, notes: syndicated.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - The ferry between Port Elsworth and Gullholm was suspended after an engine failure, its operator Isle Link said. [1, 2, 3]
- Key details:
  - who: Isle Link, the ferry operator. [1, 2, 3]
- Confirmed:
  - The ferry between Port Elsworth and Gullholm was suspended after its engine failed. [1, 2, 3]
- Reported by one source:
  - Passengers were told to expect no sailings until at least 10 November. [1, 2]
  - Replacement buses and a chartered boat will carry passengers until sailings resume, Isle Link said. [3]
- Unclear:
  - When the ferry will sail again is not yet confirmed.

Sources:

1. [Gullholm ferry suspended after engine failure](https://coastalwire.example/news/2026/11/03/gullholm-ferry-suspended) · coastalwire.example · 2026-11-03 · news · strong match
2. [Gullholm ferry suspended after engine failure](https://harbourgazette.example/news/2026/11/03/gullholm-ferry-suspended-after-engine-failure) · harbourgazette.example · 2026-11-03 · news · strong match · repeats 1
3. [Isle Link says Gullholm ferry repairs will take a week](https://elsworthtimes.example/news/2026/11/04/isle-link-ferry-repairs) · elsworthtimes.example · 2026-11-04 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Gullholm/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /engine/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: syndicated |
| Clear, readable writing | pass | 6 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Port Elsworth to Gullholm ferry suspended after engine failure |
| Card: Doesn't show "Gullholm Rovers" | pass | Gullholm Rovers |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 5 result(s) retrieved, 4 kept, 4 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 9 ms in all.

### No dates anywhere: the link and every result are undated (synthetic)

- Case `dates-missing`, synthetic data (made up for the test). Covers: missing dates.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: reports the vote without giving any date the sources don’t give.
- What the extension sent: headline “Council in Port Elsworth approves new harbour wall after storm damage” (link-text); address https://news.example.com/p/77812.
- Expected: The story is clear but no source gives a date. The report must not invent one (no "on 17 November 2026"), and the card must show the sources without dates.
- Actual: **report**, match **strong**, confidence **strong**, subject “Port Elsworth council approves new harbour wall”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Port Elsworth council approved plans for a new harbour wall after storms damaged the old one. [1, 2, 3]
- Key details:
  - where: Port Elsworth harbour. [1, 2, 3]
- Confirmed:
  - Port Elsworth council approved a new harbour wall. [1, 2, 3]
- Reported by one source:
  - The work is expected to cost £4.2 million. [2]
- Unclear:
  - The sources reviewed don’t give the date of the vote.

Sources:

1. [New harbour wall approved for Port Elsworth](https://elsworthtimes.example/news/harbour-wall-vote) · elsworthtimes.example · no date · news · strong match
2. [Port Elsworth council backs new harbour wall](https://harbourgazette.example/news/port-elsworth-harbour-wall-approved) · harbourgazette.example · no date · news · strong match
3. [Harbour wall plan passes in Port Elsworth](https://coastnews.example/news/harbour-wall-plan-passes) · coastnews.example · no date · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | pass | found /harbour wall/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 4 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong; notes: none |
| Clear, readable writing | pass | 5 sentence(s): no markup, links or relative dates, none over 45 words |
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

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 3 ms in the backend, 7 ms in all.

### Results with headlines only, no page text (synthetic)

- Case `content-missing`, synthetic data (made up for the test). Covers: missing content.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: stand-in reply written for the test (not Claude). Over-confident stand-in: rates headline-only evidence as strong. LinkPeek’s rules must lower it.
- What the extension sent: headline “Port Elsworth lifeboat crew rescue two fishermen off Gull Point” (link-text); address words “port elsworth lifeboat rescue gull point”; date 2026-11-18 (url-date); address https://news.example.com/2026/11/18/port-elsworth-lifeboat-rescue-gull-point.
- Expected: Every result has a headline but no text. The report may say what the headlines say, must note that it rests on headlines only, and must not rate the evidence as strong.
- Actual: **report**, match **strong**, confidence **partial**, subject “Lifeboat crew rescue two fishermen off Gull Point”, notes: snippets-only.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - A lifeboat crew from Port Elsworth rescued two fishermen off Gull Point. [1, 2, 3]
- Confirmed:
  - Two fishermen were rescued off Gull Point. [1, 2, 3]
- Unclear:
  - The sources give only headlines, so the details of the rescue are not known.

Sources:

1. [Port Elsworth lifeboat volunteers praised after Gull Point rescue](https://coastnews.example/news/2026/11/19/lifeboat-volunteers-praised) · coastnews.example · 2026-11-19 · news · strong match
2. [Lifeboat crew rescue two fishermen off Gull Point](https://harbourgazette.example/news/2026/11/18/gull-point-rescue) · harbourgazette.example · 2026-11-18 · news · strong match
3. [Two fishermen rescued near Port Elsworth](https://elsworthtimes.example/news/2026/11/18/fishermen-rescued) · elsworthtimes.example · 2026-11-18 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong |
| Correct names | pass | found /Gull Point/ |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial or insufficient); notes: snippets-only |
| Clear, readable writing | pass | 3 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Lifeboat crew rescue two fishermen off Gull Point |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 3 ms in the backend, 7 ms in all.

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
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient (expected insufficient); notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search found results, but none clearly about this story. LinkPeek won't guess. |

Metrics: 3 search(es) (best → nothing-relevant>address-words → nothing-relevant>names-and-event), 3 HTTP request(s), answered by exa; 9 result(s) retrieved, 3 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 4 ms in all.

### Exa answers: Tavily is never asked

- Case `fallback-exa-ok`, real search results. Covers: fallback.
- Search: Exa: real results replayed from the “pope” recording; Tavily: must not be asked.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa has credit and answers, so Tavily is not called at all.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Pope Francis died on Easter Monday, 21 April 2025, aged 88, at his residence in the Casa Santa Marta in the Vatican. [1, 5]
  - The Vatican said he died after a stroke followed by heart failure. [2, 5]
- Key details:
  - who: Pope Francis, the first Latin American leader of the Roman Catholic Church. [2, 3]
  - where: His residence in the Casa Santa Marta, Vatican City. [1, 4, 5]
  - when: Easter Monday, 21 April 2025. [1, 2, 3, 4]
  - why: A stroke followed by heart failure, according to the Vatican. [2, 5]
- Confirmed:
  - Pope Francis died aged 88. [1, 2, 3, 4, 5]
  - The Vatican said the cause of death was a stroke followed by heart failure. [2, 5]
  - He was the first Latin American pope. [2, 3]
  - He was born on 17 December 1936 in Buenos Aires, Argentina. [4]
- Reported by one source:
  - Cardinal Kevin Farrell announced the death at 9:45 am. [1]

Sources:

1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news · strong match
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
| Proper source references | pass | 11 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 11 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0070 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 15 ms in all.

### Exa times out: Tavily takes over

- Case `fallback-exa-timeout`, real search results. Covers: timeouts, fallback.
- Search: Exa: no answer until its timeout (simulated); Tavily: real results replayed from the “pope-tavily” recording.
- AI: stand-in reply written for the test (not Claude). Careful stand-in written from the recorded Tavily results: only what they say, each sentence citing the results that say it.
- What the extension sent: headline “Pope Francis dies aged 88” (link-text); address words “pope francis dies aged”; date 2025-04-21 (url-date); address https://news.example.com/2025/04/21/pope-francis-dies-aged-88.
- Expected: Exa never answers; after its timeout Tavily is asked and the story is found from Tavily’s real results.
- Actual: **report**, match **strong**, confidence **strong**, subject “Pope Francis dies aged 88”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - Pope Francis died on 21 April 2025, aged 88, the Vatican announced. [1, 2, 3, 4, 5]
  - The Vatican said he died after a stroke followed by heart failure. [1, 4, 5]
- Key details:
  - why: A stroke followed by heart failure, the Vatican said. [1, 4, 5]
- Confirmed:
  - He had spent weeks in hospital earlier in 2025 with pneumonia. [2, 5]
  - In his final will he asked to be buried in the Basilica of St Mary Major in Rome. [1, 3]
- Reported by one source:
  - Francis died at about 7:35 local time. [1]

Sources:

1. [Vatican announces death of Pope Francis aged 88](https://www.bbc.com/news/articles/cqj42vd1rxlo) · BBC News · 2025-04-21 · news · strong match
2. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news · strong match
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
| Proper source references | pass | 6 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence strong (expected strong or partial); notes: none |
| Clear, readable writing | pass | 6 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 5 source link(s) for 5 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Strong evidence |
| Card: Subject shown | pass | Pope Francis dies aged 88 |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by tavily (fallback used); 8 result(s) retrieved, 8 kept, 5 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 1 credit(s), Claude –; 157 ms in the backend, 161 ms in all.

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
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search took too long. Try again. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 302 ms in the backend, 305 ms in all.

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
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search service didn't answer. Try again in a minute. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 6 ms in all.

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
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | Story Search has used this month's free searches. It works again when they renew at the start of next month. |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 1 ms in the backend, 4 ms in all.

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
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | Story Search has used this month's free searches. It works again when they renew at the start of next month. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody, provider errors exa:NO_MORE_CREDITS; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 4 ms in all.

### Allowance runs out between the first search and the follow-up (synthetic)

- Case `fallback-exhausted-midway`, synthetic data (made up for the test). Covers: credit exhaustion, adaptive search.
- Search: Exa: made-up results, then HTTP 402 NO_MORE_CREDITS (simulated); Tavily: HTTP 432 (simulated).
- AI: stand-in reply written for the test (not Claude). Careful stand-in: reports what the one source says.
- What the extension sent: headline “Port Elsworth pier reopens after storm repairs” (link-text); address words “port elsworth pier reopens”; date 2026-11-21 (url-date); address https://news.example.com/2026/11/21/port-elsworth-pier-reopens.
- Expected: The first search finds one report; the follow-up for a second source hits the used-up allowance on both services. Searching stops there and the report is written from the one source, marked as single-source.
- Actual: **report**, match **strong**, confidence **partial**, subject “Port Elsworth pier reopens after storm repairs”, notes: single-source.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - The pier in Port Elsworth reopened on 21 November 2026 after six weeks of repairs to storm damage. [1]
- Reported by one source:
  - The council said repairs to storm damage took six weeks. [1]

Sources:

1. [Port Elsworth pier reopens after storm repairs](https://harbourgazette.example/news/2026/11/21/port-elsworth-pier-reopens) · harbourgazette.example · 2026-11-21 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | n/a | nothing expected |
| Correct event dates | pass | found /21 November 2026/ |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 2 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence partial (expected partial); notes: single-source |
| Clear, readable writing | pass | 2 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 1 source link(s) for 1 source(s), each opening in a new tab without a referrer |
| Card: Claims show their source numbers | pass | source numbers appear beside the claims |
| Card: Match and confidence shown | pass | tags: Strong match, Partial evidence |
| Card: Subject shown | pass | Port Elsworth pier reopens after storm repairs |

Metrics: 2 search(es) (best → single-source>other-outlets), 3 HTTP request(s), answered by exa, provider errors exa:NO_MORE_CREDITS; 1 result(s) retrieved, 1 kept, 1 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 8 ms in all.

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
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Explains the outcome | pass | The search service didn't answer. Try again in a minute. |

Metrics: 1 search(es) (best), 2 HTTP request(s), answered by nobody; 0 result(s) retrieved, 0 kept, 0 analysed; 0 AI call(s); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 2 ms in the backend, 5 ms in all.

### Search results with junk entries mixed in (synthetic)

- Case `malformed-results`, synthetic data (made up for the test). Covers: malformed responses.
- Search: Exa: made-up results; Tavily: must not be asked.
- AI: stand-in reply written for the test (not Claude). Careful stand-in: states what the three reports agree on and puts the disputed injury count and cause under “What remains unclear?”.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: Exa’s answer mixes good results with an entry without a title, one with a javascript: address, and markup in titles. The junk is dropped, markup is removed, and the report is built from the good results.
- Actual: **report**, match **strong**, confidence **conflicting**, subject “Fire destroys warehouse on Dock Road in Port Elsworth”.
- Result: pass (tests LinkPeek’s pipeline and rules; the report text is the stand-in’s, not Claude’s).

Report as shown:

- What happened:
  - A fire destroyed a warehouse on Dock Road in Port Elsworth on 12 November 2026. [1, 2, 3]
- Key details:
  - where: A warehouse on Dock Road, Port Elsworth. [1, 2, 3]
  - when: Overnight on 12 November 2026. [1, 3]
- Confirmed:
  - The fire destroyed a warehouse on Dock Road in Port Elsworth. [1, 2, 3]
- Reported by one source:
  - Fire crews were called shortly after midnight. [3]
- Unclear:
  - How many people were hurt: harbourgazette.example and coastnews.example say three people were treated in hospital, while elsworthtimes.example says seven workers were injured. [1, 2, 3]
  - The cause: elsworthtimes.example says investigators believe an electrical fault started the fire, while harbourgazette.example and coastnews.example say the cause is not yet known. [1, 2, 3]

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire & investigation begins](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · harbourgazette.example · 2026-11-12 · news · strong match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · elsworthtimes.example · 2026-11-12 · news · strong match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · coastnews.example · 2026-11-13 · news · strong match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report (expected report); match strong (expected strong) |
| Correct names | pass | found /Port Elsworth/ |
| Correct event dates | pass | found /12 November 2026/ |
| Correct locations | pass | found /Dock Road/ |
| Relevant facts | pass | found /warehouse/i |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | disputed values only under "What remains unclear?" |
| Proper source references | pass | 5 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence conflicting (expected conflicting); notes: none |
| Clear, readable writing | pass | 7 sentence(s): no markup, links or relative dates, none over 45 words |
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

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (stand-in); Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 5 ms in the backend, 11 ms in all.

### Claude’s reply isn’t valid JSON (simulated)

- Case `ai-invalid`, synthetic data (made up for the test). Covers: malformed responses, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (invalid), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: The AI’s reply can’t be read: no report is written; the closest sources are listed as possible matches only, with a retry.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · harbourgazette.example · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · elsworthtimes.example · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · coastnews.example · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: invalid; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 9 ms in the backend, 13 ms in all.

### Claude’s reply is cut off at the token limit (simulated)

- Case `ai-truncated`, synthetic data (made up for the test). Covers: malformed responses, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (truncated), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: A cut-off reply is a failure, never a half report: the closest sources are listed as possible matches only.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · harbourgazette.example · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · elsworthtimes.example · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · coastnews.example · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: truncated; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 8 ms in all.

### Claude times out (simulated)

- Case `ai-timeout`, synthetic data (made up for the test). Covers: timeouts, AI failure.
- Search: synthetic results (made up for the test, in Exa’s format).
- AI: simulated Claude failure (timeout), not a live call.
- What the extension sent: headline “Fire destroys warehouse at Port Elsworth docks” (card-heading); teaser “Firefighters spent the night tackling the blaze on Dock Road.”; date 2026-11-12 (card-label); address https://local.example.net/p/40213.
- Expected: The AI doesn’t answer in time: the closest sources are listed as possible matches only, with a retry.
- Actual: **report-failed**, match **possible**, confidence **insufficient**, no subject.
- Result: pass (a simulated Claude failure, not a live call).

Sources:

1. [Warehouse destroyed in Port Elsworth dock fire](https://harbourgazette.example/news/2026/11/12/port-elsworth-warehouse-fire) · harbourgazette.example · 2026-11-12 · news · possible match
2. [Seven injured as blaze guts Port Elsworth warehouse](https://elsworthtimes.example/news/2026/11/12/dock-road-blaze) · elsworthtimes.example · 2026-11-12 · news · possible match
3. [Port Elsworth warehouse fire: what we know](https://coastnews.example/news/2026/11/13/port-elsworth-fire-what-we-know) · coastnews.example · 2026-11-13 · news · possible match

| Check | Result | Detail |
|---|---|---|
| Correct identification of the story | pass | outcome report-failed (expected report-failed); match possible (expected possible or none) |
| Correct names | n/a | nothing expected |
| Correct event dates | n/a | no date expected |
| Correct locations | n/a | nothing expected |
| Relevant facts | n/a | nothing expected |
| No unsupported assumptions | pass | no forbidden statements; every number appears in a retrieved source |
| No contradictory claims | pass | none found |
| Proper source references | pass | 0 factual claim(s), every one cites a listed source; every source was retrieved; publishers and kinds match their sites; "confirmed" rests on independent sources |
| Appropriate confidence | pass | confidence insufficient; notes: none |
| Clear, readable writing | pass | 0 sentence(s): no markup, links or relative dates, none over 45 words |
| Card: No broken values on the card | pass | no "undefined", "NaN", "Invalid Date" or "[object Object]" |
| Card: The original link is not opened | pass | the page stayed where it was; the card only links to the address |
| Card: Original link offered, not followed | pass | one "Open link" link to the address, opened only if the reader clicks it |
| Card: Every source is a working link | pass | 3 source link(s) for 3 source(s), each opening in a new tab without a referrer |
| Card: Explains the outcome | pass | Couldn't write a report. These sources may be about the same story: |

Metrics: 1 search(es) (best), 1 HTTP request(s), answered by exa; 3 result(s) retrieved, 3 kept, 3 analysed; 1 AI call(s) (simulated failure), AI failed: timeout; Exa $0.0000 as reported by Exa, Tavily 0 credit(s), Claude –; 4 ms in the backend, 9 ms in all.

### Other checks

| Check | Result | Detail |
|---|---|---|
| Free mode with brave,exa,tavily | pass | answer {"error":"out-of-credit"}; Brave asked 0 time(s); Exa 1, Tavily 1; logged spending "free" |
| Free mode with brave and STORY_SPENDING=free | pass | answer {"error":"not-configured"}; Brave asked 0 time(s); Exa 0, Tavily 0; logged spending "free" |
| Free mode with exa,tavily,brave and STORY_SPENDING=yes please | pass | answer {"error":"out-of-credit"}; Brave asked 0 time(s); Exa 1, Tavily 1; logged spending "free" |
| Paid mode only by explicit setting | pass | STORY_SPENDING=paid gives "exa+tavily+brave"; nothing in the code sets it |

## Recording the real searches

Recorded 2026-11-27 18:50 UTC with `npm run test:story-e2e:record`. Each real case was searched once; later runs replay the recording instead of searching again. Cases that already had a recording were not searched again.

| Case | Answered by | Searches | HTTP requests | Results | Analysed | Fallback | Model | Tokens in / out | Dropped as unsupported | Exa (reported) | Tavily credits | Claude | Backend ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pope | exa | 1 | 1 | 8 | 5 | no | none | – | – | $0.0070 | 0 | – | 3726 |
| louvre-card | exa | 1 | 1 | 8 | 5 | no | none | – | – | $0.0070 | 0 | – | 6170 |
| louvre-url | exa | 1 | 1 | 8 | 5 | no | none | – | – | $0.0070 | 0 | – | 1709 |
| vague | exa | 1 | 1 | 8 | 5 | no | none | – | – | $0.0070 | 0 | – | 1543 |
| fabricated | exa | 3 | 3 | 18 | 5 | no | none | – | – | $0.0210 | 0 | – | 3182 |
| pope-tavily | tavily | 1 | 2 | 8 | 5 | yes | none | – | – | $0.0000 | 1 | – | 1589 |

Spent on recording: $0.0490 of Exa’s free monthly credit (Exa’s own figures) and 1 of Tavily’s 1,000 free monthly credits. Neither account has a card, so neither can be charged.

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

Each report gets ten checks: the right story; names; event dates; places; relevant facts; no unsupported statements; no contradictions; source references; confidence; readable writing. Structure is checked strictly (every claim cites a listed source; every source was really retrieved; publisher and kind match the address; “confirmed” rests on two independent reports or an official one; syndicated copies count once). Facts are checked as far as a program can: expected names, dates and places must appear; forbidden ones (another story, another year) must not; every number must appear in a retrieved source; a date that appears in no cited source is a failure; a date that matches only a publication date is flagged for a person. “Review” means a person should look. Well-formed output alone never passes the factual checks, and Claude’s claims are always listed for a person to check against their sources.

