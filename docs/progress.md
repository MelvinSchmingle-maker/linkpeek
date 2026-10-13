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
