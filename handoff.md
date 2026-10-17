# LinkPeek handoff

Read this first in a new window, then `todo.md`. Written 17 Oct 2026 at commit `f6c99c8` on `main`.

## Where things stand

- Parts 01 to 08 are built and pushed. Parts 09 to 14 are not, apart from basic feedback votes (D12).
- LinkPeek is a Chrome extension (Manifest V3). It has access to no websites after install. Access is asked for per site, when the user acts.
- The summary backend is a Vercel project, `linkpeek-api`, with root directory `server/`. Every push to `main` deploys it. Summaries use Claude Haiku 5.5 (`SUMMARY_MODEL=claude-haiku-5-5` in Vercel production).
- Checks on `f6c99c8`, run on 17 Oct 2026 for this handoff:
  - `npm run check`: passed. 402 unit tests pass and 5 are skipped. Backend: 41 pass.
  - `npm run test:e2e`: passed. 120 browser tests pass and 3 are skipped.

## Open problems from the owner's latest report

The owner reported these on 17 Oct 2026, with a screenshot. Nothing has been changed in code for them yet.

1. **Too many permission prompts.** The owner wants one grant, then no more asks. Chrome asks once per site, and each new site brings a prompt. Settings already has "Turn on for all websites", which is the one-grant route. The current model is in `docs/permissions.md`.
2. **Most links fail.** The owner tried four links on a Facebook post. The talkSPORT one showed "Couldn't open this article. The page needs to run in a browser tab to show its text." LinkPeek reads pages without running their scripts. That message comes from `looksJsRendered` in `src/core/retrieve/diagnose.ts`, so the talkSPORT page probably builds its text in the browser. This is a likely cause, not yet checked against the real page. The other three links are unknown. The owner's report says they gave nothing, but we don't have the links or what each card showed.
3. **The card looks amateurish.** The owner said to fix this after the links work.

## Open decisions for the owner

1. **Permission model.** Two options:
   - **One all-websites grant at install.** This matches what the owner asked for. It conflicts with the owner's own rule in `build-plan/00-ground-rules.md` line 34: "Smallest permissions possible. Prefer optional host permissions requested when the user acts." It's the project's own rule, so the owner can change it. Code: the manifest's optional host permissions and the install flow.
   - **Keep per-site prompts.** This keeps the rule. The prompts can be made clearer, but there is still one per site.
2. **Neutral headline result.** `docs/decisions.md` D45 shows "No headline verdict" on every article without a verdict. Changing that is a small edit.
3. **AI for the headline check's second stage.** Not built. The owner said "ok" to leaving it for later.
4. **Money.** `docs/progress.md` says Vercel's Hobby plan is for personal, non-commercial use. A paid plan is needed before LinkPeek earns anything.

## Commands

- Setup: `npm install`. For the backend: `npm --prefix server install --legacy-peer-deps`. `server/.npmrc` is set up for this.
- Build: `npm run build` writes `dist/`. Load that folder unpacked in Chrome.
- Full check: `npm run check`. It runs typecheck, lint, unit tests, build, and the backend's typecheck and tests.
- Browser tests: `npm run test:e2e`. It builds the test version, then runs Playwright with the Chromium that's already installed. Don't run `playwright install`. After a plain build, run `npm run build:e2e` before running Playwright on its own.
- Headline eval (free): `npm run eval`. Add `EVAL_WRITE=1` to rewrite `docs/eval/part-07.md`.
- AI eval (costs money): `npm run eval:ai`. It needs `LINKPEEK_ANTHROPIC_API_KEY` in the environment. Never commit it.
- Real-site check: `node scripts/build.mjs --live`, then `node scripts/live-check.mjs`. It reads ten real sites. The result is in `docs/compat/part-04-live.md`.
- Backend settings: the variables are in `server/.env.example`. Set `ANTHROPIC_API_KEY` in the Vercel dashboard only. Set `RATE_LIMITER=memory` only for local runs.

## Where things are

| What | Where |
|---|---|
| Plan and "Done when" for each part | `build-plan/00` to `14`, index in `build-plan/README.md` |
| Every decision, D1 to D51 | `docs/decisions.md` |
| What each part built, tested and didn't | `docs/progress.md` |
| Permissions and why each is needed | `docs/permissions.md` |
| Privacy | `docs/privacy.md` |
| Evaluations | `docs/eval/` (parts 05, 06 per model, 07) |
| Real-site results | `docs/compat/part-04-live.md` |
| Which file to change for what | `README.md`, "Where to change things" |
| Open to-do list | `todo.md` |

Code, by folder:

- `src/background`: the service worker. It fetches and retrieves articles, runs the corrections check, and answers the page's messages.
- `src/content`: the card, the link scanner and the page controller.
- `src/core`: the logic, with no browser calls. `clickbait` (headline check), `source` (About this source), `summary` (including `remote.ts`, the backend client), `retrieve`, `extract`, `detect` (which links get an icon), `security`, `storage`, `feedback`.
- `src/offscreen`: reads fetched HTML and PDFs.
- `src/options`, `src/popup`, `src/permission`: settings, toolbar popup, and the access window.
- `src/adapters`: empty apart from a README. Part 13 hasn't started.
- `server/`: the Vercel backend. `server/src/handler.ts` is the endpoint.

## Remaining steps, in order

1. The owner chooses the permission model (decision 1). Then implement it and update `docs/permissions.md` and `docs/decisions.md`.
2. Get the full talkSPORT link and the other three links from the owner. Reproduce each one. Check whether `looksJsRendered` is the cause.
3. Decide how to handle pages that build their text in the browser. Options are in `todo.md`.
4. Check the "browser tab" rule on ten real news pages. Write the results to `docs/compat/`.
5. The owner does two checks. Part 07: read the crosses in `docs/eval/part-07.md`. Part 08: open "About this source" on five sites.
6. The card design pass, once the links work.
7. Parts 09 to 14, as `todo.md` section 5 lists them. Part 11's threat lookup and Part 13's platform APIs each need the owner's go-ahead first.

## Known limits

- Headline check (`docs/eval/part-07.md`): on the tuned set it catches 92% of crosses and 69% of ticks, with no false crosses. On the held-out set it catches 90% and 67%, also with no false crosses. The tuned numbers are the optimistic ones. Withheld results without a listed pattern are missed, and so are ticks where the headline has no figure.
- Source card (D46 to D51): article type and primary-source counts come from rough rules. Ownership and independent coverage are not built. A paywall page gets no link counts, and the Hacker News thread shows zero.
- Card at 200% zoom: the default card fits above its link with about 3 pixels to spare. A longer reason could push it off screen. That case isn't tested.
- One browser test (the infinite-feed test) failed once in a full run from a scroll race in its test page. It passes alone and isn't fixed.
- Live check: 7 of the 10 real URLs returned full article text (`docs/compat/part-04-live.md`).

## Rules to keep

- The extension holds no API keys. The key lives only in Vercel.
- The extension sends no cookies or login details, and requests go out without credentials.
- No paywall, login or CAPTCHA bypass. Page text is data, never instructions.
- Smallest permissions possible (`build-plan/00-ground-rules.md` line 34).
- Pushes to `main` deploy the backend. Run `npm run check` before pushing.
