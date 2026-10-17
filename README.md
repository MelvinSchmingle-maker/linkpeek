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
| 06 AI summaries | Done. Deployed at `linkpeek-api.vercel.app`, Claude Haiku 5.5 by default. Measured in `docs/eval/part-06.md` |
| 07 Clickbait tick, cross or neutral | Built. Headline checks with one reason each, from the headline alone or with the article. Measured on a labelled set and a held-out set (`docs/eval/part-07.md`); the held-out numbers are small, so read them as a first check, not a guarantee |
| 08 Source card ("About this source") | Built. Publisher, dates, author, article type and links to primary sources, each with where it came from, plus a corrections-page check on request. Measured on the test pages and five real sites (`docs/compat/part-04-live.md`) |
| 09 Feedback buttons | Built. Thumbs up and down, optional reasons for a thumbs-down, "Disagree with this rating?" on headline checks, and a settings section to count, export or delete your votes. Stored on this device only; nothing is sent |
| 10 Compatibility matrix | Built, with 20 scenarios run (`docs/compat/matrix.md`). The summary and the open issues are in `docs/compat/summary.md` and `docs/compat/open-issues.md`. One real failure (listing pages read as articles) is open |
| 11 Link protector, stage 1 | Built. On-device checks on the link's address and text: lookalike domains, mismatches, IP addresses, downloads, sign-in pages on other sites. Warns, never blocks, never says "safe". "Don't warn me on this site" and "Check where this link goes" (asks the site once, on request). Stage 2, the threat lookup, is not built: see `docs/security-services.md` |
| 12 Annoyance tools and reading mode | Built. Six separate tools, off by default, each undoable: reading mode ("Read here"), sign-up boxes, floating videos, large sticky bars, urgency labels, autoplay with sound. Settings for all sites and per site. Ten real pages checked (`docs/compat/annoyance.md`); a person still needs to look at them |
| 13 Social adapters | Research only. Reddit, YouTube, X, Facebook and Instagram are written up in `docs/adapters/`. None is built. YouTube's rules conflict with how LinkPeek reads pages today: an owner decision |
| 14 Measurement and money | Mostly not built, on purpose: each part waits for real users, a partner or a billing decision. The schema for usage counts exists, with a guard against URLs and article text. See `docs/measurement.md` |

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

http://127.0.0.1:4173/clickbait.html has headlines to check against their articles (Part 07), and http://127.0.0.1:4173/source.html has links to articles with source facts, and "About this source" on each card (Part 08).

To refresh the screenshots in `docs/screenshots/`: `npm run screenshots`.

## Where to change things

The app is small enough to change by hand. Each of these is one place:

| To change | Edit |
|---|---|
| Any sentence the user reads (labels, reasons, notes, definitions) | `src/core/messages.ts` |
| How the card looks (colours, spacing, type) | `src/content/styles.css` (colours are variables in `src/ui/theme.ts`) |
| Layout of the card: what comes first, what is a line, what is a panel | `src/content/card.ts` (`renderCard`) |
| What the card shows for each result, in which states | `src/content/view-model.ts` |
| The headline check's patterns and thresholds | `src/core/clickbait/rules.ts` (wording) and `check.ts` (combining) |
| Which pages count as primary sources, or what counts as sponsored or opinion | `src/core/source/primary.ts` and `article-type.ts` |
| The addresses the corrections check tries | `src/core/source/corrections.ts` (`CORRECTIONS_PATHS`) |
| Which brands, shorteners, risky file types and sign-in words the link check uses | `src/core/security/lists.ts` (test the result in `eval/urls.json`) |
| The link check's rules (lookalikes, mismatches, IP addresses, downloads) | `src/core/security/assess.ts` |
| What the annoyance tools look for (sign-up boxes, urgency wording, consent words) | `src/content/annoyance/patterns.ts`; the actions are in `filter.ts` |
| The annoyance tools' names and hints | `src/content/annoyance/labels.ts` |
| The reading panel | `src/content/reader.ts` |
| The reasons offered after a thumbs-down | `src/core/feedback/store.ts` (`FEEDBACK_REASONS`); wording in `src/core/messages.ts` |
| A platform adapter (Part 13) | `src/adapters/` (none is registered; see `docs/adapters/`) |

After any change, `npm run build` again, then reload LinkPeek at `chrome://extensions` and try the test pages.

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
| `npm run eval` | Summarises the 20 articles in `eval/articles/` and writes `docs/eval/part-05.md`. Also checks the headline check on `eval/headlines.json` and `eval/headlines-holdout.json`, writing `docs/eval/part-07.md` |
| `npm run eval:ai` | Same articles plus prompt-injection pages, with Claude through the backend code. **Calls Claude and costs money.** Needs `ANTHROPIC_API_KEY`. Writes `docs/eval/part-06.md` |
| `npm run test:server` | The backend's tests (`server/`); needs `npm install --prefix server` once |
| `node scripts/build.mjs --live && node scripts/live-check.mjs` | Reads a list of real web pages with LinkPeek's own code and writes the results to `docs/compat/part-04-live.md`. Needs the internet; not part of the tests |
| `node scripts/build.mjs --live && node scripts/annoyance-live.mjs` | Turns every annoyance tool on for ten real pages, and writes what changed to `docs/compat/annoyance.md`. Measures; it can't judge whether a site still works for a person |

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
