# LinkPeek

A Chrome extension that helps you decide whether a link is worth opening.

**Understand the link. Check the risk. Control the experience.**

> Status: early prototype. See "What works today" below. Nothing here is a finished product, and any result marked "Demo data" is a made-up example, not a real assessment.

## What works today

| Part | Status |
|---|---|
| 01 Project setup | Done |
| 02 Inline button and card (demo data) | Done |
| 03 Link detection and modes | Done |
| 04 onward | Not started |

The build plan is in `build-plan/`. Each file there is one stage.

## Install the extension (unpacked)

You need [Node.js](https://nodejs.org) 22 or newer.

1. Open a terminal in this folder and run:
   ```
   npm install
   npm run build
   ```
   This creates a `dist` folder. That folder is the extension.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `dist` folder.
5. Pin LinkPeek from the puzzle-piece menu and click its icon. You should see "Installed".

After changing code, run `npm run build` again and click the reload arrow on LinkPeek's card in `chrome://extensions`.

## Try it on the test pages

```
node scripts/serve-test-pages.mjs
```

Then open http://127.0.0.1:4173/news-front.html in Chrome, click the LinkPeek toolbar icon and press **Scan this page** (or **Turn on** to have it run there by itself). Small eye icons appear next to the demo headlines. Click one to see the card. The test pages contain no real news, and every result there is tagged "Demo data".

To refresh the screenshots in `docs/screenshots/`: `npm run screenshots`.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Build the extension into `dist/` |
| `npm run dev` | Rebuild automatically when files change |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Check code style and banned patterns |
| `npm test` | Unit tests (fast, no browser, no internet) |
| `npm run test:e2e` | Builds a test version into `dist-e2e/` and runs it in a real Chromium |
| `npm run check` | typecheck + lint + unit tests + build, in one go |

The browser tests use the Chromium that comes with Playwright. If it isn't installed on your machine, run `npx playwright install chromium` once.

## Project layout

```
src/
  brand.json, brand.ts   name and colours (rename the product here)
  background/            service worker
  content/               runs inside web pages: icon, card
  popup/, options/       the toolbar popup and settings page
  core/                  one folder per job (see src/core/README.md)
  adapters/              platform-specific code (later)
scripts/                 build, icons, local test server
test-pages/              local pages for trying LinkPeek
e2e/                     real-browser tests
docs/                    decisions, permissions, privacy, references
build-plan/              the staged build plan
```

## Configuration

None yet. No API keys, accounts or environment variables are needed. When a later part needs one, it will be listed here and in `.env.example`.

## Docs

- `docs/decisions.md`: choices made and why
- `docs/permissions.md`: every browser permission in plain English
- `docs/privacy.md`: what data goes where (today: nowhere)
- `docs/references.md`: official docs relied on
- `docs/progress.md`: what each part delivered and what was tested
