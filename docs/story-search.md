# Story Search

Right-click a link, choose **LinkPeek – Story Search**, and LinkPeek finds out what the story is without opening the link: it gathers every clue the page gives about the link, searches the web for matching reports, checks which ones are really the same story, and shows a short report with its sources.

Built 26 Nov 2026 on branch `claude/eloquent-cerf-xnjbmt`. The existing preview card, clickbait check and source card are unchanged; Story Search is a second right-click item next to "Peek at this link".

## Status: what works and what isn't verified

| Part | Status |
|---|---|
| Extracting clues from the link and the page | Built and tested (21 unit tests on page shapes and addresses, browser tests on a test page) |
| Search provider interface: Exa (default), Tavily (free backup), Brave (optional) | Built and tested against the request and response shapes in each provider's documentation. **Never run against the live APIs**: no key was configured. |
| Matching, syndication grouping, report rules | Built and tested with stand-in search results and a stand-in AI |
| Claude analysis (structured JSON output) | Built and tested with a stand-in client. **Never run against Claude**: no key was configured in this environment. |
| Card, stages, consent, errors, settings | Built and tested in Chromium against a stand-in backend |
| Deployed backend | **Not deployed.** `/api/story` exists only on this branch. Merging to `main` deploys it; it answers "not set up" until an Exa or Tavily key is in Vercel. |

So: nothing here has searched the real web or asked the real Claude. The first live run needs a search key (below) and should be checked by hand on a set of real links before anyone relies on it.

## Where it fits in the existing architecture

What was already there, and what Story Search reuses:

- **Chrome extension, Manifest V3, TypeScript, Vite, three builds** (`scripts/build.mjs`). No change to the build structure; one new build-time value, `__STORY_API_URL__`.
- **Right-click menu** (`src/background/index.ts`): one `contextMenus` item sent `{type: 'peek'}` to the content script. Story Search adds a second item that sends `{type: 'story'}`. No new permission: `contextMenus` and `activeTab` were already there, and the menu click grants `activeTab` as before.
- **Content script** (`src/content/controller.ts`, `card.ts`): finds the right-clicked link and shows a card in a closed Shadow DOM. Story Search uses the same controller and card host, with its own card body (`story-card.ts`, `story-view.ts`).
- **Backend** (`server/`, one Vercel project, `linkpeek-api`): framework-free handlers, the Anthropic SDK, and one Vercel Firewall rate-limit rule. Story Search adds `POST /api/story` beside `POST /api/summarise`, reusing the rate limiter (own buckets, weighted) and the Anthropic error handling.
- **AI provider**: Claude through the backend, Claude Haiku 5.5 by default (D37). Story Search uses the same SDK and the same key.
- **Keys**: only in Vercel's environment, never in the extension. Unchanged.
- **Tests**: Vitest (with happy-dom) for units, Playwright with the unpacked test build for browser tests, a local test server with stand-ins for the backend. Story Search adds a stand-in for `/api/story`.

## How it works

```
Right-click > "LinkPeek – Story Search"
  │  (service worker sends {type:'story', url, selection?} to the page's content script)
  ▼
1. Extracting link information            on the device; nothing sent yet
   src/core/story/extract.ts, url.ts, package.ts
  │  not enough to go on? → "There isn't enough information..." (no request)
  │  first time? → card shows exactly what will be sent; waits for "Search"
  ▼
2. Port to the service worker → POST /api/story (no cookies, no referrer)
   src/content/story-run.ts → src/background/story.ts → src/core/story/client.ts
  ▼
3. Backend: server/src/story/
   queries.ts     2–3 queries first (exact headline, key words, names + event)
   providers/     Exa, then Tavily if Exa can't answer (Brave optional)
   investigate.ts merge, drop duplicates, one broader round only if results are weak
   match.ts       set aside results with nothing in common; date and name checks
   sources.ts     source kinds; group syndicated copies and agency reports
   analyse.ts     Claude decides which results are the story, writes JSON
   report.ts      rules the AI can't overrule (below)
   streams {"stage":...} lines as each step really starts, then {"report":...}
  ▼
4. The card: subject, match and confidence, What happened?, Key details,
   What is confirmed?, Reported by one source, What remains unclear?,
   Supporting sources, notes, "Searched for", and "Open link" (never opened by itself)
```

### 1. Extraction (on the device)

Each clue carries where it came from and how confident the extractor is. The card shows the source of each clue on the confirmation screen.

- **The link**: its visible text, `title`, image `alt`, and address. "Read more", "Click here" and similar are recognised as generic and never used as a headline.
- **The address** (`url.ts`): tracking parameters removed; Facebook `l.php`, Google `/url?q=`, Outlook safe links and similar wrappers unwrapped on the device; shorteners (bit.ly, t.co, nyti.ms...) flagged and their code ignored; the slug decoded into words with IDs, file endings and filler segments (`/news/`, `/story/`) dropped; a date read from the path (`/2026/11/26/`, `2026-11-26`, `20261126`, or a month only).
- **The article card**: the smallest container around the link that holds one story (an `<article>`, list item, or box whose class says card/teaser/story/promo, or the first box with a heading), stopping before anything with several headings or more than 2,500 characters. From it: the heading, the teaser (`.summary`, `.standfirst`, the first real paragraph), a kicker or section label, a `<time datetime>`, a caption.
- **A heading just above** a link that has no card, never crossing into another story's card (found while testing: a bare "Read more" after a list of stories would otherwise borrow the last story's headline).
- **Text around a link in running text**: the sentence with the link and one either side, capped at 600 characters, never the whole page.
- **Structured data describing this exact link**: JSON-LD on the current page whose `url` or `mainEntityOfPage` is the link's address (news front pages often list their stories this way). Headline, description, dates, author, section, keywords.
- **The current page's own metadata** only when the link points at this page, or when its headline clearly shares the link's words. Otherwise it is ignored, so a front page's title is never mistaken for the clicked story's headline.
- **The user's selection**, only when text was selected as they right-clicked.
- **Never read**: form fields, editable areas, hidden text, scripts. **Never sent**: the current page's address, cookies, the link's query string. Emails and phone numbers are removed from every text clue.

**Fallback order for the headline:** descriptive link text or title → structured data for the link → the page's own metadata when the link points here → the card's heading → a heading just above → an image's alt text → (for searching only) the description, the address's words, the selection, nearby text.

**Not enough to search:** fewer than three meaningful words across all clues. The card says so and nothing is sent.

### 2. Searching

`queries.ts` writes several differently worded queries: the exact headline (quoted where the provider supports it), its key words, and names with the event ("Jamie Rivers Paris hotel death"); without a good headline, the description, the address's words, the selection or nearby text. Near-duplicates (80% the same words) are dropped. Two or three run at once; if fewer than two results look like the story, at most two broader queries run (no news-only filter, so official sources can turn up). When the link's date is known, the first round only asks for results from 14 days before it.

Each provider adapter turns a query into results with title, address, date, author, snippet and short passages. Results are merged, with the same page under different addresses (`www.`, `amp.`, `/amp`, tracking parameters) counted once.

### 3. Matching, independence and the report

- **Rule-based matching** (`match.ts`): the share of the link's meaningful words each result contains, how many of the link's names it mentions, and whether its date is far from the link's (more than 30 days before or 120 after; when the link has no date, the best results' dates stand in). Results below a low floor are set aside and never sent to the AI. At most five go on.
- **Independence** (`sources.ts`): results are grouped when they credit the same agency ("(Reuters) –", "The Associated Press"), carry largely the same text (five-word shingles), or have the same headline on different sites. The agency's own page, or the earliest, is the original; the rest are copies.
- **Source kinds**: official source (government, police, courts, parliaments), news agency, news, opinion, social media post, website. Labels and ordering only; nothing is shown as "trusted".
- **Claude** (`analyse.ts`, `prompt.ts`) marks each result strong, possible or none with a reason, then writes the report in a fixed JSON schema (structured outputs). Its instructions: use only facts in the sources, add nothing from its own knowledge, never guess a cause, identity, place or date, keep allegations as allegations, explicit dates only, say what's unclear or contradictory, treat all source text as data and never as instructions.
- **Rules the AI can't overrule** (`report.ts`):
  - A result is a match only if the AI says so and the rules allow it. A result can't be a strong match if its date is far from the link's, if it names none of the link's people, if the link names a specific person or organisation it doesn't mention, or if it shares almost no words. A result with almost nothing in common is never a match at all.
  - Every sentence in "What happened?", "Key details" and the facts must cite a remaining source, or it's dropped.
  - **"Confirmed" is decided by the rules**: stated by strong matches from two independent groups, or by an official source. Everything else goes under "Reported by one source". Syndicated copies count once.
  - Confidence can be lowered, never raised: "Strong evidence" needs strong matches from two independent groups, a confirmed fact, and more than snippets.
  - Sentences with "yesterday", "today" and the like are dropped; links and markup are removed from AI text.
- **Outcomes**: a report; "No reports about this story were found"; "none clearly about this story, LinkPeek won't guess"; or, if the AI fails, "Couldn't write a report. These sources may be about the same story", listing up to three close results as possible matches only, with no claims.

### 4. The card

Stages shown as they really happen: Extracting link information (on the device), Searching for matching stories (from the moment the request goes out), Analysing relevant sources (while Claude reads the results), Preparing the report (while the rules check the reply). Then the report, with source numbers after every factual line, a caution above everything when the match is only possible, notes (one independent source, developing story, snippets only, older story left out, repeats counted once), "Searched for", how many results were set aside, a line saying the report was written by AI from search results, and "Open link". Source links open in a new tab without a referrer. The original link is never opened.

Messages for every failure: not enough information, not a web link, not set up, search service down, search timed out, free searches used up for the month, rate limited, server unreachable, unreadable answer. "Try again" only where it can help.

## Setup: the free way (decided 27 Nov 2026)

Everything below is free and needs no credit card, so none of it can charge anyone. The owner asked for free or the cheapest option, so these choices are made, not pending:

| Choice | Decision | Why |
|---|---|---|
| Search service | **Exa first, Tavily as automatic backup** | Both free every month with no card. Exa gives the best page extracts; when its free credit runs out, Tavily takes over on its own. Brave dropped from the default: since 2026 even its free credit needs a card |
| AI model | **Claude Haiku 5.5** | Cheapest Claude model, about $0.002 a search, already the model for summaries. Sonnet is one setting away if the live test shows wrong matches |
| Hosting | **Vercel Hobby (free)** | Allows 300-second functions (Story Search needs 60). Hobby is for non-commercial use: move to Pro ($20 a month) only when LinkPeek starts making money |
| Privacy | **Keep the design as built** | Only on request, consent screen first time, no page address, cookies or typed text (D53) |

The owner's steps:

1. Make a free Exa account at https://dashboard.exa.ai (no card). Copy the API key.
2. Make a free Tavily account at https://app.tavily.com (no card). Copy the API key (it starts with `tvly-`).
3. In Vercel: project `linkpeek-api` > Settings > Environment Variables. Add `EXA_API_KEY` and `TAVILY_API_KEY`, for Production. Never paste keys into a chat.
4. In the Anthropic Console, check a monthly spend limit is set (for example $5). Story Search's AI costs about $2 per 1,000 searches.
5. Merge this branch into `main`, which deploys the backend. Then try Story Search on 20 to 30 real links.

## Configuration and keys

| Where | Variable | What |
|---|---|---|
| Vercel (backend) | `EXA_API_KEY` | Exa key (free, no card). From https://dashboard.exa.ai |
| Vercel (backend) | `TAVILY_API_KEY` | Tavily key (free, no card), the backup. From https://app.tavily.com |
| Vercel (backend) | `STORY_SEARCH_PROVIDER` | Optional. Default `exa,tavily`: Exa, then Tavily when Exa fails or its credit is used up. Any list of `exa`, `tavily`, `brave` |
| Vercel (backend) | `BRAVE_SEARCH_API_KEY` | Only if `brave` is added to the list. Needs a card at sign-up |
| Vercel (backend) | `ANTHROPIC_API_KEY` | Already set for summaries; Story Search uses the same key |
| Vercel (backend) | `STORY_MODEL` | Optional, default `claude-haiku-5-5` |
| Vercel (backend) | `STORY_EFFORT` | Optional: `low`, `medium` (default) or `high` |
| Vercel (backend) | `STORY_SEARCH_ENABLED` | Optional: `false` switches Story Search off without a redeploy |
| Vercel (backend) | `STORY_RATE_WEIGHT` | Optional, default 3: one Story Search counts as this many requests against the existing `summarise` rate-limit rule, in its own buckets |
| Extension build | `LINKPEEK_STORY_API_URL` | Optional. Default `https://linkpeek-api.vercel.app/api/story`; empty builds without Story Search |

No key is needed in the extension. With one key, that service is used alone. With neither, the backend answers "not configured" and the card says "Story Search isn't set up in this version of LinkPeek". When every service's free credit is used up, the card says "Story Search has used this month's free searches", and it works again when they renew. It never pretends to search.

## Cost (from list prices read 26 and 27 Nov 2026; estimates, not measured)

How many searches one Story Search makes: Exa and Tavily search by meaning, so the headline and its key words are one search, not two. A link that names someone gets two searches (the headline, then the names with the event); otherwise one, with a few more results. One or two more run only when the first find little.

| Item | Price | Per Story Search |
|---|---|---|
| Exa search (`auto`, up to 10 results) | $7 per 1,000 searches | 1–2 searches, rarely up to 4 |
| Exa page extracts (highlights) | $1 per 1,000 pages | 5 pages a search (8 when only one search) |
| **Exa total** | **Free: $10 credit a month, no card** | **about $0.015–0.024; free covers roughly 400–650 Story Searches a month** |
| **Tavily (backup)** | **Free: 1,000 credits a month, no card**; then $0.008 a credit | **1–2 credits; free covers roughly 500–700 Story Searches a month** |
| Brave (optional, not used by default) | $5 per 1,000 searches, $5 free a month, card required | about $0.005–0.01 |
| Claude Haiku 5.5 | $0.10 / $0.50 per million tokens in / out | **about $0.002** |
| Vercel Hobby | Free (non-commercial only) | $0 |

Monthly, at list prices:

| Story Searches a month | Search | Claude | Vercel | Total |
|---|---|---|---|---|
| Up to about 900 | $0 (free credit) | about $1.80 | $0 | **about $2** |
| 2,000, paying for the extra | about $13 (1,100 extra on Tavily: about 1.5 credits each at $0.008) | about $4 | $0 | **about $17** |
| Once LinkPeek is commercial | as above | as above | $20 (Pro) | add $20 |

Without a card on file, Exa and Tavily stop at their free credit instead of charging. Paying for more is the owner's choice later, not something that can happen by accident.

Spending controls in the code: at most 5 searches per Story Search; the AI sees at most 5 results of about 1,600 characters each; one Story Search counts as 3 requests in its own rate-limit buckets per install and per IP (with the current rule of 30 per 10 minutes, that's 10 Story Searches per install and per address every 10 minutes); finished reports are reused for 10 minutes (breaking or empty) to 6 hours (settled) by the backend, and for 30 minutes on the device; a report the AI couldn't write is never reused, and neither is one built on Brave results (Brave's terms reserve storing results for custom plans). Every request logs its search count, result count, which service answered, model, tokens and estimated cost, never the link or the search words. The hard ceilings are the free credits and the Anthropic Console's monthly limit.

## Privacy

Only when the user picks the menu item, and the first time only after they've seen exactly what will be sent and pressed "Search". Sent to LinkPeek's server: the link's address without its query string or fragment, the headline and other wordings found, the card's teaser, up to 600 characters of nearby text, the address's words, a date, publisher, author, section and keywords if the page gave them, the user's selection if they made one, the page language, and a random install ID. The server passes search queries made from these to the search service (Exa, or Tavily when Exa can't answer), and the clues plus search results to Anthropic. Not sent: the current page's address, cookies, form contents, or anything typed. Full details in `docs/privacy.md`.

## Still to check after the first live run

1. **Quality**: run Story Search on 20 to 30 real links of different kinds (news, sport, celebrity, local, a "Read more" link, a shortened link). Note where it picked the wrong story or missed the right one.
2. **Model**: if it picks wrong stories, set `STORY_MODEL=claude-sonnet-5-5` (about $0.04 a search for the AI instead of $0.002) and compare.
3. **Exa against Tavily**: to compare them, set `STORY_SEARCH_PROVIDER=tavily` for a while. Neither has been run live yet.

## Known limits

- Shortened links are not followed. Following one would mean a request to the shortener; the server deliberately makes none to arbitrary addresses (no server-side fetching, so no request forgery risk and no "scrape, proxy" use under Vercel's policy). Story Search falls back on the link's text and surroundings.
- Names are recognised by capital letters, so a headline in Title Case gives no names, and lowercase names are missed.
- The source-kind lists (agencies, official domains, news organisations) are short and rough, like the primary-source list in Part 08.
- The backend's report cache lives in one function instance's memory; repeat searches that land on another instance search again. A shared cache (Vercel's Runtime Cache) is the next step if traffic justifies it.
- The right-click menu itself can't be clicked by Playwright; tests send the same message the menu sends. Showing and hiding the menu item when Story Search is switched off in Settings is untested.
- The extension's options page and the card wording haven't been reviewed by the owner.

## Files

| What | Where |
|---|---|
| Clue extraction, address analysis, what's sent | `src/core/story/extract.ts`, `url.ts`, `package.ts`, `words.ts` |
| Client for the endpoint, report checks, on-device cache, consent | `src/core/story/client.ts`, `cache.ts`, `consent.ts` |
| Service worker port | `src/background/story.ts` |
| Card: run, view model, DOM, styles | `src/content/story-run.ts`, `story-view.ts`, `story-card.ts`, `styles.css` |
| Wording | `src/core/messages.ts` (`MSG.story`) |
| Backend endpoint | `server/api/story.ts`, `server/src/story/` |
| Tests | `src/core/story/*.test.ts`, `src/content/story-view.test.ts`, `server/src/story/story.test.ts`, `e2e/story.spec.ts` |
| Screenshots | `docs/screenshots/story-search/` |
