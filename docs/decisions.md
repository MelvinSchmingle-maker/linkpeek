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
