# Part 02. Inline button and card (fake data)

## Goal
The signature interface, working on a local test page with fixture data: the tiny icon, the card that opens under a link, and every state the card can be in. This is where we get the look and feel right before real data exists.

## Build
- A local test page at `test-pages/news-front.html` with several headlines, some nav links, a footer and a few long paragraphs.
- The **inline icon**: small (about 16px), sits just after the link text, doesn't push page content around, has an accessible label ("Preview this link with LinkPeek"), reachable by keyboard, works at 50% to 200% zoom.
- The **card** opens directly under the link when the icon is clicked. Default content only:
  - one-sentence summary
  - a small status mark (tick, cross or neutral) with a text label, never colour alone
  - a short evidence label when it matters ("Preview only", "Headline only")
  - "Open article" link
  - thumbs up / thumbs down (visual only in this part; wire them in Part 09)
- Card closes on Escape, on clicking outside, or on a close button. Focus returns to the icon.
- Render icon and card inside a Shadow DOM so the page's CSS can't break them and ours can't break the page.
- Light and dark versions that follow `prefers-color-scheme`.
- Every state, each showable from the fixtures:
  idle, loading ("Summarising article..."), full summary, partial preview ("Full article unavailable. Showing a preview from the available information."), headline only, article inaccessible, summary failed, link warning, clickbait warning, not enough evidence ("Not enough information to assess this headline."), feedback received, unsupported page.
- A fixture file `src/content/fixtures.ts`. Anything shown from fixtures carries a visible "Demo data" tag.
- A simple popup toggle: "Show demo results on test pages".

## Don't
- No real fetching or AI yet.
- Don't put the icon on nav, footer or button links. For now, only links marked `data-linkpeek-demo` on the test page get one. Part 03 adds real detection.

## Done when
- Every state can be seen on the test page.
- Keyboard-only use works: Tab to icon, Enter opens, Escape closes, focus returns.
- Playwright tests cover open, close, keyboard and each state rendering.
- Screenshots of each state are saved in `docs/screenshots/part-02/`.
- All checks and the build pass.

## Your check
Open the screenshots. Ask yourself: does this look small, calm and native, or does it shout? Change the look now if you want to. It's cheap at this stage.
