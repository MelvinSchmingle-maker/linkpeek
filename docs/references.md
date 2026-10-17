# References

Official documentation relied on for decisions. Checked 13 Oct 2026.

| Topic | Source | What we used it for |
|---|---|---|
| Declaring permissions, optional host permissions | https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions | Permission plan; host permissions and content-script matches trigger install warnings, optional ones are granted at runtime |
| `chrome.scripting` | https://developer.chrome.com/docs/extensions/reference/api/scripting | `executeScript` with `activeTab` for on-demand use; `registerContentScripts` (Chrome 96+) for per-site Smart mode, persists across sessions by default |
| The activeTab permission | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab | Toolbar click, right-click menu item and keyboard shortcut each grant access to the current tab until the user leaves the page; no install warning |
| Chrome Summarizer API | https://developer.chrome.com/docs/ai/summarizer-api | On-device summaries (Part 05): stable since Chrome 138, not in workers, English/Japanese/Spanish/German/French, hardware needs, "headline" type of 12/17/22 words, download needs a user click. Checked 17 Oct 2026 |
| `chrome.offscreen` | https://developer.chrome.com/docs/extensions/reference/api/offscreen | A hidden document with a DOM for the service worker; reasons `DOM_PARSER` and `WORKERS`; only one at a time, checked with `runtime.getContexts` |
| Cross-origin requests in extensions | https://developer.chrome.com/docs/extensions/develop/concepts/network-requests | Service-worker fetches need host permission; content scripts fetch with the page's origin |
| `chrome.storage.session` | https://developer.chrome.com/docs/extensions/reference/api/storage | In-memory storage, cleared when the browser closes, 10 MB limit; used for the result cache |
| `chrome.permissions.request` | https://developer.chrome.com/docs/extensions/reference/api/permissions | Must be called from a user action in an extension page, hence the small access window |
| schema.org `isAccessibleForFree` | https://schema.org/isAccessibleForFree and https://developers.google.com/search/docs/appearance/structured-data/paywalled-content | How publishers mark paywalled pages and paywalled parts (`hasPart`) |
| Mozilla Readability | https://github.com/mozilla/readability | Article extraction; `parse()` changes the document it's given, so it gets a copy |
| pdf.js | https://mozilla.github.io/pdf.js/ | PDF text; worker file shipped with the extension, no remote code |
| Testing extensions with Playwright | https://playwright.dev/docs/chrome-extensions | Persistent context, `--load-extension`, `channel: 'chromium'` for headless |

## Dependencies

| Package | Licence | Why |
|---|---|---|
| vite | MIT | Build tool |
| typescript | Apache-2.0 | Type checking |
| vitest, happy-dom | MIT | Unit tests with a fake DOM |
| @playwright/test | Apache-2.0 | Real-browser tests |
| eslint, typescript-eslint | MIT | Lint |
| @mozilla/readability | Apache-2.0 | Finds the article text in a page (shipped in the extension) |
| pdfjs-dist | Apache-2.0 | Reads text from PDFs (shipped in the extension, worker included as a file) |

Readability and pdf.js are the only code in the shipped extension that isn't ours. Both are bundled at build time; nothing is loaded from the internet.
