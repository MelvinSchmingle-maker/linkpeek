# Part 03. Link detection and the three modes

## Goal
The icon appears beside the links that matter (articles, reports, substantive posts) and nowhere else. Users pick Smart, Scan or Manual mode.

## Build
- **Link classifier** in `src/core/detect/` as a pure function: given a link's URL, text and nearby DOM facts, return `{ isCandidate, score, reasons }`. Signals to weigh:
  - Good: headline-like text (several words, inside `h1` to `h4` or an `article`), article-like URL paths (dates, long slugs, `/news/`, `/article/`, `.pdf`), links inside `main` or `article`.
  - Bad: inside `nav`, `header`, `footer` or `aside` menus; very short text ("Home", "Login", "More"); `mailto:`, `tel:`, `javascript:`; anchors to the same page; social profile links; images with no text; obvious ad or tracking links.
- **Page observer**: a `MutationObserver` that finds links in newly loaded content (infinite feeds, single-page apps), batched and throttled so it doesn't slow the page. Each link is processed once (track with a `WeakSet` or a data attribute). Handle URL changes in single-page apps.
- **Modes**, saved in `chrome.storage`:
  - **Smart** (default): icons only on candidate links.
  - **Scan**: no icons until the user clicks "Scan this page" in the popup. Then show a compact status mark next to each detected headline (fixture or neutral results until later parts).
  - **Manual**: no icons at all. The user right-clicks a link and picks "Peek this link" (context menu), or uses a keyboard shortcut on a focused link.
- Popup: a three-way mode switch with one line explaining each mode, and "Turn off on this site".
- More test pages: `test-pages/blog.html`, `test-pages/infinite-feed.html` (adds items on scroll), `test-pages/spa.html` (changes content without reloading), `test-pages/nav-heavy.html` (lots of links that should NOT get icons).

## Permissions
Smart mode needs the content script on pages. Choose between asking for host access with optional permissions when the user turns LinkPeek on for a site, or a broader grant explained up front. Recommend one, explain the trade-off in plain English in `docs/permissions.md`, and implement it.

## Don't
- No real fetching yet. Clicking an icon still shows fixture or "not yet connected" states.

## Done when
- Unit tests for the classifier with at least 40 labelled example links (should and shouldn't get an icon). Record precision in the test output.
- Playwright: icons on the right links on each test page; none on `nav-heavy.html` menus; new feed items get icons; no duplicate icons after the SPA re-renders.
- Mode switching works and persists after a browser restart.
- No noticeable slowdown on a page with 1,000 links (measure and record it).

## Your check
Load a few real sites you use (a news front page, a blog, a forum). Note where icons show up that shouldn't, or where they're missing. Send that list to the next session as classifier bugs.
