# X adapter: research (not built)

- **Official API:** X's API is paid. The developer page (https://developer.x.com/en/docs/x-api/getting-started/about-x-api) returned a payment-required error when read here, so its current prices are **not verified**.
- **Without an API:** only what's visible on a page the user has open. Links to posts are fetched by the general reader, which needs a login for most posts.
- **Terms:** not read in full from here. Scraping is restricted on X's terms, which should be read before any decision.
- **Recommendation:** skip. The plan allows "only content visible on the page the user has open", but a card for a post elsewhere still needs a fetch, which the terms may not allow.
- **Not built.**

## Status: decided to build, from the rendered page (18 Oct 2026)

The owner has decided to build an X adapter (D64). What we know now, and what we don't:

- **Post pages are built by JavaScript.** The HTML that X's home page sends has scripts and no post content. A post link cannot be read by fetching the post in the background, so the adapter must read the page the user has open, in the content script, after X has drawn it.
- **Links go through t.co.** LinkPeek must not follow them to find the destination: following a t.co redirect sends a request to the article site before its permission is checked (measured, D62).
- **The expanded destination is not yet confirmed.** X's public API documents an `expanded_url` field, which shows that X keeps the destination separately. Whether the page exposes it, and on which element, has to be read from a real post. Historical Twitter markup is not evidence that it's still there.
- **Capture first.** `docs/x/capture-snippet.js` prints the structure of the links on one page in the owner's own browser: hosts, attribute names, short masked text. It does not print full addresses, paths, query strings or handles. Its tests (`src/core/x/capture-snippet.test.ts`) run it on synthetic markup only.

Until the capture has been checked on real posts, LinkPeek shows X links as "can't tell where this link goes yet", and the compatibility report marks every X link with the note above.
