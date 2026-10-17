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
| 04 Fetching and reading articles | Done |
| 05 Summary engine (no AI) | Done. Summaries of 20 words or fewer: the article's own most informative sentence, or Chrome's on-device AI if you switch it on |
| 06 AI summaries | Built and tested with stand-ins. Needs deploying (`server/README.md`) and a real-model evaluation (`npm run eval:ai`) |
| 07 onward | Not started |

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

http://127.0.0.1:4173/retrieval.html has one link for each thing that can happen when LinkPeek reads a real page: a full article, a short item, a login wall, a paywall, a robot check, error codes, a slow site, a huge page, PDFs and more. These are read for real, not demo data.

To refresh the screenshots in `docs/screenshots/`: `npm run screenshots`.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Build the extension into `dist/` |
| `npm run dev` | Rebuild automatically when files change |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Check code style and banned patterns |
| `npm test` | Unit tests (fast, no browser, no internet) |
| `npm run test:e2e` | Builds two test versions (`dist-e2e/` loads by itself on the test pages; `dist-e2e-on-demand/` only when asked, like any other site) and runs them in a real Chromium |
| `npm run check` | typecheck + lint + unit tests + build, in one go |
| `npm run eval` | Summarises the 20 articles in `eval/articles/` and writes `docs/eval/part-05.md` |
| `npm run eval:ai` | Same articles plus prompt-injection pages, with Claude through the backend code. **Calls Claude and costs money.** Needs `ANTHROPIC_API_KEY`. Writes `docs/eval/part-06.md` |
| `npm run test:server` | The backend's tests (`server/`); needs `npm install --prefix server` once |
| `node scripts/build.mjs --live && node scripts/live-check.mjs` | Reads a list of real web pages with LinkPeek's own code and writes the results to `docs/compat/part-04-live.md`. Needs the internet; not part of the tests |

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

The extension needs none. Production builds use LinkPeek's deployed summary backend (`https://linkpeek-api.vercel.app/api/summarise`) for the optional AI summaries; set `LINKPEEK_API_URL` to use another one, or `LINKPEEK_API_URL=` to build without (`server/README.md`). The backend's own settings, including the Anthropic API key, are in `server/.env.example`. The key never goes in the extension.

## Docs

- `docs/decisions.md`: choices made and why
- `docs/permissions.md`: every browser permission in plain English
- `docs/privacy.md`: what data goes where (today: nowhere)
- `docs/references.md`: official docs relied on
- `docs/progress.md`: what each part delivered and what was tested
