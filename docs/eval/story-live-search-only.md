# Story Search live test: searching and matching only (no Claude)

Run on 2026-11-27 18:06 UTC, step "search-only". Real searches (Exa first, Tavily when Exa has no key or no credit; Exa had no key yet, so every search went to Tavily) and LinkPeek’s real matching. Claude is not called; the sources listed are the closest ones Story Search would hand to it. Search costs are list-price estimates; on the free plan they came out of the free credit (1 credit per search).

## Full headline, named person

Expected: Pope Francis died on 21 April 2025 (Easter Monday) at the Vatican, aged 88. Sources should include news agencies and/or the Vatican.

- Searches: 1 (best), answered by tavily
- Search cost: $0.0080 (estimate)
- Searched for: “Pope Francis dies aged 88”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [Vatican announces death of Pope Francis aged 88](https://www.bbc.com/news/articles/cqj42vd1rxlo) · BBC News · 2025-04-21 · news
  2. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news
  3. [Pope Francis, first Latin American pontiff, dies at 88 | AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency

## "Read more" link with an article card

Expected: Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid lasting minutes.

- Searches: 2 (best → single-source>other-outlets), answered by tavily
- Search cost: $0.0160 (estimate)
- Searched for: “Louvre jewel heist: thieves steal crown jewels in daylight raid Apollo Gallery”
- Results kept: 12; sent on to the AI: 5; closest shown: 3
  1. [Louvre: How Thieves Carried out Heist of ‘Priceless’ Napoleonic Jewels](https://time.com/7326868/louvre-robbery-museum-crown-jewels) · Time · 2025-11-15 · news
  2. [How did burglars pull off 'the theft of the decade' in 7 minutes at the Louvre? • FRANCE 24](https://www.youtube.com/watch?v=-7hSkzul3ZE) · youtube.com · 2025-10-19 · social
  3. [Louvre Announces New $92 Million Master Security Plan](https://news.artnet.com/art-world/louvre-robbery-2701689) · news.artnet.com · 2025-11-07 · other

## Address only (no headline)

Expected: The same Louvre story, found from the address words alone.

- Searches: 1 (best), answered by tavily
- Search cost: $0.0080 (estimate)
- Searched for: “louvre crown jewels stolen apollo gallery”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [The Louvre theft could make France's stolen crown jewels as famous as the Mona Lisa | AP News](https://apnews.com/article/france-louvre-jewels-heist-e389efc4c7a80ab276df6532c415195a) · Associated Press · 2025-10-26 · agency
  2. [Hunt continues for thieves after priceless jewels stolen in heist at Louvre museum in Paris - BBC News](https://www.bbc.com/news/live/c62lnennzgdt) · BBC News · 2025-10-19 · news
  3. [Louvre: How Thieves Carried out Heist of ‘Priceless’ Napoleonic Jewels](https://time.com/7326868/louvre-robbery-museum-crown-jewels) · Time · 2025-11-15 · news

## Vague headline, no names, no date

Expected: Many different events fit. A good result says the match is only possible, or names clearly which story it found. It must not present one story as certain without saying why.

- Searches: 1 (best), answered by tavily
- Search cost: $0.0080 (estimate)
- Searched for: “Pop star found dead in hotel room”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [Today Marks 29 Years Since We Tragically Lost the “Consummate Pop Star” Who Fronted One of the Biggest Rock Bands of the 80s](https://americansongwriter.com/today-marks-29-years-since-we-tragically-lost-the-consummate-pop-star-who-fronted-one-of-the-biggest-rock-bands-of-the-80s) · americansongwriter.com · 2026-11-22 · other
  2. [‘Extraordinary artist’: Italian opera star Antonello Palombi found dead after missing rehearsals | News24](https://www.news24.com.au/lifestyle/celebrity-life/extraordinary-artist-italian-opera-star-antonello-palombi-found-dead-after-missing-rehearsal/news-story/494270b8729c50b499763c4ea2de03e6) · news24.com.au · 2026-11-13 · other
  3. [28 Needle Marks, One Dead K-Pop Star — No One Was Convicted | Seoul Case Files](https://www.youtube.com/watch?v=hdlYxNV3QO0) · youtube.com · no date · social

## Made-up story

Expected: There is no such story. It must say no reliable match (or no results), never present a report.

- Searches: 3 (best → nothing-relevant>names-and-event → nothing-relevant>broader), answered by tavily
- Search cost: $0.0240 (estimate)
- Searched for: “Mayor of Zarnwick resigns after canal bridge collapse injures 14”
- Results kept: 12; sent on to the AI: 5; closest shown: 0

