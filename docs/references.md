# References

Official documentation relied on for decisions. Checked 13 Oct 2026.

| Topic | Source | What we used it for |
|---|---|---|
| Declaring permissions, optional host permissions | https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions | Permission plan; host permissions and content-script matches trigger install warnings, optional ones are granted at runtime |
| `chrome.scripting` | https://developer.chrome.com/docs/extensions/reference/api/scripting | `executeScript` with `activeTab` for on-demand use; `registerContentScripts` (Chrome 96+) for per-site Smart mode, persists across sessions by default |
| The activeTab permission | https://developer.chrome.com/docs/extensions/develop/concepts/activeTab | Toolbar click, right-click menu item and keyboard shortcut each grant access to the current tab until the user leaves the page; no install warning |
| Claude API (Messages, SDK, models and prices) | https://platform.claude.com/docs and the claude-api skill reference (cached 6 Oct 2026) | Part 06: `claude-opus-5-5` default, effort, `max_tokens`, prompt caching (512-token minimum, cache reads $0.20/MTok on Opus 5.5), refusal handling and `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`; none on Haiku 5.5), typed SDK errors, SDK timeouts in milliseconds |
| Vercel Functions | https://vercel.com/docs/functions/functions-api-reference | Web-standard `POST(request)` handlers in `api/`, `maxDuration` |
| Vercel Firewall rate limiting from code | https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk | `checkRateLimit(id, { request, rateLimitKey })`, returns `{ rateLimited, error }` |
| Chrome Summarizer API | https://developer.chrome.com/docs/ai/summarizer-api | On-device summaries (Part 05): stable since Chrome 138, not in workers, English/Japanese/Spanish/German/French, hardware needs, "headline" type of 12/17/22 words, download needs a user click. Checked 17 Oct 2026 |
| `chrome.offscreen` | https://developer.chrome.com/docs/extensions/reference/api/offscreen | A hidden document with a DOM for the service worker; reasons `DOM_PARSER` and `WORKERS`; only one at a time, checked with `runtime.getContexts` |
| Cross-origin requests in extensions | https://developer.chrome.com/docs/extensions/develop/concepts/network-requests | Service-worker fetches need host permission; content scripts fetch with the page's origin |
| `chrome.storage.session` | https://developer.chrome.com/docs/extensions/reference/api/storage | In-memory storage, cleared when the browser closes, 10 MB limit; used for the result cache |
| `chrome.permissions.request` | https://developer.chrome.com/docs/extensions/reference/api/permissions | Must be called from a user action in an extension page, hence the small access window |
| schema.org `isAccessibleForFree` | https://schema.org/isAccessibleForFree and https://developers.google.com/search/docs/appearance/structured-data/paywalled-content | How publishers mark paywalled pages and paywalled parts (`hasPart`) |
| Mozilla Readability | https://github.com/mozilla/readability | Article extraction; `parse()` changes the document it's given, so it gets a copy |
| pdf.js | https://mozilla.github.io/pdf.js/ | PDF text; worker file shipped with the extension, no remote code |
| Exa search API | https://exa.ai/docs/reference/search and https://exa.ai/pricing (read 26 Nov 2026) | Story Search's default provider: `POST https://api.exa.ai/search`, `x-api-key` header, `numResults`, `type: "auto"`, `category: "news"`, `startPublishedDate`, `contents.highlights` with `query` and `maxCharacters`; results with `title`, `url`, `publishedDate`, `author`, `highlights`; `costDollars.total`. $7 per 1,000 auto searches up to 10 results, $1 per 1,000 pages of highlights, $10 free credit a month |
| Brave Search API | https://api-dashboard.search.brave.com/app/documentation/news-search/get-started and https://brave.com/search/api/ (read 26 Nov 2026) | Story Search's alternative provider: `GET https://api.search.brave.com/res/v1/news/search`, `X-Subscription-Token` header, `q`, `count` (max 50), `freshness` (custom `YYYY-MM-DDtoYYYY-MM-DD`), `search_lang`, `extra_snippets`. The response schema wasn't on the page read; fields are read defensively. $5 per 1,000 requests, $5 free credit a month. FAQ: storing results needs a custom plan |
| Tavily search API | https://docs.tavily.com/documentation/api-reference/endpoint/search and https://docs.tavily.com/documentation/api-credits (read 27 Nov 2026) | Story Search's free backup: `POST https://api.tavily.com/search`, `Authorization: Bearer tvly-...`, `topic` (`news`), `search_depth` `basic` (1 credit), `max_results` up to 20, `start_date` `YYYY-MM-DD`, `include_usage`; results with `title`, `url`, `content` (up to three ~500-character passages joined by " [...] "), `published_date` (RFC 1123); 432 and 433 when the plan's credit is used up. Free: 1,000 credits a month, no card; pay-as-you-go $0.008 a credit |
| Brave Search API, free credit | Search results checked 27 Nov 2026 (Brave's community forum and third-party write-ups) | Since early 2026 the $5 monthly free credit needs a card at sign-up. Not verified on Brave's own terms page |
| Vercel Hobby limits | https://vercel.com/docs/functions/limits and https://vercel.com/docs/plans/hobby (via search, 27 Nov 2026) | Hobby: functions up to 300 s with Fluid compute; non-commercial, personal use only |
| Claude structured outputs | claude-api skill reference (cached 3 Nov 2026) | Story Search: `output_config.format` with a `json_schema`, objects closed with `additionalProperties: false`; supported on Haiku 5.5; Haiku 5.5 at $0.10 / $0.50 per million tokens, Sonnet 5.5 at $2 / $10 |
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
| @anthropic-ai/sdk | MIT | Backend only (`server/`): calls Claude. Not in the extension |
| @vercel/firewall | Apache-2.0 | Backend only (`server/`): rate limits. Not in the extension |

Story Search added no dependency. The Exa and Brave adapters use `fetch`.

Readability and pdf.js are the only code in the shipped extension that isn't ours. Both are bundled at build time; nothing is loaded from the internet.
