# Progress

## Part 01. Project setup (13 Oct 2026)

**Built:** an empty but real extension. Manifest V3, three-part Vite build, popup that says "Installed" with the version, options page, settings storage, placeholder icons, module folders, docs.

**Tested (actual results):**
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: 4/4 pass (settings defaults, merge, change events)
- `npm run build`: pass, produces `dist/`
- `npm run test:e2e`: 1/1 pass. Loads the unpacked extension in Playwright's Chromium 141 (headless) and checks the popup.

**Not verified:** loading in your own Chrome by hand (follow the README). Other Chromium browsers (Edge, Brave) not tried.

## Part 02. Inline button and card, with demo data (13 Oct 2026)

**Built:**
- The inline icon (an eye, sized to the headline text) placed right after a link, inside a Shadow DOM.
- The card: status mark with text label, evidence tag, "Demo data" tag, link warning with the reason, summary or explanation, "Open article", thumbs up/down.
- All states: idle, loading, full summary, partial preview, headline only, inaccessible, summary failed, link warning, clickbait warning, not enough evidence, unsupported, feedback received. Wording for every failure reason in `src/core/messages.ts`.
- Closes on Escape, close button, outside click, or clicking the icon again. Focus goes into the card on open and back to the icon on close.
- Light and dark themes, following the browser setting.
- Feedback votes stored on the device (see D12).
- Popup: "Run on this page" and the demo toggle.
- Test page `test-pages/news-front.html` with hostile page CSS, a clickable teaser block, nav and footer links.

**Tested (actual results):**
- typecheck, lint: pass
- Unit tests: 34/34 pass (every card state, the tick/cross/neutral labels, page text inserted as text not markup, demo data always tagged, no "safe" wording, feedback one-vote rule and cap, hostname-only storage)
- Browser tests: 25/25 pass in Chromium 141 headless. Covers icon placement (demo links only, none in nav or footer), open/close, card position, no layout shift, keyboard (Enter, Tab, Escape, focus return), outside click, page click handlers not triggered, page CSS can't restyle the UI, every state's text, feedback saved with hostname only, demo toggle removes and restores icons, layout at approx. 200% zoom, 50% zoom and phone width, and the card following its link on scroll.
- Screenshots of every state in light and dark: `docs/screenshots/part-02/`.

**Not verified:**
- By hand in your own Chrome (please try it, README has steps).
- A real screen reader (labels and roles are set, but nobody has listened to it yet).
- "Run on this page" in the popup: it needs a real toolbar click, which automated tests can't do. The code path is small, but it's untested.

## Part 03. Link detection and modes (13 Oct 2026)

**Built:**
- Link classifier (rules, see D15/D16) and a separate module that reads link facts from the page.
- Page scanner: finds links on load and as content appears (feeds, single-page apps, href changes, framework re-renders), each link judged once, no duplicate icons, time-boxed batches.
- Modes: Smart (default), Scan, Manual. Right-click "Peek at this link with LinkPeek" and the Alt+Shift+P shortcut for a focused link. A manual peek adds a temporary icon that goes away when the card closes.
- Per-site on/off in the popup using Chrome's optional site permissions; "Turn on for all websites" and site lists in Settings.
- Popup redesigned: mode, this site, Scan this page, Settings link, shortcut. Demo toggle moved to Settings.
- Test pages: nav-heavy, blog, infinite feed, single-page app, 1,200 links.
- Fixed: Chrome shrinks extension-page text to 75% by default; popup and settings now set their own size. Dark-mode button contrast.

**Tested (actual results):**
- typecheck, lint, production build: pass
- Unit tests: 97/97 pass, including 57 labelled classifier examples (precision 100% on the set, required 95%+; earlier versions of this note said 59, which was the number of tests, not examples), site-pattern helpers, the new "can't read articles yet" state.
- Browser tests: 40/40 pass in Chromium 141. New: icons exactly on the expected links on the nav-heavy and blog pages; feed items get icons as they load; single-page app route changes, re-renders and href changes with no duplicates; 1,200-link page (all icons in about 0.4 s, slowest batch about 12 ms, no long tasks); Smart default; Scan mode (no icons until scan, popup reports "Found 11 article links"); Manual peek by URL and by focused link, temporary icon removed on close with focus returned to the link; mode persists across reloads; turn off/on for a site from the popup; turn back on from Settings.
- Screenshots: `docs/screenshots/part-03/`.

**Not verified:**
- The real right-click menu and the real keyboard shortcut. Tests send the same messages those send, but can't click Chrome's own menu or press a browser-level shortcut.
- Chrome's permission prompt for "Turn on" (automated tests can't click it), and everything that follows a real grant: registering the site script and keeping it after a restart. The test builds have test-server access baked in, so that path never runs in the automated tests (corrected 14 Oct 2026; this line used to say the tests covered it).
- Real websites. The classifier has only seen our test pages and labelled examples. Part 10 tests it on live sites.
- The keyboard shortcut showed as "not set" in the automated browser. In normal Chrome it should be Alt+Shift+P unless another extension already uses it.

## Review and fixes (14 Oct 2026)

**What happened:** a multi-agent code review of Parts 01 to 03. Four reviewers each took one area (page-side correctness, security and privacy, permissions and the service worker, the classifier and brief compliance). A sceptic then tried to disprove every finding, mostly by reproducing it in a real Chromium. 37 findings were confirmed (about 30 distinct problems, several found twice) and 2 rejected. All confirmed ones are fixed or documented. Design changes are in `docs/decisions.md` D22.

**The serious ones:**
- The first right-click peek or "Scan this page" on a site you hadn't turned on usually failed or was undone straight away (a start-up race). Fixed. A new test build (`dist-e2e-on-demand/`) now tests exactly this path; the old tests couldn't, because their build loaded LinkPeek differently. The new tests fail on the old code and pass on the new.
- Any website could make LinkPeek show a "Headline check passed" tick on its own links using LinkPeek's demo markup. Fixed: demo markup only works on the local test server.
- A page could stop LinkPeek from starting with one HTML element, or hide its card with CSS. Fixed.
- A right-click peek on a site you hadn't turned on started Smart mode scanning the whole page. Fixed.
- "Turn back on" in Settings never worked (Chrome refused the permission pattern), and unticking "all websites" also removed every site turned on one by one. Fixed.

**Tested (actual results):**
- typecheck, lint, production build: pass. The production build has no test hooks, closed Shadow DOM, and no site access at install (checked in `dist/`).
- Unit tests: 113/113 pass. The classifier's labelled set grew from 57 to 71 examples: 14 new negative shapes (GitHub commits, Google Docs, Amazon and eBay products, Wikipedia categories, WordPress "Continue reading" and "Leave a comment", comment counts, sidebars). Correction: this note first claimed positive cases too (old Reddit, a Guardian date, Chinese and Thai headlines, Bluesky); the script that added them silently skipped them. They were added in round two (below). Precision 100%, recall 100% on that set.
- Browser tests: 62/62 pass (53 with the auto-loading test build, 9 with the on-demand one). New: first peek and first scan on 10 fresh pages each; Smart mode doesn't start on sites not turned on; turning a site on while LinkPeek is already on the page; a page element named `__linkpeekLoaded`; leftover icons from an old version; double injection; demo markup ignored on another site; hostile `!important` CSS; re-ordered lists; swapped links; headlines whose text arrives late; SVG links; Escape and focus belonging to the page; a card whose link gets hidden; peeking the same link twice; a URL that appears twice on a page.

**Not verified (honest list):**
- Chrome's real permission prompt, and what follows it: registering the site script, keeping it after a browser restart, "Turn on for all websites", "Turn back on". The test builds have test-server access baked in, so this path never runs in automated tests.
- The real right-click menu, the real keyboard shortcut and the "?" badge when a peek fails. Tests send the same messages, but can't click Chrome's own menu or press a browser-level shortcut.
- Right-click peeks inside frames (code sends to the right frame; no test page with frames yet).
- Cleaning up after an extension update. The new copy removes the old copy's icons (tested with planted leftovers); the old copy stopping itself was not tested, because tests can't update the extension in place.
- Sites built with React and similar tools. The first automatic scan waits for the page to settle (load, then 0.3 s without changes, at most 3 s). That only helps sites that hydrate quickly: the second review round showed that hydrating 0.5 s or more after load (including the reviewer's 1 s example) still causes a hydration failure and a full re-render. Correction: this line used to say the wait avoided the reviewer's case; it doesn't. Drawing icons in an overlay would remove the risk; not done.
- Real websites in general. Still only test pages and labelled examples. Part 10 is where that gets measured.
- A real screen reader.

## Second review round and fixes (14 Oct 2026)

**What happened:** the same review process, aimed at the fixes. One sceptic per area re-tested each of the 37 findings against the fixed code, mostly by re-running the original reproduction in a real Chromium. A separate reviewer hunted the fix commit for new bugs, and a sceptic tried to disprove each one.

**Result before this round's fixes:** 27 of 37 confirmed fixed, 10 only partly fixed, 12 new problems confirmed (all 12 reproduced). Several were introduced by round one: fixed tag names a page could hijack, icons forced visible inside hidden slides, the first scan waiting forever on pages that never finish loading, icons rebuilt every second by a ticking timestamp, an endless loop against page code that keeps a badge next to a link, BBC-style video promos and Law360's IP section losing their icons, and the popup's update listeners being wired into the wrong function. All are fixed; design changes are in `docs/decisions.md` D23.

**Tested (actual results):**
- typecheck, lint, production build: pass. The production build has closed Shadow DOM, no test hooks or timing code, and no site access at install (checked in `dist/`).
- Unit tests: 129/129 pass. Labelled classifier set: 87 links (the positives that went missing in round one are in now, plus Law360's IP section, a BBC video promo, a Hindi headline, an FT link from old Reddit, and newsletter, subscribe, log-in and help links under content sections). Precision 100%, recall 100%, printed by `npm test`.
- Browser tests: 72/72 pass (3 screenshot-only tests skipped). New in this round: a page defining our element name can't get into new icons and LinkPeek switches names; hostile CSS colour variables and `::after` covers have no effect; an icon in a hidden slide stays hidden; a ticking timestamp doesn't rebuild the icon or steal focus; page code keeping its badge next to a link doesn't cause a loop; Smart mode starts on a page that never finishes loading; crafted forms don't stop the scanner or make Scan hang; the popup updates while open; after `chrome.runtime.reload()` the old copy removes its icons within seconds with no page changes; only one card open across frames; the shortcut works on a focused link inside a frame and other frames stay silent.

**Not verified (in addition to the list above):**
- The "Turn on pending" note that lets the service worker undo "turn off" when the popup closes during Chrome's prompt. It needs the real prompt.
- The "?" badge itself (code path runs; tests can't see the toolbar).
- The two remaining partial items are design limits, not fixed: icons are still inserted next to links (overlay not built, see the React note above), and the real grant/restart path isn't tested.
