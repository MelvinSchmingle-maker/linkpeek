# Story Search live test: searching and matching only (no Claude)

Run on 2026-11-27 18:12 UTC, step "search-only". Real searches (Exa first, Tavily when Exa has no key or no credit) and LinkPeek’s real matching. Claude is not called; the sources listed are the closest ones Story Search would hand to it. Search costs are list-price estimates; on the free plans they come out of the free credit.

## Full headline, named person

Expected: Pope Francis died on 21 April 2025 (Easter Monday) at the Vatican, aged 88. Sources should include news agencies and/or the Vatican.

- Searches: 1 (best), answered by exa
- Search cost: $0.0070 (estimate)
- Searched for: “Pope Francis dies aged 88”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [Pope Francis has died on Easter Monday aged 88 - Vatican News](https://www.vaticannews.va/en/pope/news/2025-04/pope-francis-dies-on-easter-monday-aged-88.html) · vaticannews.va · 2025-04-21 · news
  2. [Pope Francis, first Latin American pontiff, dies after stroke and cardiac arrest | Reuters](https://www.reuters.com/world/pope-francis-has-died-vatican-says-video-statement-2025-04-21/) · Reuters · 2025-04-21 · agency
  3. [Pope Francis, first Latin American pontiff, dies at 88 | AP News](https://apnews.com/article/vatican-pope-francis-dead-01ca7d73c3c48d25fd1504ba076e2e2a) · Associated Press · 2025-04-21 · agency

## "Read more" link with an article card

Expected: Thieves stole crown jewels from the Louvre’s Apollo Gallery in Paris on 19 October 2025, in a raid lasting minutes.

- Searches: 1 (best), answered by exa
- Search cost: $0.0070 (estimate)
- Searched for: “Louvre jewel heist: thieves steal crown jewels in daylight raid Apollo Gallery”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [Thieves steal French crown jewels from Louvre in daytime raid](https://www.france24.com/en/live-news/20251019-thieves-steal-french-crown-jewels-from-louvre-in-daytime-raid) · France 24 · 2025-10-19 · news
  2. [A timeline of the jewel heist at the Louvre in Paris | AP News](https://apnews.com/article/louvre-heist-jewels-paris-timeline-a072c2a5aba6ab5eeb429a280266a799) · Associated Press · 2025-10-22 · agency
  3. [How the Louvre museum robbery happened in video, photographs and maps | Paris | The Guardian](https://www.theguardian.com/world/2025/oct/20/louvre-museum-robbery-thieves-stolen-jewellery) · The Guardian · 2025-10-19 · news

## Address only (no headline)

Expected: The same Louvre story, found from the address words alone.

- Searches: 1 (best), answered by exa
- Search cost: $0.0070 (estimate)
- Searched for: “louvre crown jewels stolen apollo gallery”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [French crown jewels: What we know about the stolen Louvre treasures | CNN](https://www.cnn.com/2025/10/20/style/louvre-heist-which-jewels-stolen-intl-hnk) · CNN · 2025-10-20 · news
  2. [Stolen treasures, a crown dropped as thieves fled - and serious questions for Louvre security](https://www.bbc.com/news/articles/cj0e24rrjz1o) · BBC News · 2025-10-19 · news
  3. [Which jewelry pieces were stolen from the Louvre? See items](https://www.usatoday.com/story/news/world/2025/10/20/louvre-theft-jewelry-stolen/86797998007/) · USA Today · 2025-10-20 · news

## Vague headline, no names, no date

Expected: Many different events fit. A good result says the match is only possible, or names clearly which story it found. It must not present one story as certain without saying why.

- Searches: 1 (best), answered by exa
- Search cost: $0.0070 (estimate)
- Searched for: “Pop star found dead in hotel room”
- Results kept: 8; sent on to the AI: 5; closest shown: 3
  1. [Music world stunned at Whitney Houston's death - ABC News](https://www.abc.net.au/news/2012-02-12/tribute-planned-for-whitney-houston/3825682) · ABC News (Australia) · 2012-02-12 · news
  2. [Whitney Houston, A 'Perfect Instrument,' Dies : NPR](https://www-s1.npr.org/2012/02/12/146761831/whitney-houston-a-perfect-instrument-has-died) · NPR · 2012-02-12 · news
  3. [Whitney Houston died in Beverly Hills hotel room - CBS News](https://www.cbsnews.com/news/whitney-houston-died-in-beverly-hills-hotel-room/) · CBS News · 2012-02-12 · news

## Made-up story

Expected: There is no such story. It must say no reliable match (or no results), never present a report.

- Searches: 3 (best → nothing-relevant>names-and-event → nothing-relevant>broader), answered by exa
- Search cost: $0.0210 (estimate)
- Searched for: “Mayor of Zarnwick resigns after canal bridge collapse injures 14”
- Results kept: 12; sent on to the AI: 5; closest shown: 0

