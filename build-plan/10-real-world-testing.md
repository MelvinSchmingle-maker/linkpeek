# Part 10. Real-world testing and the compatibility matrix

## Goal
Find out what really works. No new features in this part, only testing, measuring, and fixing what testing finds.

## Build
- `docs/compat/matrix.md`, one row per scenario, columns: site or platform, content type, accessible?, link detected?, full or preview?, extraction method, summary accurate?, word limit respected?, correct state shown?, handled safely?, known limitations, date last tested, live or fixture.
- Cover at least these 20 scenarios. Use real public sites where possible and label any local fixture as a fixture:
  1. conventional news article
  2. page with many headlines
  3. blog post
  4. long public report page
  5. PDF report
  6. JavaScript-rendered page
  7. dynamically loading feed
  8. Reddit post with comments
  9. X post or thread (record honestly if not accessible)
  10. YouTube video with captions (record honestly if not supported yet)
  11. page with no transcript
  12. HTTP 403
  13. HTTP 429
  14. subscription or login page
  15. anti-bot challenge page
  16. redirect to a different domain
  17. misleading headline with retrievable article
  18. headline that can't be verified
  19. lookalike hostname (record as "not covered until Part 11")
  20. ordinary non-article link that should get no icon
- Run each one with the real extension in Chrome via Playwright, plus a manual check where judgement is needed (is the summary accurate?). Save screenshots in `docs/compat/screenshots/`.
- Fix bugs you find that are inside Parts 01 to 09, one at a time, each with a regression test. List anything bigger as an open issue in `docs/compat/open-issues.md` instead of fixing it.
- Write `docs/compat/summary.md`: share of `full` results, share of correct states, length compliance, the top 5 failure reasons with counts.

## Don't
- Never mark a scenario as passed from reading code. Only from running it.
- Don't claim "works on all sites" anywhere.

## Done when
- All 20 rows are filled in with real results and dates.
- The fixed bugs have regression tests and all checks pass.

## Your check
Read `summary.md`. This is your evidence for whether LinkPeek is ready to show people, and it's what decides which of Parts 11 to 14 matters most.
