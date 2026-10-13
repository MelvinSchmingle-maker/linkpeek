# References

Official documentation relied on for decisions. Checked 13 Oct 2026.

| Topic | Source | What we used it for |
|---|---|---|
| Declaring permissions, optional host permissions | https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions | Permission plan; host permissions and content-script matches trigger install warnings, optional ones are granted at runtime |
| `chrome.scripting` | https://developer.chrome.com/docs/extensions/reference/api/scripting | `executeScript` with `activeTab` for on-demand use; `registerContentScripts` (Chrome 96+) for per-site Smart mode, persists across sessions by default |
| The activeTab permission | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab | Toolbar click, right-click menu item and keyboard shortcut each grant access to the current tab until the user leaves the page; no install warning |
| Testing extensions with Playwright | https://playwright.dev/docs/chrome-extensions | Persistent context, `--load-extension`, `channel: 'chromium'` for headless |

## Dependencies

| Package | Licence | Why |
|---|---|---|
| vite | MIT | Build tool |
| typescript | Apache-2.0 | Type checking |
| vitest, happy-dom | MIT | Unit tests with a fake DOM |
| @playwright/test | Apache-2.0 | Real-browser tests |
| eslint, typescript-eslint | MIT | Lint |

No runtime dependencies yet: everything in the shipped extension is our own code.
