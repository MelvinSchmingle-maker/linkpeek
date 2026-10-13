# Part 04. Fetching and reading articles

## Goal
When the user clicks the icon, LinkPeek tries to get the real article text, knows how much it got, and says so honestly when it can't. This is the foundation of the whole product. No AI in this part.

## Build
- **Retrieval** in `src/core/retrieve/`, run from the service worker, only on user action:
  1. If the link points to the page the user is already on, use that page's visible text.
  2. Otherwise fetch the URL from the extension with `credentials: 'omit'` (no cookies sent), a timeout (about 8 seconds), a max response size (about 3 MB), and follow ordinary redirects while recording the chain.
  3. Check content type: HTML, PDF, video page or other.
- **Failure diagnosis**: every failure gets a reason code, not just "error": `permission-denied`, `network`, `timeout`, `http-4xx`, `http-403`, `http-429`, `http-5xx`, `login-wall`, `paywall`, `bot-challenge`, `js-rendered-empty`, `extraction-failed`, `unsupported-type`, `too-large`. Detect login, paywall and challenge pages by common markers and treat them as failures, never as content.
- **No retry on 403, 429 or challenge pages.** At most one retry on network errors or timeouts.
- **Extraction** in `src/core/extract/`: use Mozilla Readability (check its licence and add it to `docs/references.md`) on HTML parsed without running scripts. The service worker has no DOM, so use an offscreen document or a suitable parser and document the choice. Also read structured metadata: `og:` tags, `twitter:` tags, JSON-LD `NewsArticle`, `<link rel="canonical">`, published and modified dates.
- **Evidence level**: `full` if extracted text passes a quality bar (for example 150+ words of body text that isn't boilerplate); `partial` if we only have description, abstract or a short excerpt; `headline-only` if we only have link text; `unavailable` otherwise. Put the threshold in one constant and explain it.
- **PDF**: extract text from the first pages with a maintained library (pdf.js). Large PDFs are `partial` with a note.
- **Cache**: results keyed by canonical URL, in `chrome.storage.session` or a small IndexedDB store, expiring after 24 hours. Two clicks on the same link while loading share one request.
- Wire into the card. For now the card shows the evidence level and the first sentence of the extracted text, clearly labelled "Extract (not a summary yet)".
- Fixture pages served by a local test server, covering: normal article, two different layouts, 403, 429, login page, paywall, bot challenge, redirect to another domain, JS-only page, PDF, huge page, slow response.

## Don't
- Don't send any article text off the device in this part.
- Don't bypass anything that blocks access.

## Done when
- Unit tests for each failure code using the local fixture server.
- Unit tests for the evidence-level rules.
- A live test script (separate, not part of the normal test run) that tries 10 real public article URLs and writes a table to `docs/compat/part-04-live.md`: URL, evidence level, extraction method, failure reason. Run it once and commit the results.
- Service worker restart mid-request is handled (test it).

## Your check
Read `docs/compat/part-04-live.md`. What share of real articles came back `full`? That number tells you how good LinkPeek can be. If it's low, fix retrieval before spending money on AI.
