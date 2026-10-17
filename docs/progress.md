# Progress

## Part 01. Project setup (13 Oct 2026)

**Built:** an empty but real extension. Manifest V3, three-part Vite build, popup that says "Installed" with the version, options page, settings storage, placeholder icons, module folders, docs.

**Tested (actual results):**
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: 4/4 pass (settings defaults, merge, change events)
- `npm run build`: pass, produces `dist/`
- `npm run test:e2e`: 1/1 pass. Loads the unpacked extension in Playwright's Chromium 141 (headless) and checks the popup.

**Not verified:** loading in your own Chrome by hand (follow the README). Other Chromium browsers (Edge, Brave) not tried.

## Part 02. Inline button and card, with demo data (13 Oct 2026)

**Built:**
- The inline icon (an eye, sized to the headline text) placed right after a link, inside a Shadow DOM.
- The card: status mark with text label, evidence tag, "Demo data" tag, link warning with the reason, summary or explanation, "Open article", thumbs up/down.
- All states: idle, loading, full summary, partial preview, headline only, inaccessible, summary failed, link warning, clickbait warning, not enough evidence, unsupported, feedback received. Wording for every failure reason in `src/core/messages.ts`.
- Closes on Escape, close button, outside click, or clicking the icon again. Focus goes into the card on open and back to the icon on close.
- Light and dark themes, following the browser setting.
- Feedback votes stored on the device (see D12).
- Popup: "Run on this page" and the demo toggle.
- Test page `test-pages/news-front.html` with hostile page CSS, a clickable teaser block, nav and footer links.

**Tested (actual results):**
- typecheck, lint: pass
- Unit tests: 34/34 pass (every card state, the tick/cross/neutral labels, page text inserted as text not markup, demo data always tagged, no "safe" wording, feedback one-vote rule and cap, hostname-only storage)
- Browser tests: 25/25 pass in Chromium 141 headless. Covers icon placement (demo links only, none in nav or footer), open/close, card position, no layout shift, keyboard (Enter, Tab, Escape, focus return), outside click, page click handlers not triggered, page CSS can't restyle the UI, every state's text, feedback saved with hostname only, demo toggle removes and restores icons, layout at approx. 200% zoom, 50% zoom and phone width, and the card following its link on scroll.
- Screenshots of every state in light and dark: `docs/screenshots/part-02/`.

**Not verified:**
- By hand in your own Chrome (please try it, README has steps).
- A real screen reader (labels and roles are set, but nobody has listened to it yet).
- "Run on this page" in the popup: it needs a real toolbar click, which automated tests can't do. The code path is small, but it's untested.

## Part 03. Link detection and modes (13 Oct 2026)

**Built:**
- Link classifier (rules, see D15/D16) and a separate module that reads link facts from the page.
- Page scanner: finds links on load and as content appears (feeds, single-page apps, href changes, framework re-renders), each link judged once, no duplicate icons, time-boxed batches.
- Modes: Smart (default), Scan, Manual. Right-click "Peek at this link with LinkPeek" and the Alt+Shift+P shortcut for a focused link. A manual peek adds a temporary icon that goes away when the card closes.
- Per-site on/off in the popup using Chrome's optional site permissions; "Turn on for all websites" and site lists in Settings.
- Popup redesigned: mode, this site, Scan this page, Settings link, shortcut. Demo toggle moved to Settings.
- Test pages: nav-heavy, blog, infinite feed, single-page app, 1,200 links.
- Fixed: Chrome shrinks extension-page text to 75% by default; popup and settings now set their own size. Dark-mode button contrast.

**Tested (actual results):**
- typecheck, lint, production build: pass
- Unit tests: 97/97 pass, including 57 labelled classifier examples (precision 100% on the set, required 95%+; earlier versions of this note said 59, which was the number of tests, not examples), site-pattern helpers, the new "can't read articles yet" state.
- Browser tests: 40/40 pass in Chromium 141. New: icons exactly on the expected links on the nav-heavy and blog pages; feed items get icons as they load; single-page app route changes, re-renders and href changes with no duplicates; 1,200-link page (all icons in about 0.4 s, slowest batch about 12 ms, no long tasks); Smart default; Scan mode (no icons until scan, popup reports "Found 11 article links"); Manual peek by URL and by focused link, temporary icon removed on close with focus returned to the link; mode persists across reloads; turn off/on for a site from the popup; turn back on from Settings.
- Screenshots: `docs/screenshots/part-03/`.

**Not verified:**
- The real right-click menu and the real keyboard shortcut. Tests send the same messages those send, but can't click Chrome's own menu or press a browser-level shortcut.
- Chrome's permission prompt for "Turn on" (automated tests can't click it), and everything that follows a real grant: registering the site script and keeping it after a restart. The test builds have test-server access baked in, so that path never runs in the automated tests (corrected 14 Oct 2026; this line used to say the tests covered it).
- Real websites. The classifier has only seen our test pages and labelled examples. Part 10 tests it on live sites.
- The keyboard shortcut showed as "not set" in the automated browser. In normal Chrome it should be Alt+Shift+P unless another extension already uses it.

## Review and fixes (14 Oct 2026)

**What happened:** a multi-agent code review of Parts 01 to 03. Four reviewers each took one area (page-side correctness, security and privacy, permissions and the service worker, the classifier and brief compliance). A sceptic then tried to disprove every finding, mostly by reproducing it in a real Chromium. 37 findings were confirmed (about 30 distinct problems, several found twice) and 2 rejected. All confirmed ones are fixed or documented. Design changes are in `docs/decisions.md` D22.

**The serious ones:**
- The first right-click peek or "Scan this page" on a site you hadn't turned on usually failed or was undone straight away (a start-up race). Fixed. A new test build (`dist-e2e-on-demand/`) now tests exactly this path; the old tests couldn't, because their build loaded LinkPeek differently. The new tests fail on the old code and pass on the new.
- Any website could make LinkPeek show a "Headline check passed" tick on its own links using LinkPeek's demo markup. Fixed: demo markup only works on the local test server.
- A page could stop LinkPeek from starting with one HTML element, or hide its card with CSS. Fixed.
- A right-click peek on a site you hadn't turned on started Smart mode scanning the whole page. Fixed.
- "Turn back on" in Settings never worked (Chrome refused the permission pattern), and unticking "all websites" also removed every site turned on one by one. Fixed.

**Tested (actual results):**
- typecheck, lint, production build: pass. The production build has no test hooks, closed Shadow DOM, and no site access at install (checked in `dist/`).
- Unit tests: 113/113 pass. The classifier's labelled set grew from 57 to 71 examples: 14 new negative shapes (GitHub commits, Google Docs, Amazon and eBay products, Wikipedia categories, WordPress "Continue reading" and "Leave a comment", comment counts, sidebars). Correction: this note first claimed positive cases too (old Reddit, a Guardian date, Chinese and Thai headlines, Bluesky); the script that added them silently skipped them. They were added in round two (below). Precision 100%, recall 100% on that set.
- Browser tests: 62/62 pass (53 with the auto-loading test build, 9 with the on-demand one). New: first peek and first scan on 10 fresh pages each; Smart mode doesn't start on sites not turned on; turning a site on while LinkPeek is already on the page; a page element named `__linkpeekLoaded`; leftover icons from an old version; double injection; demo markup ignored on another site; hostile `!important` CSS; re-ordered lists; swapped links; headlines whose text arrives late; SVG links; Escape and focus belonging to the page; a card whose link gets hidden; peeking the same link twice; a URL that appears twice on a page.

**Not verified (honest list):**
- Chrome's real permission prompt, and what follows it: registering the site script, keeping it after a browser restart, "Turn on for all websites", "Turn back on". The test builds have test-server access baked in, so this path never runs in automated tests.
- The real right-click menu, the real keyboard shortcut and the "?" badge when a peek fails. Tests send the same messages, but can't click Chrome's own menu or press a browser-level shortcut.
- Right-click peeks inside frames (code sends to the right frame; no test page with frames yet).
- Cleaning up after an extension update. The new copy removes the old copy's icons (tested with planted leftovers); the old copy stopping itself was not tested, because tests can't update the extension in place.
- Sites built with React and similar tools. The first automatic scan waits for the page to settle (load, then 0.3 s without changes, at most 3 s). That only helps sites that hydrate quickly: the second review round showed that hydrating 0.5 s or more after load (including the reviewer's 1 s example) still causes a hydration failure and a full re-render. Correction: this line used to say the wait avoided the reviewer's case; it doesn't. Drawing icons in an overlay would remove the risk; not done.
- Real websites in general. Still only test pages and labelled examples. Part 10 is where that gets measured.
- A real screen reader.

## Second review round and fixes (14 Oct 2026)

**What happened:** the same review process, aimed at the fixes. One sceptic per area re-tested each of the 37 findings against the fixed code, mostly by re-running the original reproduction in a real Chromium. A separate reviewer hunted the fix commit for new bugs, and a sceptic tried to disprove each one.

**Result before this round's fixes:** 27 of 37 confirmed fixed, 10 only partly fixed, 12 new problems confirmed (all 12 reproduced). Several were introduced by round one: fixed tag names a page could hijack, icons forced visible inside hidden slides, the first scan waiting forever on pages that never finish loading, icons rebuilt every second by a ticking timestamp, an endless loop against page code that keeps a badge next to a link, BBC-style video promos and Law360's IP section losing their icons, and the popup's update listeners being wired into the wrong function. All are fixed; design changes are in `docs/decisions.md` D23.

**Tested (actual results):**
- typecheck, lint, production build: pass. The production build has closed Shadow DOM, no test hooks or timing code, and no site access at install (checked in `dist/`).
- Unit tests: 129/129 pass. Labelled classifier set: 87 links (the positives that went missing in round one are in now, plus Law360's IP section, a BBC video promo, a Hindi headline, an FT link from old Reddit, and newsletter, subscribe, log-in and help links under content sections). Precision 100%, recall 100%, printed by `npm test`.
- Browser tests: 72/72 pass (3 screenshot-only tests skipped). New in this round: a page defining our element name can't get into new icons and LinkPeek switches names; hostile CSS colour variables and `::after` covers have no effect; an icon in a hidden slide stays hidden; a ticking timestamp doesn't rebuild the icon or steal focus; page code keeping its badge next to a link doesn't cause a loop; Smart mode starts on a page that never finishes loading; crafted forms don't stop the scanner or make Scan hang; the popup updates while open; after `chrome.runtime.reload()` the old copy removes its icons within seconds with no page changes; only one card open across frames; the shortcut works on a focused link inside a frame and other frames stay silent.

**Not verified (in addition to the list above):**
- The "Turn on pending" note that lets the service worker undo "turn off" when the popup closes during Chrome's prompt. It needs the real prompt.
- The "?" badge itself (code path runs; tests can't see the toolbar).
- The two remaining partial items are design limits, not fixed: icons are still inserted next to links (overlay not built, see the React note above), and the real grant/restart path isn't tested.

## Part 04. Fetching and reading articles (14 Oct 2026)

**Built:**
- Real reading for real links. The card shows what LinkPeek read: "The text begins (LinkPeek writes summaries in a later version):" and the opening sentence, or a preview that says it isn't the full article, or a plain reason it couldn't read the page. No summaries and no tick or cross yet; the card shows no verdict mark rather than a made-up one.
- Fetching (D24): same-site links fetched from the page, other sites after the user allows them in a small LinkPeek window, links to the current page read from the page. No cookies, no referrer, 8 s timeout, size limits, one retry only for dropped connections and timeouts.
- Reading (D25): an offscreen document with Mozilla Readability for HTML and pdf.js for the first 15 pages of a PDF.
- Failure checks (D26) for robot checks (Cloudflare, DataDome, PerimeterX, Imperva, Google's "unusual traffic"), login walls, subscription walls (D27), JavaScript-only pages, HTTP errors, slow and huge pages, images and other files.
- A memory-only result cache (D28).
- Test pages: `test-pages/retrieval.html` with 24 cases and fictional articles in `test-pages/articles/`, including three PDFs. New test server routes for error codes, redirects, slow and huge responses, and request counting.
- Live check: `scripts/live-check.mjs` with a `dist-live/` build. Results in `docs/compat/part-04-live.md`.

**Tested (actual results):**
- typecheck, lint, production build: pass. The production build has no test hooks.
- Unit tests: 189/189 pass. They cover article reading on four layouts, the opening sentence on the four layouts the live check tripped over, previews, every failure reason, paywalled pages never leaking body text, PDFs (full, partial, scanned), the fetcher against a real local server (timeouts, one retry, size limits, character sets, no cookies, redirects), the cache, and the card's wording for each result.
- Browser tests: 104/104 pass in Chromium 141 (3 screenshot-only tests skipped). Every case on the retrieval page read for real; a paywalled page never shows its paid text; slow sites time out after exactly one retry; 403, 429 and robot checks are asked exactly once; the same article twice is fetched once; a 429 isn't remembered; a same-site link is fetched by the page without permission; a link to another site asks first and fetches nothing; once access is granted the open card tries again by itself; Manual mode peeks read real links; and a service worker stopped in the middle of reading still gives an answer (the server saw the second request, which proves the restart happened).
- Live check on 10 real pages (14 Oct 2026, from a cloud machine): **7 of 10 came back full** (BBC News, the Guardian, GOV.UK, Wikipedia, the GitHub blog, an arXiv PDF and a Hacker News thread). The Times was correctly treated as a paywall, with only its public description shown. Reddit sent this machine to a login page. YouTube sent it to Google's robot check by the second run. The first run found three wrong opening sentences (BBC, Wikipedia, GOV.UK); all three are fixed and have test pages now. Details: `docs/compat/part-04-live.md`.

**Not verified:**
- Chrome's real permission prompt in the "Allow access…" window. Tests can't click it; they stand in for a grant and check that the card tries again.
- Results from a home connection. The live check ran from a data-centre address, which some sites treat worse.
- Discussion pages. A Hacker News thread counts as `full` and the card shows the first comment. Part 13.
- Whether 150 words is the right line between full and partial. It's a guess (D26).
- Sites whose security policy blocks the in-page fetch for same-site links. The code reports it as "couldn't reach the site"; no live example found yet.


## Competitor research (17 Oct 2026)

A research run on similar products (browser built-ins, link summarisers, clickbait tools, link safety), plus 192 Firefox reviews of DeArrow and Norton Safe Web. Results: `docs/research/competitors-2026-10.md`, with a feature matrix and the ranked reviews. In short: no browser ships a link summary (Chrome deleted its experimental page preview in Chrome 149), the closest extensions have 7 users or fewer, all of them write more than 20 words, and none gives a tick, cross or neutral verdict without a server. The findings were added to build-plan Parts 05, 06, 07, 11 and 14.

**Not covered:** annoyance and cookie-banner blockers, Brave, Edge's current state, and Chrome Web Store review text.

## Part 05. Summary engine, no AI (17 Oct 2026)

**Built:**
- A word-count rule (D30) and a hard 20-word limit (D31). Over-long text is cut at a clause boundary so it stays a whole sentence, or rejected. A summary over 20 words can't reach the card: the engine re-checks every provider's output.
- Quality filters: filler openers ("This article discusses..."), the headline repeated back, questions and fragments are rejected.
- A provider slot with three engines:
  - Extractive (the default, D32): the article's most informative sentence, labelled "In the article's own words:".
  - Chrome's on-device AI (opt-in in Settings, D34): labelled "Summary by Chrome's AI, on this computer:".
  - Remote: a stub for Part 06.
- Summaries run in the offscreen document straight after reading. Partial pages get a 20-word preview from their public description. Paywalled body text is never summarised (tested).
- Settings has a "Summaries" section with the on-device switch, a status line saying whether this computer can run it, and the model download button.
- An evaluation set (D33) of 20 fictional articles, including French and Spanish, with `npm run eval` writing `docs/eval/part-05.md`.
- Fixes the evaluation found along the way:
  - Readability's text ran paragraphs together ("pounds.Engineers"), which spoiled previews and word counts. Fixed for article and page text.
  - The robot-check list now includes "Verifying Device" pages (found on The Times in the live check).

**Tested (actual results):**
- typecheck, lint, production build: pass.
- Unit tests: 264 pass (1 skipped: the step that writes the evaluation report, which runs under `npm run eval`). They cover every word-count rule, exactly 20 and 21 words, numbers only, long hyphenated words, non-English text, the shorten-once rule, every refused cut (lead-ins, dangling words, open quotes, split clauses, ranges, list items, subject-and-aside, "so ... that"), filler and headline-repeat rejection, the on-device provider against a stand-in for Chrome's API (never starts a download, asks once for shorter, falls back), and the engine refusing over-long output from a misbehaving provider.
- Evaluation: 20 of 20 articles get a summary, all 20 words or fewer, none with filler, average 15.1 words, average key-word overlap with the hand-written summaries 0.62. Three are true sentences but the wrong focus: the opinion piece, the review and the science story (D32).
- Browser tests: 106 pass in Chromium 141 (3 screenshot-only tests skipped). Full articles show a labelled summary of 20 words or fewer, partial pages show their preview and no summary, a paywalled page shows no summary and no paid text, and Settings says plainly that this browser can't run Chrome's AI.
- Live check (17 Oct 2026): the 7 readable sites all got whole-sentence summaries of 20 words or fewer except the Hacker News thread, which got none. See `docs/compat/part-04-live.md`.

**Not verified:**
- Chrome's on-device AI with the real model. The automated browser has no model, so only the stand-in was tested, plus the Settings page saying it's unavailable. Whether the API is exposed in an extension's offscreen document at all has not been seen working.
- The model download button (needs a capable computer and a real click).
- Your check from the build plan: using it on 10 real articles for a day to judge whether the free summary is good enough.

## Part 06. AI summaries (17 Oct 2026, done: deployed, measured, switched to Haiku 5.5)

**Built:**
- A backend in `server/`: one Vercel function, `POST /api/summarise`, which asks Claude through the official Anthropic SDK (D35 to D39). It has:
  - strict request checks (no page address accepted)
  - a size limit
  - a switch (`SUMMARIES_ENABLED`)
  - rate limits per install and per IP address (one Vercel Firewall rule; it refuses to run without it)
  - a prompt that treats article text as data, with our own tags stripped from it
  - a cached system prompt and low effort
  - refusal handling with `fallbacks: "default"`
  - 15-second timeouts
  - logs of counts and timings only
- `docs/cost/part-06-estimate.md`: the estimate (made before any real request) and then the measured comparison of Opus 5.5, Sonnet 5.5 and Haiku 5.5. Haiku 5.5 is the default now.
- In the extension:
  - a third choice in Settings, "LinkPeek's AI (Claude, by Anthropic)", off by default and saying exactly what it sends
  - a provider that sends only full articles (first 6,000 characters), asks once to shorten, once to rewrite filler, and otherwise uses the free summary
  - a random install ID, replaced monthly and deleted when AI summaries are switched off
  - the card label "Summary by AI (Claude):"
  - builds without a backend address show the option greyed out
- An AI evaluation, `npm run eval:ai`: the 20 Part 05 articles plus three prompt-injection pages, through the real extension-to-backend code path, writing `docs/eval/part-06.md` with the measured cost.

**Tested (actual results):**
- typecheck, lint, production build: pass.
- Backend: 39 tests pass, with a stand-in for Claude. They cover:
  - request rules, including that a page address is refused
  - the prompt (long enough to cache, injection tags can't break out)
  - request settings: Opus 5.5 default, effort low, cache marker, fallbacks, and no fallbacks on Haiku
  - stop reasons checked before reading
  - SDK errors mapped to short codes
  - CORS, method, size, JSON, the switch, the in-memory limiter, and refusing to run when the limit rule is missing
  - the Vercel limiter counting each request per install and per IP address against the one rule, and refusing without a client address
  - logs never containing text, headline or install ID
  - a missing key reported as "misconfigured" with no request made
  - the Firewall limiter trusted only on Vercel

  A smoke test also compiled the backend as Vercel's Node runtime would, loaded it as an ES module and called it: the preflight answered 204, a bad request 400, and with no key 500 "misconfigured". That smoke test is what showed `@vercel/firewall` letting everything through outside Vercel, which is now refused.
- Extension: unit tests for the provider cover what's sent (never the address), the 6,000-character cap, shorten once, rewrite once, no third try, fallback when the backend is down, erroring, rate-limited or refusing, and the install ID rotating.
- Browser tests: 113 pass (3 screenshot-only skipped). Seven are new for AI summaries, against a stand-in backend on the test server: the label and summary, the exact fields sent, shorten once, falling back when the backend fails, a paywalled page never sent, switching off stopping requests and deleting the install ID, and the Settings choice.

**Deployed (17 Oct 2026):**
- Vercel project `linkpeek-api` (Hobby plan), root directory `server`, linked to this repository: every push to `main` deploys it.
- Endpoint: `https://linkpeek-api.vercel.app/api/summarise`. That address is public; the team-scoped `*.vercel.app` addresses sit behind Vercel's login (Standard Protection), so use this one.
- Checked against the live endpoint with curl: the preflight answers 204 with `access-control-allow-origin: *`, GET 405, bad JSON 400, a request with a `url` field 400, and a valid request `500 misconfigured`, as designed while there's no rate-limit rule and no key.
- The Hobby plan allows one rate-limit rule per project, so the backend was changed from two rules to one (D39).
- Set up by hand in the dashboards (the Vercel connector here can't change this team's Firewall or secrets): the `summarise` rate-limit rule, the `ANTHROPIC_API_KEY` variable, and a monthly spend limit in the Anthropic Console.
- Production builds now point at the deployed backend by default (`scripts/build.mjs`); `LINKPEEK_API_URL` overrides it, and `LINKPEEK_API_URL=` builds without one.
- Model switched to Haiku 5.5 on 17 Oct 2026: `SUMMARY_MODEL=claude-haiku-5-5` set in Vercel production and the code default changed to match. The default eval on Haiku: 20 of 20 within the limit, 0.63 key-word overlap (Opus: 0.59), 0.0001 dollars a summary on the test articles, median 1.5 s.

**Checked against the live backend, with the key (17 Oct 2026):**
- A real summary came back from Claude Opus 5.5 in 2.4 seconds.
- The rate-limit rule, checked directly at the deployment's rate-limit address (no Claude calls): exactly 30 requests per key, then 429. A rule ID that doesn't exist answers 404, which the backend treats as "refuse".
- 36 real requests from this cloud machine, with a fresh install ID each time, were not stopped. This machine's traffic leaves from at least six IP addresses in turn, so they were spread across that many IP buckets. That's the per-IP limit working as built, and it's also exactly how someone with many addresses gets past it, so the Anthropic spend limit stays the real ceiling.
- The production build in Chromium, with no site permissions granted, called the backend from its own `chrome-extension://` origin and got a summary back (200). The AI option in Settings is available.
- `npm run eval:ai` (`docs/eval/part-06.md`):
  - 20 of 20 articles got a Claude summary, all 20 words or fewer; 3 needed one request to shorten.
  - 0.41 cents a summary (see `docs/cost/part-06-estimate.md` for why real articles will cost more).
  - None of the 3 prompt-injection pages got Claude to follow the planted instruction.
  - Key-word overlap with the hand-written summaries is a tie, 0.62 each. The measure misses the real difference. On the opinion piece, the review and the hedged science story, the free summary picks a sentence that isn't the point ("I have lived in Millbrook for thirty years."), and Claude says what the piece argues or found. Two of the three shortened sentences read clipped, though: "traders lost about a third" (of their trade, the article says) and "nobody hurt, cause unknown".
- The first eval run failed every request without saying so: the unit-test environment imitates a browser, where the Anthropic SDK refuses to start, and the report still counted the injection pages as passed. The eval now runs in plain Node and fails loudly if Claude wrote nothing, the report names the backend's error code, and an injection page counts as passed only if it was summarised. A dry run against a local fake server confirmed 23 requests left before the paid run.
- Spent on Claude today: roughly 20 to 35 cents (the eval about 10, the 36 rate-limit test requests most of the rest; their reply lengths weren't kept). The Anthropic Console's usage page has the exact figure.

**Not done or not verified:**
- The spend limit in the Anthropic Console is set by you; I can't see it from here.
- The full card path (hover a link on a real page, card shows "Summary by AI (Claude):") against the deployed backend. The browser tests cover it against the stand-in, and the real backend was called from the real extension origin, but not both together.
- Vercel's Hobby plan is for personal, non-commercial use. A LinkPeek that earns money needs a paid plan.
- Your check from the build plan, answered 17 Oct 2026: you chose Haiku 5.5 as the model after comparing the Claude and free columns (`docs/eval/part-06.md`, with the Opus and Sonnet runs beside it). AI summaries stay off by default in the extension.

## Part 07. Clickbait tick, cross or neutral (17 Oct 2026, built; not checked with real readers)

**Built:**
- `src/core/clickbait/`: stage 1 reads the headline's wording (strong, medium or weak patterns). Stage 2 reads the full article's study limits and money or percentage figures, and checks the headline against them. The check combines both into one verdict and one reason (D40 to D42).
- A rewrite under a cross, when the full article was read: the summary cut to 15 words, labelled as LinkPeek's, with a note when it may reveal a held-back result (D43).
- The card: the status, the reason, the rewrite, and a "What does this mean?" button that opens the three outcomes (D45). The options page has the same three outcomes.
- The article's facts are kept with each cached result. Nothing from the article's own words is kept (D41, `docs/privacy.md`).
- Labelled sets: `eval/headlines.json` (81 headlines, 33 with a short article), written before the rules, and `eval/headlines-holdout.json` (30 headlines), written after the tuning and never used to change a rule.
- A test page and article for the browser tests: `test-pages/clickbait.html` and `test-pages/articles/mouse-study.html`.

**Tested (actual results):**
- `npm run check`: typecheck, lint, 343 unit tests pass (5 skipped), build, backend 41 pass.
- `npm run test:e2e`: 117 pass, 3 skipped. The new `e2e/clickbait.spec.ts` checks, in Chromium: a withheld headline is a cross and says why; an overstated headline is crossed against a real article ("cures", a study in animals); a plain headline is never a cross and gets no rewrite; the explanation opens and shuts.
- Labelled set, crosses (`docs/eval/part-07.md`):
  - First run, before any tuning (`docs/eval/part-07-first-run.md`): 95% precision, 80% recall. One false cross, five misses.
  - After fixing a percentage bug and two patterns: 100% precision, 92% recall (23 of 25 found, no false cross). These two patterns were tuned on this set, so this is the optimistic figure.
- Held-out set (not used for tuning): 100% precision (9 of 9, no false cross), 90% recall (1 miss). Nine crosses is a small sample.
- Ticks: 69% recall on the labelled set. The check ticks only when a figure in the headline matches one in the article, so plain true headlines are neutral.

**Not done or not verified:**
- The AI version of stage 2 (the plan's option when Part 06 is on). The simple checks are what's built and measured.
- Real readers: no one has read the false crosses yet. The plan's "Your check" is still open for you: read the crosses in `docs/eval/part-07.md`, and say whether any of those publishers would have a fair complaint.
- The labelled sets were written by the same person who wrote the rules, so the numbers are a first check, not a proof. An independently labelled set is the next step.
- The "main claim" check (does the article contain the headline's main claim, beyond figures) isn't built: it needs the article's vocabulary, which we don't keep.
- The date check only sees the page's own published and modified dates. Pages without them can't be checked.
- At 200% zoom in a small window, the card has to fit above its link. A browser test checks the default card, and it fits with about 3 pixels to spare. A longer reason on a cross card would break that, and that case isn't tested.
- One browser test (infinite feed, icon count) failed once in a full run from a scroll race in the test page. It passes alone, three times out of three. Not caused by this part, not fixed.

**Your check:** read the crosses that went wrong in `docs/eval/part-07.md`. The held-out set had no false crosses. The first run's one false cross was a timeline headline, and the rule now lets it through. Would those publishers have a fair complaint?
