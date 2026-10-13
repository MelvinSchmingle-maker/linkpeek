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
- Unit tests: 97/97 pass, including 59 labelled classifier examples (precision 100% on the set, required 95%+), site-pattern helpers, the new "can't read articles yet" state.
- Browser tests: 40/40 pass in Chromium 141. New: icons exactly on the expected links on the nav-heavy and blog pages; feed items get icons as they load; single-page app route changes, re-renders and href changes with no duplicates; 1,200-link page (all icons in about 0.4 s, slowest batch about 12 ms, no long tasks); Smart default; Scan mode (no icons until scan, popup reports "Found 11 article links"); Manual peek by URL and by focused link, temporary icon removed on close with focus returned to the link; mode persists across reloads; turn off/on for a site from the popup; turn back on from Settings.
- Screenshots: `docs/screenshots/part-03/`.

**Not verified:**
- The real right-click menu and the real keyboard shortcut. Tests send the same messages those send, but can't click Chrome's own menu or press a browser-level shortcut.
- Chrome's permission prompt for "Turn on" (automated tests can't click it). The test build has access to the local test server already, so tests cover what happens after access exists.
- Real websites. The classifier has only seen our test pages and labelled examples. Part 10 tests it on live sites.
- The keyboard shortcut showed as "not set" in the automated browser. In normal Chrome it should be Alt+Shift+P unless another extension already uses it.
