# Story Search

Right-click a link, choose **LinkPeek – Story Search**, and LinkPeek finds out what the story is without opening the link: it gathers every clue the page gives about the link, searches the web for matching reports, checks which ones are really the same story, and shows a short report with its sources.

Built 26 Nov 2026 on branch `claude/eloquent-cerf-xnjbmt`. The existing preview card, clickbait check and source card are unchanged; Story Search is a second right-click item next to "Peek at this link".

## Status: what works and what isn't verified

| Part | Status |
|---|---|
| Extracting clues from the link and the page | Built and tested (21 unit tests on page shapes and addresses, browser tests on a test page) |
| Search provider interface: Exa (default), Tavily (free backup), Brave (paid mode only) | Built and tested against the request and response shapes in each provider's documentation. Both services were reached from this environment (they answered "no key"). **Never run with a key**: none configured yet. A live test harness is ready (`npm run test:story-live`). |
| One search first, targeted follow-ups only when needed | Built and tested with stand-in search results |
| Free mode: Exa then Tavily, stop with a clear message when both are used up | Built and tested with stand-ins and in the browser |
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
   queries.ts     one best search first; targeted follow-ups ready if needed
   providers/     Exa, then Tavily if Exa can't answer (free mode: nothing else)
   investigate.ts search once, judge the results, follow up only for what's missing
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

**One search first.** `queries.ts` builds the single best query from every clue: the headline (or, without one, the description, the selection, the address's words or the nearby text), plus any names from the card or nearby text that the headline doesn't mention ("Police investigate death of music superstar at city hotel Grand Meridian Jamie Rivers"). Exa and Tavily search by meaning, so this is sent in plain words. With Brave, which honours exact wording, the first search is the exact headline. When the link's date is known, it only asks for results from 14 days before it. It asks for 8 results.

**Then it judges what came back** (`assess` in `investigate.ts`). Only results that look like the story count: close in words and names, from the link's time, and mentioning the person or organisation the link names. It's enough when those come from at least two independent sources (syndicated copies and one agency's story count once), or from one official source. Otherwise one of four things is missing, and a follow-up is aimed at it:

| What's missing | Follow-up search |
|---|---|
| Nothing relevant came back | The story in other words: another headline found on the page, the description, the headline's key words, the address's words, then a broader search without the news-only filter |
| Results don't mention the person the link names | The names with what happened ("Jamie Rivers Paris hotel death") |
| Results come from other times (a different, older event) | The names, what happened and the link's month ("... November 2026") |
| Only one independent source | The same search again, leaving out the sites already found, to reach other outlets |

It stops as soon as there's enough, after 3 searches in all (`STORY_MAX_SEARCHES`, 1 to 5), or when a follow-up fails (for example the free allowance runs out), keeping what it already found. Each follow-up asks for 5 results. The log line records which path it took ("best → single-source>other-outlets"), never the words.

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

## Free mode (the default) and paid mode

**Free mode** is the default and the only mode in use. Story Search uses only Exa and Tavily, each on its free monthly allowance, and neither needs a card. Each search goes to Exa first; if Exa's credit is used up (or it's down), Tavily answers. When both allowances are used up, Story Search stops: the card says "Story Search has used this month's free searches. It works again when they renew at the start of next month," and offers no retry. Nothing switches to paid use.

What makes this a guarantee is the accounts, not the code: with no card on file, Exa and Tavily cannot charge (Exa answers `402 NO_MORE_CREDITS`, Tavily `432`). LinkPeek's code can't see a provider's billing. The code's part: in free mode it never uses a service whose free plan needs a card (Brave is dropped even if listed), never asks for paid extras (Exa: never more than the 10 results its price includes, no summaries; Tavily: basic searches only, 1 credit each), and stops cleanly when a provider says its credit is used up.

**Paid mode** only exists as an explicit choice, and isn't switched on: `STORY_SPENDING=paid` in Vercel, plus a card added in a provider's dashboard and a monthly limit set there (Exa: a budget on the key or team; Tavily: the pay-as-you-go limit). LinkPeek doesn't keep a running total of spend across its servers, so the provider's own limit is what caps it. Paid mode also allows Brave.

## Cost

Estimates from list prices read 26–27 Nov 2026, not measured. The live test records real per-search costs (Exa reports each request's cost; Tavily reports credits).

**Per Story Search**

| Item | When the first search is enough | With two follow-ups (the most) |
|---|---|---|
| Exa (first search: $0.007 + 8 pages of extracts at $0.001; each follow-up: $0.007 + 5 pages) | $0.015 | $0.039 |
| Tavily, if Exa's credit is used up (1 credit a search) | 1 credit | 3 credits |
| Claude Haiku 5.5 (about 7,000 tokens in, 2,000 out) | about $0.002 | about $0.002 |

**Free mode (now)**

| Item | Monthly cost | What it covers |
|---|---|---|
| Exa | $0 | $10 free credit: roughly 250 to 650 Story Searches |
| Tavily | $0 | 1,000 free credits: roughly 330 to 1,000 Story Searches |
| Vercel Hobby | $0 | Personal, non-commercial testing (see below) |
| Claude Haiku 5.5 | about $0.002 a Story Search: **at most about $1.30 to $3.30 a month**, because the free searches run out first | Paid from your existing Anthropic account, capped by its monthly limit |
| **Total** | **$0 for searching; about $1 to $3.30 for Claude** | About 600 to 1,600 Story Searches a month, then it stops until the 1st |

Claude is the one part that isn't free: Anthropic has no free API allowance. It's the same account and key the summaries already use.

**Paid mode (not enabled; only if you decide to later)**

| Item | Price | Per extra Story Search |
|---|---|---|
| Tavily pay-as-you-go | $0.008 a credit | $0.008 to $0.024 |
| Exa paid credit | as above | $0.015 to $0.039 |
| Brave (needs a card) | $5 per 1,000 searches | $0.005 to $0.015 |
| Claude | as above | about $0.002 |

For example, 1,000 Story Searches a month beyond the free ones would cost roughly $10 to $26 for searching with Tavily, plus about $2 for Claude.

**Later, separately from Story Search:** Vercel Pro once LinkPeek is commercial ($20 per developer a month), and Chrome Web Store's one-time $5 developer fee when you publish the extension.

## Vercel hosting: what Hobby allows

- **Hobby is for personal, non-commercial use only; all commercial use needs Pro or Enterprise.** Vercel's guidelines define commercial use as a deployment "used for the purpose of financial gain of anyone involved in any part of the production of the project" (as quoted from Vercel's guidelines on its community forum; the page itself didn't display its list of examples when read on 27 Nov 2026, so check https://vercel.com/docs/limits/fair-use-guidelines in a browser).
- **Fine on Hobby now:** you and a few testers using LinkPeek, with no payments, no ads, no affiliate links, no paid plan announced, and nobody paid to build it.
- **Needs Pro before, not after, the first sale:** once LinkPeek is offered with the intention of making money (a paid plan, even if not live yet; ads; affiliate links), or anyone is paid to work on it. A Vercel answer on its forum puts it as "you charge or intend to charge users".
- **No surprise hosting bills on Hobby:** it includes 1 million function calls, 4 CPU-hours, 360 GB-hours of memory and functions of up to 300 seconds a month; going over pauses the feature until the 30 days are up, and is never billed. Story Search mostly waits on the search services, so it uses little CPU time.
- **Pro:** $20 per developer a month (the developer-seat price on Vercel's Hobby page; confirm on vercel.com/pricing before upgrading). Nothing has been upgraded.

## What you need to configure

**For the live tests (in this cloud session):**

| What | Where | Notes |
|---|---|---|
| Exa key | Secure key form Claude opens (network secret for `api.exa.ai`, header `x-api-key`) | Free account at https://dashboard.exa.ai, no card |
| Tavily key | Secure key form (network secret for `api.tavily.com`, `Authorization: Bearer`) | Free account at https://app.tavily.com, no card |
| Anthropic key | `LINKPEEK_ANTHROPIC_API_KEY` in this cloud environment's environment variables | The same key the summaries use; how the earlier AI evaluation ran |

**For production (only after you authorise the merge):** in Vercel, project `linkpeek-api` > Settings > Environment Variables, for Production:

| Variable | Value |
|---|---|
| `EXA_API_KEY` | Your Exa key |
| `TAVILY_API_KEY` | Your Tavily key |
| `ANTHROPIC_API_KEY` | Already set |

Nothing else is needed: the defaults are free mode, Exa then Tavily, at most 3 searches, Claude Haiku 5.5. Optional settings: `STORY_SPENDING` (`free` default, `paid` only by decision), `STORY_SEARCH_PROVIDER` (default `exa,tavily`), `STORY_MAX_SEARCHES` (1 to 5, default 3), `STORY_MODEL`, `STORY_EFFORT`, `STORY_SEARCH_ENABLED` (`false` switches Story Search off), `STORY_RATE_WEIGHT`, and `BRAVE_SEARCH_API_KEY` (paid mode only). In the extension build, `LINKPEEK_STORY_API_URL` (default `https://linkpeek-api.vercel.app/api/story`).

**In the Anthropic Console:** check a monthly spend limit is set (for example $5).

## Live tests (before merging)

`npm run test:story-live` (in `server/src/story/live.test.ts`) runs against the real services, with no imitations, and writes the results to `docs/eval/story-live-<step>.md` for you to read. Three steps:

1. **normal**: a real Exa search; a real Tavily search on its own; then five Story Searches end to end with real Exa, Tavily and Claude: Pope Francis's death (21 April 2025); the Louvre jewel theft (19 October 2025) from a "Read more" card; the same story from the address alone; a vague "Pop star found dead in hotel room" (for you to judge); and a made-up story that must not produce a report. Checks: real results with page text, a strong sourced report for the real stories, every factual line sourced, and no report for the made-up one.
2. **exa-exhausted**: lower the Exa key's budget in Exa's dashboard below what it has spent, so the real Exa answers "used up". Checks that Exa reports it, and that Tavily takes over and still produces the report.
3. **both-exhausted**: also lower the Tavily key's limit. Checks that both report it, and that Story Search answers "out-of-credit" (the browser test checks the message the card shows for that answer).

Then raise both limits again. Estimated use: step 1 about $0.10–0.25 of Exa's free credit, about 10 Tavily credits and about $0.02 of Claude; steps 2 and 3 almost nothing.

How the keys reach the tests in this cloud session: Exa and Tavily through the secure key form (stored as network secrets, added by the network proxy, never shown to Claude). Claude through a `LINKPEEK_ANTHROPIC_API_KEY` environment variable, the way the summaries evaluation ran, because the proxy route for Anthropic would also affect Claude Code's own connection.

Not yet known: whether Exa's and Tavily's free plans let you set a per-key limit. If not, the two exhaustion steps can't be made real without using up a month's allowance, and the fallback is covered only by the unit tests (which use each provider's documented "used up" reply).

## Still open

1. **The live tests haven't run**: no keys yet. Nothing here has searched the real web or asked the real Claude.
2. **Per-key limits on the free plans**: needed for the real exhaustion steps; see above.
3. **Not merged**: `/api/story` exists only on this branch. The production build of the extension points at `linkpeek-api.vercel.app/api/story`, which only exists after the merge. Waiting for your go-ahead.
4. **Vercel's list of commercial examples** couldn't be read from its page; the rule itself is clear (above).
5. **Claude isn't free**: about $0.002 a Story Search, capped by your Anthropic monthly limit.

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
