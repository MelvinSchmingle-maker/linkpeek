# LinkPeek: full assessment for review

Written 17 Oct 2026 for an outside reviewer (for example, a second AI model or a human engineer). It is self-contained: you should not need the repository to understand the problems, but the file paths point to the code if you have it.

Repository: `melvinschmingle-maker/linkpeek`, branch `claude/eager-darwin-6u5601`.

Please keep three things in mind while you read:

1. **Facts** are marked as recorded results, with the date and the file they come from.
2. **Hypotheses** are marked as such. Nothing in them has been proven.
3. **What we could not test** is listed in section 11. Several results come from one cloud machine, so they may not match a home computer.

---

## 0. What to ask a reviewer for

Suggested request, to paste with this file:

> You are reviewing a Chrome extension called LinkPeek. The brief above says what it should do, what has been tested, and what is known to fail. Please (1) list the likely causes of "most links fail to show an article" in order of likelihood, with the evidence for each; (2) find bugs, security or privacy problems, and policy risks, citing the section and file; (3) say which open decisions in section 7 you would recommend, and why; (4) propose the smallest fix for each bug, and the test that would prove it works; (5) say which of your own claims you are unsure of. Don't assume anything not written here.

---

## 1. What LinkPeek is

LinkPeek is a Chrome extension (Manifest V3). When a user is on a page, or chooses a link, it shows a small card near the link. The card says what the link is about, how it was summarised, who published it, and whether the link looks risky.

Product promises, from the project's rules (`handoff.md`, "Rules to keep"):

- It needs no account. After install it has access to no websites. It asks for access one site at a time, when the user acts.
- It sends no cookies or login details. Requests go out without credentials.
- It never bypasses a paywall, a login, a CAPTCHA or an anti-bot check. It never impersonates a browser or a search engine.
- Page text is data, never instructions.
- It holds no API keys in the extension. The one server key lives in Vercel.
- It warns about risky links. It never says a link is "safe".

Current status: pre-release. It has not been published. The owner is testing it on their own machine.

---

## 2. Architecture

### 2.1 Parts of the extension

| Part | Role | Main files |
|---|---|---|
| Service worker (background) | Receives requests, fetches pages, runs the scanner, owns settings | `src/background/index.ts`, `retrieve.ts`, `redirects.ts` |
| Offscreen document | A hidden page that parses fetched HTML (Readability) and PDFs (pdf.js), because service workers can't parse HTML | `src/offscreen/offscreen.ts`, `messages.ts` |
| Content script | Finds links on the page, shows the card and the reading panel | `src/content/controller.ts`, `card.ts`, `view-model.ts`, `reader.ts`, `annoyance/` |
| Popup and options page | Per-site switches, annoyance tools, feedback export and delete | `src/popup/`, `src/options/` |
| Permission window | Explains and asks for access to one site | `src/permission/` (built into `dist/permission/`) |
| Summary backend | Optional. Calls Claude (Haiku 5.5, per `docs/progress.md` Part 06) to write AI summaries | `server/src/`, deployed to Vercel as `linkpeek-api` |

### 2.2 Builds

- `dist/`: the real build. Installed by users (not yet published).
- `dist-e2e/` and `dist-e2e-on-demand/`: test builds. Access to `127.0.0.1` only. Shadow DOM is open, so tests can read it.
- `dist-live/`: the live-check build. Access to all websites, so it can read real pages without prompts. Also exposes `globalThis.__linkpeekRetrieve` on the service worker.
- `dist-tools/`: the link tester download. Contains `dist-live` and a Node script (section 4.4).

### 2.3 The reading pipeline (what happens when a card needs an article)

1. The content script asks the service worker for a link's result.
2. The service worker checks the link is allowed to be read. A link to the page's own site is fetched in that page. A link to another site needs that site's permission (section 3).
3. The service worker fetches the page (a GET, credentials omitted, with a timeout).
4. The page's HTML goes to the offscreen document, which runs Readability. Each adapter is asked first (none are registered yet).
5. A diagnosis step (`src/core/retrieve/diagnose.ts`) decides why nothing was extracted, if nothing was: paywall, login wall, bot challenge, browser-only (JavaScript) page, and so on.
6. The result gets an evidence level: `full`, `partial`, `headline-only` or `unavailable`.
7. A summary is written: by default, the article's own most informative sentence (extractive, no AI). Optionally by Chrome's on-device AI, or by the backend.
8. Other checks run on the result: a headline check (tick, cross or neutral), a source card (publisher, date, article type, primary sources), and a link safety check (warn, never block).

### 2.4 Link-safety check (Part 11, stage 1 only)

On-device rules in `src/core/security/` look at the address and the link text. They look for lookalike names, brand names beside sign-in words, sign-in pages on other sites, user names in front of addresses, bare IP addresses, mixed alphabets (Punycode), downloads of programs and archives, and link text naming another site. There are five outcomes, none of them "safe". Stage 2 (a threat-list lookup) is **not built**; the service choice is an owner decision (`docs/security-services.md`).

### 2.5 Permissions model in use today

From `docs/permissions.md`:

- Installed with no site access. Permissions: `storage`, `activeTab`, `scripting`, `offscreen`, `contextMenus`, and optional host permissions for `https://*/*` and `http://*/*`.
- Turning on one site ("Turn on" in the popup) asks Chrome for that site only.
- A link to another site, when the page the user is on is different: the card says "LinkPeek needs your permission to read pages on example.com" and offers "Allow access…". This opens a small window, then Chrome's own prompt.
- "Turn on for all websites" in settings asks for all sites at once.

This is the current design. The owner has said the number of prompts is too high, and wants one grant after install (section 5.1).

---

## 3. Status by part

The build plan is in `build-plan/00` to `14`. Each part's notes are in `docs/progress.md`.

| Part | What | Status | Key gaps |
|---|---|---|---|
| 01 | Project setup, builds, tests | Built | None known |
| 02 | Button and card with demo data | Built | Card look is basic (owner says amateurish; deferred) |
| 03 | Link detection and modes | Built | Sites that rebuild their own HTML (D21) |
| 04 | Fetching and reading articles | Built, partly | Listing pages read as articles; JS-built pages; false paywall flags (section 6) |
| 05 | Summary engine, no AI | Built | Some openings wrong (section 6) |
| 06 | AI summaries (backend) | Built, deployed, opt-in | Spend limit to be confirmed by the owner (section 7) |
| 07 | Headline check (tick, cross, neutral) | Built, not checked by readers | Misses "one weird trick" wording and withheld results (section 4.3) |
| 08 | Source card | Built, not checked on the owner's five sites | Ownership and independent coverage not built (D46) |
| 09 | Feedback | Built, nothing sent | Upload is a stub, off and hidden (by design) |
| 10 | Compatibility matrix | Built, 20 scenarios run | See section 4.2 |
| 11 | Link protector, stage 1 | Built | Stage 2 (threat lookup) not built |
| 12 | Annoyance tools and reading mode | Built, tested on fixtures and 10 live pages | Cookie banners not handled (by plan); large bars hidden, not collapsed |
| 13 | Social adapters | Research only | Reddit's terms not read; X's API page returned an error; YouTube conflicts with policy |
| 14 | Measurement and money | Mostly not built, on purpose | Gated on real users, a partner and billing |

The new link tester (`tools/link-tester/`, built 17 Oct) is not part of the plan. It exists so the owner and team can test real links. See section 4.4.

---

## 4. Test evidence

### 4.1 Automated tests (run 17 Oct 2026)

- Unit tests (`npm test`, Vitest): **465 passed, 5 skipped**, across 30 files.
- Backend tests (`npm --prefix server test`): 41 pass (from `handoff.md`).
- Typecheck and lint (`npm run typecheck`, `npm run lint`): pass.
- Browser tests (`npm run test:e2e`, Playwright, Chromium): **142 passed, 3 skipped**, on commit `f5255f9`. Not re-run after later docs-only and tool-only commits.
- One known flaky browser test: the infinite-feed test failed once from a scroll race in its test page, and passed on re-run. Not fixed (`todo.md` section 4).

What these tests cannot show: how a real site behaves. Most of the tests use fixtures (saved pages, local test pages).

### 4.2 Live runs on real websites (dated snapshots, not tests)

From `docs/compat/summary.md` and `docs/compat/part-04-live.md`, 17 Oct 2026, from a cloud machine through a proxy:

- 22 unique pages were run. **13 of 22 came back `full`** (59%).
- **20 of 22** had the correct state. The two wrong ones: NPR (a free quiz labelled "behind a subscription") and the Guardian's UK news page (a listing page read as an article).
- Of the 12 news pages in the Part 04 table, 7 came back `full`.
- Failure reasons across the 22 pages: paywall 3 (one wrong), browser-only 2, robot check 1, HTTP 403 1, no article text 1, login wall 1.
- Every summary shown was 20 words or fewer.
- Summary accuracy was judged by reading only. Ars's opening looks like a pull quote, and arXiv's is the licence note.

Limit: one day, one machine, one network. A home connection gets different answers from some sites.

### 4.3 Headline check (Part 07)

From `docs/eval/part-07.md` and `todo.md` section 4:

- Tuned set: catches 92% of crosses and 69% of ticks, with no false crosses.
- Held-out set: catches 90% of crosses and 67% of ticks, with no false crosses.
- Misses: "one weird trick" wording (held-out case h02), and withheld results with no listed pattern ("What the minister said next", "She opened the box").
- The tuned numbers are the optimistic ones. The team wrote both sets and the rules.

### 4.4 Link tester smoke test (17 Oct 2026, this session)

Run on 11 hand-picked addresses, with the tester's bundled Chromium (`tools/link-tester/`):

- 7 of 11 read in full.
- The Times and The Verge: `partial`, reason `paywall`, showing only the teaser. The Verge's page is free to read, and its structured data says it isn't (known issue, section 7).
- Reddit (old): login wall. Expected.
- **YouTube: robot check from this cloud address.** The Part 04 live run read this page as a preview on 17 Oct. So the cause is probably this machine's address, not the page, but it isn't confirmed.
- arXiv PDF: opening is the licence note (known bug).

**Wrapper probe, one request:** a Facebook link wrapper (`l.facebook.com/l.php?u=...`) with a made-up `h` token sent LinkPeek to `facebook.com/login`, a login wall. The address inside `u` (BBC) read in full. The token was invented, so this does not show what a real post link does. It supports the hypothesis in section 5.2.

Caveat: this smoke test is a sample of ten links, not a measure of success.

---

## 5. The main problem: "most links fail"

### 5.1 What the owner reported (17 Oct 2026)

The owner tried four links from a Facebook post. The talkSPORT link showed: "Couldn't open this article. The page needs to run in a browser tab to show its text." The other three gave no message the owner could report.

Not yet supplied: the full talkSPORT link (the screenshot cut it short), and the other three links with what each card showed. The owner also said they checked three links, and those didn't work. Those three are not in the repository.

From this machine, every talkSPORT path returned a "Verifying Device" robot check. The owner's own machine is the only place to reproduce it.

Also the owner's direct request: one permission grant after install, not a prompt per site (section 7.1).

### 5.2 Hypotheses for the failures, ranked

These are guesses from the design and the probes. None is confirmed.

1. **Per-site permission (most likely, not verified).** A link from a post goes to another website. LinkPeek must ask for that site, and until the user allows it, the card shows "needs your permission", not an article. If the owner saw the card's permission message, or closed the permission window, the result looks like a failure. The owner should check what each card said.
2. **Social wrappers (plausible, probe supports it).** Facebook, Instagram, Reddit, X and Google News send links through a redirect page. In the one probe, Facebook's wrapper led to a login page. LinkPeek has no code to unwrap these links (`grep` finds none in `src/`). The fix is to read the address inside the wrapper, where the wrapper carries one (Facebook and Instagram use `u=`), and to test that.
3. **Pages built in the browser (confirmed for talkSPORT's message; the page itself not reproduced).** The "browser tab" message is the `js-rendered-empty` reason. The owner saw it, so at least one page gave that result on the owner's machine. LinkPeek reads pages without running their scripts (decided D52: show the description, labelled "Preview only").
4. **Robot checks and login walls (plausible).** Some sites demand a human check, or a login, for every automated request. This is worse for social sites.
5. **False paywall flags (confirmed on two sites, could hit others).** NPR and The Verge (section 6).

### 5.3 What the next test should record

For each link the owner tests: the wrapper, the decoded address, the outcome, the reason, and what the card actually said (the `your check` column). The tester does all of this. See `tools/link-tester/README.md`.

---

## 6. Known bugs (not fixed)

From `docs/compat/open-issues.md`, `todo.md` section 6, and this review.

1. **Listing pages read as articles.** Example: the Guardian's UK news front page came back `full`, with a tweet as its opening. Needs a change in extraction. (`src/core/extract/`, Readability output.)
2. **Wrong openings.** Ars's opening looks like a pull quote. arXiv's is the licence note. The opening rule (D29) skips some lines but not these.
3. **False paywall on NPR.** `[id*="piano"]` in `src/core/extract/html.ts` matches NPR's own Piano script and empty slots, so every NPR page can look paywalled. A narrower match would also change how real paywalls are found.
4. **False paywall on The Verge.** Its page carries `isAccessibleForFree: false` in its structured data, though it reads freely in a browser. LinkPeek follows the publisher's flag (D27). The rule for that is an owner decision.
5. **No "No transcript available" message on YouTube.** The plan asks for it. Not built. YouTube's handling is an owner decision first.
6. **The 200%-zoom layout** is tested only on demo cards. Real cards with long reasons or summaries haven't been tested at 200% zoom.
7. **Start-up race in the test helper.** `chrome.storage` was undefined when a helper talked to the service worker too early. It happened once in a browser test and once in the live check, and both passed on re-run. The cause isn't found. **The link tester hit the same race** in this session; the tester now waits for the worker's APIs and retries a read once. A real fix in the extension is still open.
8. **Redirect checks can only see the final address.** Chrome doesn't show each hop to an extension, so the card says only where the link ended up (D54).
9. **Mirror's opening** was a timestamp. Fixed (D29), with a test page and one live check.

---

## 7. Decisions the owner must make

Each has options and a recommendation where one exists. Source: `todo.md` section 3 and `handoff.md`.

1. **Permission model.** (a) One all-sites grant at install, with the existing "Turn on for all websites" as the path; or (b) keep per-site prompts and make them clearer. The owner wants (a). Done means: a new site opens a card with no prompt after the one grant, and `docs/permissions.md` and `docs/decisions.md` record the choice. Note: (a) is a larger permission, which means a bigger install warning and a bigger review burden with browser stores.
2. **NPR's false paywall.** (a) leave it; (b) narrow the selector to exclude NPR's slots by name (quick, but tied to NPR's markup); (c) count only Piano elements that hold text (stops empty slots counting, but a wall filled by script on a short page would then show its teaser, which conflicts with D27). Recommended: (b), with a test.
3. **The Verge's paywall flag on a free page.** Keep trusting the flag (current behaviour), or only trust it when the body is also hidden.
4. **robots.txt.** LinkPeek doesn't read `robots.txt`. talkSPORT's file disallows all agents not listed, and says its content isn't licensed for large language models. (a) Honour robots.txt for each user-triggered read and show a card message when it asks automated tools to stay out; or (b) keep reading as the user's own browser does, and write that choice down. Needs a view from whoever handles legal questions.
5. **YouTube.** LinkPeek fetches youtube.com pages in the background. YouTube's developer policies prohibit scraping (`docs/adapters/youtube.md`, section III.E.6). Proposed: stop fetching youtube.com, and read only the page the user has open.
6. **Threat lookup (Part 11 stage 2).** Not built. Google Safe Browsing's terms forbid commercial use without an agreement. Web Risk's prices were not verified. URLhaus is free for non-commercial use. A service and a budget are needed (`docs/security-services.md`).
7. **Reddit and X.** Not built. Reddit's terms couldn't be read in research, and X's API page returned an error. Both need the owner's go-ahead after the terms are read (`docs/adapters/`).
8. **Headline check's second stage (AI).** Not built. The owner said "ok" to leaving it for later.
9. **"No headline verdict" on every neutral article.** D45 says yes. Changing it is a small edit.
10. **Hosting for money.** Vercel's Hobby plan is for personal, non-commercial use. A paid plan is needed before LinkPeek earns anything (`docs/progress.md`).
11. **Anthropic spend limit.** Confirm the monthly limit is set in the Anthropic Console. `docs/progress.md` says it was set by hand. A separate workspace with its own limit for LinkPeek's key was recommended, and not set.

---

## 8. Risks

### 8.1 Legal and policy

- **Scraping on platforms with terms against it** (YouTube, probably Reddit and X). See decision 5 and 7.
- **Robots.txt and automated reading.** See decision 4.
- **Commercial use** of Google Safe Browsing or Vercel Hobby. See decisions 6 and 10.
- **AI and copyright.** The backend sends article text to Anthropic when a user chooses "remote" summaries (opt-in; D36). The article is fetched by the user's browser, so the publisher sees a normal request. A publisher can still object to summaries of its articles. No legal review has been done.
- **Store policy.** The all-sites permission (decision 1a) will draw review from Chrome Web Store.

### 8.2 Privacy and security

- Feedback stores only the hostname, never the full URL or article text (`src/core/feedback/store.ts`). Nothing is sent. The upload setting is a hidden, off stub.
- The measurement schema refuses URLs, paths, queries and article text (`src/core/measure/events.ts`), and nothing sends it yet.
- Requests from LinkPeek's background code go out without cookies and without credentials.
- **Redirect check.** The "Check where this link goes" action makes one request to the link, after the user asks, and only with that site's access. Reviewers should check this doesn't leak anything.
- The shipped build's card uses a **closed** Shadow DOM. Tests use an **open** one (D11). So the shipped card's behaviour is tested only indirectly.
- The backend allows requests from any origin without cookies (CORS), so the extension can call it without site access. Review its rate limits and abuse controls (D39).

### 8.3 Product

- The card's look is basic. Owner says it looks amateurish. Deferred until the links work.
- The "Facebook post" experience (the owner's report) may be the main reason people give up. Section 5 is the biggest risk.
- The headline check is a judgement, not a fact-check. Its wording must stay careful.

### 8.4 Reliability

- The start-up race (section 6, item 7) can make a read fail for no clear reason.
- The infinite-feed test is flaky (section 4.1).
- Results are a snapshot. Sites change daily, and the live checks can't be reproduced exactly.

---

## 9. Code-level concerns for a reviewer to check

These are things we already suspect or know are fragile. They are not verified bugs.

- `looksJsRendered` in `src/core/retrieve/diagnose.ts`: thresholds (under 50 article words, under 30 body words, an empty app container, or a `<noscript>` asking for JavaScript). Fired on none of 12 real news pages, and on YouTube (which is built in the browser). A short page with a `<noscript>` message is the remaining risk.
- Paywall detection in `src/core/extract/html.ts` relies on selectors such as `[id*="piano"]`. Broad selectors cause false paywalls (section 6).
- `src/background/retrieve.ts`: cache strips the `readable` flag; the flight key includes it. Check the cache can't serve a stale or wrong result across settings changes.
- `src/background/redirects.ts`: 8-second timeout, body cancelled, GET with credentials omitted. Check it cannot be used to probe private addresses. (The IP-address rules and loopback exemption are in `src/core/security/assess.ts`.)
- `src/content/controller.ts`: `apply(settings, full)` with an `applied` field, and a `sameExcept` early return. Two earlier bugs came from here (first apply skipped the scan; refresh skipped the scan). Check for others.
- `src/content/annoyance/filter.ts`: six tools, each undoable, with urgency labels and autoplay pause. Claimed never to hide a login form or consent notice. Check that claim.
- `src/core/measure/independence.test.ts`: a test reads the source of the modules that judge a result, and fails if they import settings or storage. Check the test catches indirect imports.
- The reading panel and the card both use Shadow DOM and must never build DOM from strings (ESLint rule in `eslint.config.js`).
- The link tester (`tools/link-tester/link-test.mjs`) runs LinkPeek's own pipeline through a Playwright-controlled Chromium, using `globalThis.__linkpeekRetrieve` (live build only). It's a test tool, not a product.

---

## 10. Things the team did that you should know about

A reviewer should weigh these, and the owner should decide whether they matter.

1. **A Googlebot user-agent probe to talkSPORT (once).** The project's own rules say never to impersonate a search engine to get past a block (`handoff.md`). This was a diagnostic and it was disclosed. The handoff says it must not be repeated.
2. **About six `curl` requests to talkSPORT** while investigating the robot check. Disclosed.
3. **A Facebook wrapper probe** on 17 Oct, with an invented `h` token. A single request to a public address. No login, no data. Disclosed in `docs/link-testing/log.md`.
4. **The link tester fetches whatever links the user lists.** Its sample list had a YouTube link, which the open YouTube decision says not to fetch. It was removed from the sample file in this round.
5. **Commit attribution.** Commits name "Claude" and not the model. This differs from one instruction in the session (which asked for the model name), because the session's system rules say not to put model identifiers in commit messages. Disclosed.
6. **A stray scheduled reminder** was created and then deleted during the build-out, and one wakeup was armed and stopped. No effect on the code.
7. **Research limits.** Reddit's terms couldn't be read. The X developer page returned an error. The Web Risk pricing page was cut off, so its prices are unverified. Research on what to look for in social links used search results, not the sites themselves, and is marked as such in `docs/link-testing/what-to-look-for.md`.

---

## 11. What could not be tested

- Real links from the owner's Facebook post. The owner has not sent the full talkSPORT link or the other three links.
- Any site from a home connection. Everything came from a cloud machine through a proxy, and some sites react differently to those.
- The owner's own browser and extension install (the permission flow as a user sees it).
- The shipped card at 200% zoom with long real content.
- The shipped build's closed Shadow DOM, directly.
- A full run of the test suite after the latest docs and tool commits (the last full browser run was on `f5255f9`).
- Accessibility (screen readers, keyboard-only use, reduced motion) beyond the keyboard tests in `e2e/feedback.spec.ts`.
- Performance on a slow connection or a long article.
- Any legal opinion. None has been obtained.

---

## 12. File map

| Topic | Where |
|---|---|
| Handoff for a new session | `handoff.md` |
| Full to-do list | `todo.md` |
| Plan and "done when" per part | `build-plan/00` to `14` |
| Decisions D1 to D58 | `docs/decisions.md` |
| What each part built | `docs/progress.md` |
| Permissions | `docs/permissions.md` |
| Privacy | `docs/privacy.md` |
| Compatibility | `docs/compat/` (`summary.md`, `matrix.md`, `open-issues.md`, `part-04-live.md`, `annoyance.md`) |
| Headline check | `src/core/clickbait/`, `docs/eval/part-07.md` |
| Link safety | `src/core/security/`, `eval/urls.json`, `docs/security-services.md` |
| Social adapters | `docs/adapters/`, `src/adapters/` |
| Measurement | `docs/measurement.md`, `src/core/measure/` |
| Link tester | `tools/link-tester/`, `docs/link-testing/` |
| Tests | `src/**/*.test.ts` (unit), `e2e/` (browser), `server/src/*.test.ts` (backend) |
