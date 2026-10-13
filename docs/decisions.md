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

## D11. Shadow DOM is closed in the real build, open in the test build (Part 02)
Closed means page scripts can't reach into LinkPeek's card to read what you previewed. Playwright can only test inside open shadow roots, so the test build (`dist-e2e/`) uses open. This is the only behaviour difference between the two builds besides the test-server permission.

## D12. Basic feedback stored on the device now (Part 02)
The brief says no button may pretend to work. Instead of fake thumbs, the thumbs save a real vote to `chrome.storage.local`: hostname only, no full URL, no article text, one vote per result, capped at 500 entries. Part 09 adds reasons, export and delete-all. Nothing is sent anywhere.

## D13. "Run on this page" in the popup (Part 02)
Clicking the toolbar icon gives LinkPeek temporary access to that one tab (`activeTab`). The popup's "Run on this page" button uses it to add LinkPeek to the page. It's the start of Manual mode and needs no site permission.

## D14. Warnings change the open link's wording (Part 02)
When a link warning shows, "Open article" becomes "Open link anyway". Downloads and other unsupported links say "Open link", because they aren't articles.

## D15. Link classifier: rules, tuned for precision (Part 03)
A scored rule set (`src/core/detect/classify.ts`), not machine learning. Rules are explainable, fast, and need no data or server. Hard exclusions (navigation, menus, share and ad links, login and account pages, social profiles, files, homepages) then a score from headline-like text, headings, and article-like addresses (dates, long slugs, `/news/`, PDFs). Tuned for precision: an icon on a menu link is more annoying than a missing one, and any link can still be peeked with right-click. Labelled set: 59 examples in the tests, must stay at 95%+ precision.

## D16. In-text links need strong evidence (Part 03)
Article pages have many links inside paragraphs. These only get an icon with a strong article signal (date, long slug or PDF in the address). Otherwise a long article would be covered in icons.

## D17. Sites are switched on one at a time (Part 03)
Smart mode runs by itself only on sites you turn on (Chrome asks each time), or on all sites if you choose that in Settings. Chrome's granted-permission list is the single source of truth. One registered content script follows it. This avoids the "read and change all your data on all websites" warning at install, which puts people off and slows Chrome Web Store review.

## D18. Modes, in plain terms (Part 03)
Smart: icons appear by themselves on sites you've turned on. Scan: icons only after "Scan this page". Manual: no icons; right-click a link or use Alt+Shift+P on a focused link. "Scan this page" works in every mode because it's always the user asking. Scan mode will show tick/cross marks once headline checks exist (Part 07). For now it shows the same icons as Smart, on request.

## D19. Scanning in small time-boxed batches (Part 03)
Links are judged in batches of at most 8 ms of reading and 40 new icons, in idle time, with reads and writes separated. Measured on a 1,200-link page: all 200 headline icons in about 0.4 s, slowest batch about 12 ms, no long tasks. Link text is read with `textContent`, which avoids forcing layout.

## D20. Real links say "can't read articles yet" (Part 03)
Until Part 04, clicking the icon on a real (non-demo) link opens a card that says plainly it can't read articles yet. Nothing pretends to work.

## D21. Known risk: sites that rebuild their own HTML (Part 03)
LinkPeek inserts its icon right after a link. Sites built with React and similar tools may occasionally remove it when they redraw. The scanner notices and puts it back. A site could in theory complain about the extra element during start-up. Tested on our single-page-app page; to be checked on real sites in Part 10.
