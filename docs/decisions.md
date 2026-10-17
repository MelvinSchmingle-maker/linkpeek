# Decisions

Short records of choices made, newest last. Each says what, why, and how to undo it.

## D1. Chrome Manifest V3, TypeScript, Vite (Part 01)
Chrome only accepts new extensions on Manifest V3. TypeScript catches mistakes before they reach users. Vite builds fast and is widely used. Reversible: the code is plain TypeScript and doesn't depend on Vite features.

## D2. Three separate builds, no extension framework (Part 01)
Chrome needs the content script as one classic script, the service worker as a module, and the popup/options as normal pages. `scripts/build.mjs` runs Vite three times to produce exactly that. We didn't use an extension build plugin (such as CRXJS) because it's one more dependency that can break, and the plain script is about 80 lines anyone can read.

## D3. No React (Part 01)
The in-page UI is a tiny icon and a small card. Plain TypeScript and DOM code is enough and keeps the content script small (it loads on every allowed page). Revisit if the options page grows complicated.

## D4. Name, colours and manifest text come from `src/brand.json` (Part 01)
"LinkPeek" is a working name. Renaming means editing one file and replacing the icons.

## D5. In-page UI inside a Shadow DOM, never built from HTML strings (Part 01)
A Shadow DOM stops the website's CSS from breaking our card, and ours from breaking theirs. Lint bans `innerHTML`/`outerHTML` because headline and page text are untrusted and must only ever be inserted as text.

## D6. Start with no host permissions (Part 01)
At install LinkPeek can't see any website. It gets access to a tab when you click it (`activeTab`), and later to sites you choose. See `docs/permissions.md`. Fewer warnings means more trust and an easier Chrome Web Store review.

## D7. A separate test build for browser tests (Part 01)
Automated tests can't click Chrome's permission prompts. `npm run test:e2e` builds `dist-e2e/` with access to `127.0.0.1` only. The real build never has it.

## D8. TypeScript 6.0, not 7 (Part 01)
The linter (typescript-eslint) supports TypeScript below 6.1 as of Oct 2026. Upgrade when it supports 7.

## D9. Placeholder icon (Part 01)
A simple eye on a blue square, rendered by `scripts/make-icons.mjs`. Replace before publishing. LinkPeek uses blue (`#3b5bdb`) so it reads as a tool, not a warning, and so red and green stay free for the tick and cross.

## D10. The card floats over the page (Part 02)
The card uses `position: fixed` just under the link, so opening it never pushes the article around. It follows the link on scroll and resize, and flips above the link when there's no room below. Known limit: a page that applies CSS `zoom` to its own body (rare) could misplace it. Normal browser zoom (Ctrl +/-) is tested and works.

## D11. Shadow DOM is closed in the real build, open in the test builds (Part 02, corrected after review)
Closed means page scripts can't reach into LinkPeek's card to read what you previewed. Playwright can only test inside open shadow roots, so the test builds use open. All the differences between the test builds and the real one, so nobody mistakes test coverage for coverage of the real thing:
- open instead of closed Shadow DOM;
- access to `127.0.0.1` and `demo.test` baked in (no permission prompt);
- `dist-e2e/` also has Chrome add LinkPeek to those pages by itself; `dist-e2e-on-demand/` doesn't, so it behaves like any site you haven't turned on;
- the popup accepts `?tab=<id>`, so tests can point it at a tab;
- the page's `<html>` gets `data-linkpeek-max-batch-ms` and `data-linkpeek-icons` (timing for the speed test);
- the service worker reads `e2eSiteAllowed` from storage, so tests can play "site turned on / not turned on".
Because the test-server access is baked in, the real "turn a site on" path (Chrome's prompt, registering the site script, keeping it across restarts) never runs in the automated tests. See "Not verified" in `docs/progress.md`.

## D12. Basic feedback stored on the device now (Part 02)
The brief says no button may pretend to work. Instead of fake thumbs, the thumbs save a real vote to `chrome.storage.local`: hostname only, no full URL, no article text, one vote per result, capped at 500 entries. Part 09 adds reasons, export and delete-all. Nothing is sent anywhere.

## D13. "Run on this page" in the popup (Part 02)
Clicking the toolbar icon gives LinkPeek temporary access to that one tab (`activeTab`). The popup's "Run on this page" button uses it to add LinkPeek to the page. It's the start of Manual mode and needs no site permission.

## D14. Warnings change the open link's wording (Part 02)
When a link warning shows, "Open article" becomes "Open link anyway". Downloads and other unsupported links say "Open link", because they aren't articles.

## D15. Link classifier: rules, tuned for precision (Part 03)
A scored rule set (`src/core/detect/classify.ts`), not machine learning. Rules are explainable, fast, and need no data or server. Hard exclusions (navigation, menus, share and ad links, login and account pages, social profiles, files, homepages) then a score from headline-like text, headings, and article-like addresses (dates, long slugs, `/news/`, PDFs). Tuned for precision: an icon on a menu link is more annoying than a missing one, and any link can still be peeked with right-click. Labelled set: 87 examples in the tests (as of 14 Oct 2026), must stay at 95%+ precision; the figure is printed by `npm test`. Since the October review a link also needs at least one structural sign of being an article (D22).

## D16. In-text links need strong evidence (Part 03)
Article pages have many links inside paragraphs. These only get an icon with a strong article signal (date, long slug or PDF in the address). Otherwise a long article would be covered in icons.

## D17. Sites are switched on one at a time (Part 03)
Smart mode runs by itself only on sites you turn on (Chrome asks each time), or on all sites if you choose that in Settings. Chrome's granted-permission list is the single source of truth. One registered content script follows it. This avoids the "read and change all your data on all websites" warning at install, which puts people off and slows Chrome Web Store review.

## D18. Modes, in plain terms (Part 03)
Smart: icons appear by themselves on sites you've turned on. Scan: icons only after "Scan this page". Manual: no icons; right-click a link or use Alt+Shift+P on a focused link. "Scan this page" works in every mode because it's always the user asking. Scan mode will show tick/cross marks once headline checks exist (Part 07). For now it shows the same icons as Smart, on request.

## D19. Scanning in small time-boxed batches (Part 03)
Links are judged in batches of at most 8 ms of reading and 40 new icons, in idle time, with reads and writes separated. Measured on a 1,200-link page: all 200 headline icons in about 0.4 s, slowest batch about 12 ms, no long tasks. Link text is read with `textContent`, which avoids forcing layout.

## D20. Real links say "can't read articles yet" (Part 03)
(Replaced in Part 04 by real reading, D24 onward.)
Until Part 04, clicking the icon on a real (non-demo) link opens a card that says plainly it can't read articles yet. Nothing pretends to work.

## D21. Known risk: sites that rebuild their own HTML (Part 03)
LinkPeek inserts its icon right after a link. Sites built with React and similar tools may occasionally remove it when they redraw. The scanner notices and puts it back. A site could in theory complain about the extra element during start-up. Tested on our single-page-app page; to be checked on real sites in Part 10.

## D22. Review fixes, October 2026 (Parts 01 to 03)
A multi-agent review (four reviewers, each finding then checked by a sceptic who tried to disprove it) confirmed 37 findings, about 30 distinct problems. The design changes that came out of it:
- **Start-up order.** The content script listens for messages immediately, but handles none until its first set-up is done. Before, the first right-click peek or scan on a page was usually lost or undone (reproduced 18 times in 20).
- **Smart mode only where you turned it on.** When LinkPeek is added to a page on demand (a peek or a one-off scan), it asks the service worker whether the site is turned on and only scans by itself if so.
- **Demo data only on the local test server.** `data-linkpeek-demo` is ignored everywhere except `127.0.0.1` and `localhost`, so a real website can't make LinkPeek show a "Headline check passed" tick on its own links.
- **Harder for pages to switch LinkPeek off or restyle it.** The "already running" check can't be fooled by a page element with the same id; host elements use their own tag names so page frameworks can't reuse them; their styles are `!important` inline styles, which beat page CSS. (Round two found gaps in this; see D23. A page still controls its own DOM and can always remove our elements outright.)
- **Wait for the page to settle before the first automatic scan** (load, then 300 ms without changes, at most 3 s). Adding icons while a React or similar site is still "hydrating" its HTML can make it throw the page away and rebuild it. A later fix would be drawing icons in an overlay instead of next to links; not done yet.
- **Escape and focus belong to the page** unless you're in LinkPeek's card. Focus moving to the page closes the card.
- **Classifier needs a structural signal.** Wordy link text alone isn't enough; the link also needs a heading, an article block, a date, a readable title in its address, a PDF, an article-style path or a story number. Addresses with commit hashes and document IDs no longer count as titles. Shop product pages, code-host objects, wiki category pages, "Continue reading", "Leave a comment", "245 comments" and links into comment sections are excluded. Page sidebars count against a link. Chinese, Japanese and Thai headlines are word-counted properly.
- **Site permissions.** "Turn back on" asks for `https://` and `http://` separately (Chrome refuses a combined pattern). Unticking "all websites" keeps the sites you turned on one by one. The Chrome Web Store counts as a page LinkPeek can't run on.
- **Right-click peeks** go to the frame the link is in, use the exact link that was right-clicked, and show a "?" on the toolbar button for a few seconds when they can't work.

## D23. Second review round, October 2026
A second multi-agent round re-tested every finding against the fixed code (27 of 37 confirmed fixed, 10 only partly) and hunted the fixes for new bugs (12 confirmed). What changed as a result:
- **Host tag names have a random part per page** (`linkpeek-icon-k3x9a`). With fixed names a page could define `linkpeek-icon` itself and get hold of our closed shadow root through `ElementInternals`. If a page defines the name anyway, LinkPeek picks another one, and after five tries falls back to plain `span`/`div` hosts.
- **Page CSS:** the colour variables and the host's `::before`/`::after` are set `!important` inside the shadow tree, which beats the page even when the page uses `!important`. The card's text direction is fixed. Icons no longer force `visibility: visible`, so an icon in a hidden carousel slide stays hidden with its link.
- **Calls into page DOM go through the prototype** (`Element.prototype.matches.call(...)` and similar), because a `<form>` with an input named `matches`, `contains` or `localName` hides those methods. One bad link can no longer stop a scan: each link is handled in its own `try`, and the scanner always reschedules.
- **Icons stay put when only a link's text changes** ("updated 2 min ago"), so keyboard focus isn't lost. An icon counts as "in place" if it's after its link in the same parent with no other link in between, so a page that keeps its own badge next to the link no longer causes an endless remove-and-insert loop. If the page keeps removing an icon, LinkPeek gives up on that link after three tries.
- **The first-scan wait is capped from the start** (3 s), not from the `load` event, which some pages never fire.
- **One icon per story:** within an article, card or list item, a second link to the same address doesn't get its own icon.
- **Classifier:** shop-product exclusions apply only on shop sites (plus Amazon's distinctive `/dp/` ids), so news sections like Law360's `/ip/` are fine; furniture segments are excluded wherever they appear (`/news/newsletters`), unless what follows leads to content; Hindi, Bengali and Thai addresses count as readable titles; screen-reader text is skipped but `aria-hidden` text isn't (it's what sighted readers see); a link that is most of its paragraph counts as a title line.
- **Old copies after an update** check every 5 seconds whether they're still the live copy (a property read, no messages) and remove their icons if not. Clicking a dead copy's icon also cleans up instead of opening a card.
- **Frames:** before any peek the service worker closes cards in every frame of the tab, so only one card is ever open. The shortcut adds LinkPeek to every frame it may run in and only the frame where a link has focus answers.
- **"Turn off" marks survive "all websites" being unticked.** The service worker only clears a site's "off" mark when the user has just pressed "Turn on" for that site (a short-lived note in storage), not whenever access is granted.
- **Popup** listens for changes at the top level, so it updates while open and doesn't pile up listeners.
- **Still not done:** drawing icons in an overlay instead of inserting them next to links. Until then, a site that "hydrates" its server-rendered HTML more than about 0.3 s after load (with no DOM changes before) can still be disturbed by our icons. See `docs/progress.md`.

## D24. Who fetches the article (Part 04)
An extension can only fetch a page from a site it has access to, and after install LinkPeek has none. So:
- **A link on the same site as the page** is fetched by LinkPeek's script inside the page, which may fetch from its own site. No extra permission.
- **A link to another site** needs access to that site. The card says so and offers "Allow access…", which opens a small LinkPeek window with "Allow this site", "Allow all websites" and "Not now". Chrome then shows its own prompt. The window says that allowing a site also turns LinkPeek on there, because Chrome's granted list is the single source of truth for both (D17). Once granted, the open card tries again by itself.
- **Sites LinkPeek already has access to** are fetched by the service worker.
- **A link to the page you're on** is read from the page itself, not fetched again.

No LinkPeek server. A server could fetch any site without asking, but it would see every link people preview and would cost money per request. Revisit if the permission step turns out to stop most people (Part 10 should measure it).

Every fetch leaves out cookies and logins (`credentials: 'omit'`), sends no referrer, skips the HTTP cache, waits at most 8 seconds per try and reads at most 3 MB of HTML or 10 MB of PDF. It retries once, and only after a dropped connection or a timeout. A refusal (403), a rate limit (429) or a robot check is never retried. Asking again is how a scraper behaves.

Known limit: a page's own Content Security Policy can stop the in-page fetch for same-site links. That shows as "couldn't reach the site", and allowing the site fixes it.

## D25. Reading pages in an offscreen document (Part 04)
Service workers have no DOM, and Readability needs one. A hidden offscreen document (`chrome.offscreen`, reasons `DOM_PARSER` and `WORKERS`) parses fetched HTML with `DOMParser`, which never runs the page's scripts or loads its images, and runs Mozilla Readability on a copy. PDFs go to pdf.js in the same document, first 15 pages only, with font loading and XFA forms switched off (the extension's own security policy blocks `eval` anyway). The document closes after 2 minutes without work. Page text is data: it's put on the card with `textContent`, never as markup, and never treated as instructions.

## D26. What counts as reading the article (Part 04)
- **Full:** Readability found 150 words or more. The card shows the opening sentence, labelled as such, because summaries come in Parts 05 and 06.
- **Partial:** less than that, a PDF read only in part, or a page with only a description. The card shows a preview and says it isn't the full article.
- **Unavailable:** with a reason. Problems are checked before content, in this order: robot checks, being sent to a login page, HTTP errors, login forms, subscription walls, pages that only build themselves with JavaScript. So an error page or a login page is never summarised as if it were the article.

150 words is a guess, chosen so that short news items and link pages don't pass as full articles. Part 10's live testing should check it.

## D27. Paywalls (Part 04)
When the publisher's own structured data says the page isn't free (`isAccessibleForFree: false`, on the page or on a part of it), LinkPeek shows only the publisher's public description, even when the full text is in the HTML (it often is, for search engines). It never shows body text from such a page, and never tries to get round a paywall, login or robot check.

## D28. Remembering results (Part 04)
Results are kept for 24 hours, at most 60, in `chrome.storage.session`, which Chrome keeps in memory only and clears when the browser closes. Passing problems (timeouts, dropped connections, rate limits, missing permission) aren't kept, so the next try asks again. The cache key leaves out `#fragments` and tracking parameters (`utm_*`, `fbclid`, `gclid` and similar). Two requests for the same article at once share one fetch.

## D29. The opening sentence, after the live check (Part 04)
The live check (`docs/compat/part-04-live.md`) found that Readability's text alone gave the wrong opening on three of seven readable sites. The opening is now the first paragraph of six words or more that isn't in a table, figure, caption, aside or hidden label, with footnote markers removed. If Readability started part-way through an `<article>` that's split into identical blocks (BBC News), LinkPeek starts from the first block instead. Only paragraphs laid out exactly like Readability's first one count, so a standfirst isn't mistaken for the opening. The card's label says "The text begins", not "The article begins", because a link can lead to a discussion or a reference page.

## D30. What counts as a word (Part 05)
One rule, in `src/core/summary/wordcount.ts`, used everywhere a summary's length is checked. Words are separated by whitespace. A hyphenated word, a number with its symbols ("£3.5bn", "12%", "1,000") and an abbreviation ("U.K.") each count as one. Punctuation on its own isn't a word. An em dash, or an en dash between words, separates them, but "3–2" is one. Scripts written without spaces (Chinese, Japanese, Thai and others) are split by the browser's word segmenter.

## D31. The 20-word limit is enforced, never fudged (Part 05)
A summary over 20 words is never shown. The provider may be asked once to shorten it. After that it's cut at a clause boundary so that what's left is a whole sentence, with a full stop and never "...". First choice is a comma, semicolon, "and" or "but". Failing that, just before a dependent clause ("after...", "which...", "with...", and "that" after a noun but not after "said" or "suggests"). Of the cuts that work, the one that keeps the most words wins. A cut is refused when it would leave:
- a lead-in on its own ("After the vote on Tuesday.")
- a dangling word ("...at the.")
- an open quote or bracket
- a clause split in the middle ("as energy." from "as energy and packaging costs rose")
- a range split in two ("between 2022.")
- a list item ("roads, bridges.")
- a subject with an aside and no verb ("The Granary, which opened in September.")
- a "so ... that" broken off ("patched so often.")

If no cut works, the provider tries its next candidate, and if nothing fits the card says so and shows where the text begins. The evaluation set (D33) found every one of these cases. The plan only listed commas, semicolons, "and" and "but", and with those alone a long opening sentence with no comma always failed. That's why dependent-clause cuts were added.

## D32. Default summaries are the article's own words (Part 05)
The free default picks the most informative sentence from the first 12 paragraphs. The opening sentence starts ahead, because news puts the point first. Sentences gain for sharing the headline's key words, carrying numbers or names, and being 10 to 30 words long. They lose for needing the sentence before ("He said...", "This means..."), for opening with a quote, and for being a question. Filler openers and the headline repeated back are rejected. The card labels it "In the article's own words:", because LinkPeek chose the sentence but didn't write it. Known weak spots, from the evaluation:
- An opinion piece gets its opening anecdote, not its argument.
- A review gets a detail, not the verdict.
- A science story with a long opening sentence gets a sentence about the method.
- A PDF can have its title run into the first sentence (dropped only when the PDF declares the same title).

All of these are true sentences from the article, never invented ones.

## D33. An evaluation set, and what it measures (Part 05)
There are 20 fictional, self-written articles in `eval/articles/` (two of them in French and Spanish), with hand-written expected summaries in `eval/expected.json`. They cover leads that open on a quote, a question, a byline, a hedged science finding, an allegation, a sports result, an opinion and a review. `npm test` fails if any output is over 20 words, starts with filler, ends in "..." or is missing. `npm run eval` also writes `docs/eval/part-05.md` with each summary next to the expected one and a key-word overlap score. The overlap rewards the right facts and names; it says nothing about whether a summary reads well, so it's reported, not used as a pass mark. Generator: `scripts/make-eval-articles.py`.

## D34. Chrome's on-device AI is opt-in (Part 05)
Chrome's Summarizer API (stable since Chrome 138) writes summaries on the computer with Gemini Nano, for free, without sending the text anywhere. It needs a desktop with at least 22 GB of free disk space and a capable GPU or 16 GB of RAM, so many computers can't run it. It's off by default, and switched on in Settings, which says whether this computer can run it and offers the one-time model download (Chrome only downloads after a click). It runs in the offscreen document, because the API isn't available in workers. It only runs when the model is already there, asks for a "headline" summary of about 17 words, and asks once for a shorter one if needed. The result passes the same limit and quality checks, and if anything fails the free sentence pick is used instead. The card labels it "Summary by Chrome's AI, on this computer:". It is unit-tested against a stand-in for the API only. The Playwright browser has no model, so it has not been tried with the real one (see `docs/progress.md`). Switching engine clears remembered results, so the next card uses the new engine.

## D35. AI summaries through a small backend (Part 06)
"LinkPeek's AI" sends the article text to LinkPeek's own backend (`server/`, one Vercel function), which asks Claude. The API key lives only on the backend: anyone can unpack an extension. It's off by default and chosen in Settings next to the two free options. The card says "Summary by AI (Claude):". The extension checks every reply like any other summary:
- Over 20 words: it asks once for a shorter one, then trims at a clause or drops it.
- Filler, a question or the headline repeated: it asks once for a rewrite and says what was wrong.
- Down, slow, rate-limited or refused: it uses the free summary.

## D36. What the backend gets, and what it keeps (Part 06)
It gets the article's first 6,000 characters, the link text, the evidence level, the page's language and a random install ID. That's half the backend's 12,000 limit and half the cost; an article's point is near the top. It doesn't get the page's address: the summary doesn't need it, and addresses can carry tokens. The install ID is 128 random bits made on the device, used only for rate limits, replaced every 30 days and deleted when AI summaries are switched off. The backend validates strictly (unknown fields are a 400), stores no text and logs only status, timing and token counts. CORS allows any origin without cookies, so the extension needs no extra site permission. Nothing relies on who the caller is.

## D37. Model and request settings (Part 06)
- **Model:** `claude-haiku-5-5` by default, chosen by the owner on 17 Oct 2026 after the measured comparison in `docs/cost/part-06-estimate.md`. On the 20 evaluation articles it matched Opus 5.5's sentences closely at about 1/40th of the cost per summary and the same speed. Opus 5.5 is one setting away (`SUMMARY_MODEL`) and is what the first measured run used.
- **Effort and length:** effort is "low" (thinking can't be switched off on Opus 5.5, and effort bounds it), and `max_tokens` is 1024. Hitting the limit counts as a failure, never a cut-off summary.
- **Caching:** the fixed system prompt (about 725 tokens, over the 512-token minimum) carries a cache marker.
- **Refusals:** the stop reason is checked before the reply is read. `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) lets the API retry a declined request on Anthropic's recommended model. Haiku 5.5, the default, has no server-side fallback, so it isn't sent there, and a refused request shows the card's free sentence instead.
- **Timeouts:** 15 seconds with one retry, inside a 30-second function limit.

## D38. Prompt injection (Part 06)
Article text is data. It's wrapped in `<article>` tags, any of our own tag names inside it are stripped (so a page can't close the article early or add a task), and the instructions say plainly not to follow anything inside. The output is limited to one sentence of 20 words or fewer, re-checked by the extension and shown as plain text. Three test pages in `eval/injection/` plant instructions in the open, in hidden text and with fake closing tags; `npm run eval:ai` checks Claude doesn't follow them. Readability already drops hidden text, which defends against the second kind before Claude sees it.

## D39. Rate limits and spend ceilings (Part 06)
The endpoint is public and every request costs money. The defences, from outside in:
- One Vercel Firewall rate-limit rule, `summarise`, checked from code with `@vercel/firewall` twice per request: keyed by install ID, then by IP address. Each gets its own bucket of the rule's size (30 per 10 minutes to start). No database is needed. If the rule is missing the backend refuses requests rather than run unguarded.
- A switch: `SUMMARIES_ENABLED=false`.
- The real ceiling: a monthly spend limit in the Anthropic Console.

An install ID is easy to fake, which is why the IP count exists: one machine making up fresh IDs still hits its address's limit. The first design had a second rule, one bucket for everyone. Vercel's Hobby plan allows one rate-limit rule per project (checked 17 Oct 2026), so that went. Many machines together can still add up, and only the Anthropic spend limit stops that. A paid Vercel plan would allow the shared bucket back. Outside Vercel, `@vercel/firewall` lets every request through and only logs a warning (seen in a smoke test, 17 Oct 2026). So the backend only uses it when Vercel's own `VERCEL=1` is set, uses an in-memory limiter only when `RATE_LIMITER=memory` is chosen for local runs, and otherwise refuses every request.

