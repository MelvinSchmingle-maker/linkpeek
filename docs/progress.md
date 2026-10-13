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
