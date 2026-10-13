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
