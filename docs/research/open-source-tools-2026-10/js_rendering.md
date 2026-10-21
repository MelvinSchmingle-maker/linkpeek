# Open source tools for rendering JavaScript-built pages (LinkPeek)

Research date: 21 Oct 2026. Scope: tools that run a page's JavaScript and return its text, for the LinkPeek backend (a small Vercel function, Node, TypeScript), plus whether the extension can do this without opening the page.

## Method and tools used

- Local context read: `/home/user/linkpeek/handoff.md` and `/home/user/linkpeek/todo.md` (last updated 17 Oct 2026, commit f6c99c8). The talkSPORT case and the "browser tab" message come from there.
- WebFetch: GitHub repo pages (Sparticuz/chromium, browserless/chrome, unclecode/crawl4ai, mendableai/firecrawl, mozilla/readability, kepano/defuddle), the Vercel functions limits page (vercel.com/docs/functions/limitations), and two developer.chrome.com pages (offscreen API, manifest `incognito` key).
- WebSearch, snippets only: Jina Reader terms (no page was fetched).
- Not used: no GitHub search tool was called. Nothing was cloned, installed or run. No real news site was loaded.
- Stars: taken from the repo pages fetched on 21 Oct 2026. Last commit date: "not seen" for every repo. The fetched pages showed a "Last commit date" column with no dates in it.
- Section order differs from the researcher template. The user's requested sections come first (shortlist, breaks a rule, could not verify), then the five key questions with Takeaway, Cited Findings, Inferences and Gaps.

## Ranked shortlist

Three candidates made the shortlist. The tool budget ran out before I checked other extractors or Playwright on Vercel. Those are under Could not verify.

### 1. @sparticuz/chromium with puppeteer-core (step a, backend)

- **Name and URL:** @sparticuz/chromium, https://github.com/Sparticuz/chromium. Used with `puppeteer-core` (licence not checked).
- **What it does:** ships a headless Chromium binary built for serverless hosts, launched from puppeteer-core.
- **Licence:** MIT (WebFetch, repo page).
- **Last commit date seen:** not seen. The repo page shows "532 Commits" and no date.
- **Stars seen:** 1.7k (WebFetch, 21 Oct 2026).
- **Maintained:** unclear. The repo page says nothing about maintenance and shows no date.
- **Where it plugs in:** backend only. The extension sends the URL to the backend, which renders the page.
- **What it sends off the device:** the article URL goes to the LinkPeek backend on Vercel. The backend's browser then requests the article from Vercel's servers. This is only the same as today's fetch if no cookies and no login details are sent, which the backend must enforce by starting a fresh browser context for every request.
- **Limits:**
  - Vercel (WebFetch of the limits page, last updated 24 Aug 2026): Hobby has 2 GB memory and 1 vCPU, with a 300 s default and maximum duration. Pro and Enterprise have a 2 GB default and a 4 GB, 2 vCPU maximum. Pro's maximum duration is 800 s, with a 1800 s beta. Uncompressed bundle limit is 250 MB including layers. A large-functions beta allows up to 5 GB for Node, and it is on by default for new projects. Request and response bodies are capped at 4.5 MB.
  - Chromium (repo page): the `chromium.br` file is "over 50 MB". Allocate at least 512 MB of RAM, and 1600 MB or more is recommended. The repo page gives no timeout and does not mention Vercel. It mentions `@sparticuz/chromium-min` for hosts with file size limits, which I did not check.
- **Setup from the repo page:** install puppeteer-core and @sparticuz/chromium at matching Chromium versions. Launch with `chromium.args`, headless `"shell"` mode, and `executablePath` from `chromium.executablePath()`. Set `chromium.setGraphicsMode = false` to skip WebGL. If the code is bundled, mark @sparticuz/chromium as external.
- **Main risk:** the bundle has to fit under 250 MB uncompressed alongside everything else. A Hobby function has one vCPU, so rendering will be slow. Each call is capped at 300 s on Hobby. The backend runs the page's own scripts and fetches whatever URL it is given, so it needs SSRF guards (blocking private and internal addresses and non-HTTP schemes) and a Chromium and puppeteer-core version pin.
- **Constraint check:** pass, with conditions. Use a fresh context with no cookies or login. Do not add stealth or bot-evasion plugins, because their purpose is to get past bot checks. A page that shows a bot check or login wall after rendering is a failure, and the tool should report it as one.
- **How verified:** WebFetch of the repo page (licence, stars, memory guidance, setup) and WebFetch of the Vercel limits page. Not verified: package.json, source, puppeteer-core's licence, and the size of the current package.

### 2. Mozilla Readability (step b, backend)

- **Name and URL:** @mozilla/readability, https://github.com/mozilla/readability
- **What it does:** extracts the main article text from a DOM. On Node it needs a DOM implementation, and the README example uses jsdom.
- **Licence:** Apache-2.0 (WebFetch, repo page).
- **Last commit date seen:** not seen. The page shows "540 Commits" and no date.
- **Stars seen:** 11.5k (WebFetch, 21 Oct 2026).
- **Maintained:** unclear. No release tag appears on the page (the Releases section was empty), and no commit date is shown.
- **Where it plugs in:** backend. The same code could run in the extension on a DOM, but that is not needed.
- **What it sends off the device:** nothing. It works on HTML that the backend already has.
- **Main risk:** jsdom adds a lot to the bundle, which counts toward the 250 MB limit next to Chromium. Maintenance status is unknown.
- **Constraint check:** pass.
- **How verified:** WebFetch of the repo page. Not verified: npm package size or last publish date.

### 3. Defuddle (step b, backend, or browser bundle)

- **Name and URL:** defuddle, https://github.com/kepano/defuddle
- **What it does:** extracts the main content and metadata from a DOM, in the browser or on Node.
- **Licence:** MIT (WebFetch, repo page).
- **Last commit date seen:** not seen. The page shows "775 commits" and no date.
- **Stars seen:** 9.7k (WebFetch, 21 Oct 2026).
- **Maintained:** unclear. No release tag appears (Releases section empty), and no commit date is shown.
- **Where it plugs in:** backend (`defuddle/node` bundle), or the browser bundle with no extra dependencies.
- **Server-side needs:** a DOM implementation (the README names linkedom, JSDOM and happy-dom), and `"type": "module"` in package.json for the Node import.
- **What it sends off the device:** by default, its async fallback calls the FxTwitter API for X (Twitter) content. Setting `useAsync: false` turns that off. If the fallback stays on, every X link would be sent to FxTwitter, a third party that is not on the hosted-service list, so it would need naming under the privacy rule.
- **Main risk:** same bundle-size point as Readability. The FxTwitter call is an extra destination for X links. The Node bundle includes math and Markdown support, which adds weight. Maintenance status is unknown.
- **Constraint check:** pass only with `useAsync: false`. Otherwise it fails the privacy naming rule for X links.
- **How verified:** WebFetch of the repo page. Not verified: package size, or whether the browser bundle is actually needed in the extension.

## Looks like a fit but breaks a rule

- **Browserless (self-hosted), https://github.com/browserless/chrome.** Licence is "SSPL-1.0 OR Browserless Commercial License" (WebFetch). The README says the project is "Free for non-commercial uses". Commercial use, or use in closed-source CI, requires a commercial license. That breaks the licence preference (MIT, Apache-2.0 or BSD) and needs a paid licence before LinkPeek earns money (handoff.md says a paid plan is needed for that anyway). Its self-hosted setup is a separate server, so the backend is no longer a small Vercel function. Stars seen: 13.8k (21 Oct 2026). Last commit date not seen. Maintained: unclear.
- **Firecrawl (self-hosted), https://github.com/mendableai/firecrawl.** The core is AGPL-3.0, and the SDKs and some UI components are MIT (WebFetch). The project is flagged under the AGPL rule. Self-hosting runs through `docker-compose.yaml` and `SELF_HOST.md`, which means several services, so it does not fit a small Vercel function. The cloud version at firecrawl.dev is a paid tier (WebFetch says "additional features"), and its terms were not checked. Stars seen: 193.7k (21 Oct 2026). Last commit date not seen.
- **Crawl4AI (self-hosted or Cloud), https://github.com/unclecode/crawl4ai.** Licence is Apache-2.0. It is a Python library that uses Playwright, with a Docker server on port 11235 that needs an API token (WebFetch). That breaks the rule that the backend is a small Node/TypeScript Vercel function. The Cloud tier has a free plan of 1,000 credits a month and paid plans from $10 a month (WebFetch). Its terms were not checked, so the URLs it would receive are not named yet. Stars seen: 86.0k (21 Oct 2026). Last commit date not seen.
- **Hidden tab or hidden window in the user's normal profile (chrome.tabs or chrome.windows, inactive or minimised).** This is the most obvious way to run a page in the extension without showing it. The page would load in the user's own profile, so the sites would receive the user's cookies. That breaks the rule that the extension sends no cookies or login details. The Chrome incognito page describes a separate cookie store only for "split" mode (see Key question 4). This is an inference from that, not a statement that the docs make about tabs.

## Could not verify

1. **Offscreen document with an iframe (Key question 4).** Whether target sites allow framing (X-Frame-Options and frame-ancestors headers), and whether an iframe in an offscreen document sends the user's cookies. If it does, it fails the no-cookies rule the same way a hidden tab does. To settle: read the Chrome host-permissions and cross-origin pages, and test on a page we control. Do not test on a real news site, per the brief.
2. **Maintenance of @sparticuz/chromium, Readability and Defuddle.** No commit date was visible on any of the three repo pages. To settle: check each package's npm page for publish dates and versions, and fetch the repo commits page.
3. **Licence and size of puppeteer-core, and the current size of @sparticuz/chromium.** To settle: the npm package page, and the LICENSE file on raw.githubusercontent.com.
4. **Jina Reader: full terms, and whether it renders JavaScript.** The search snippets are not the full terms. To settle: fetch https://jina.ai/legal/ and https://jina.ai/reader/, and check the Reader docs for a JavaScript rendering option.
5. **Crawl4AI Cloud terms and data handling.** To settle: fetch its terms and privacy page.
6. **Vercel Hobby's non-commercial clause.** The handoff says it exists, but the limits page I fetched does not state it. To settle: fetch Vercel's terms or fair-use page.
7. **Other extractors and Playwright on Vercel, not searched.** Candidates include @extractus/article-extractor, Trafilatura (Python), the Postlight parser (status unknown), and playwright-core with a serverless Chromium. To settle: one WebSearch round, then repo pages.
8. **Whether bot checks hit requests from Vercel's IP ranges more often.** This needs testing on real sites, which is out of scope here.

## Key questions

### 1. Which open-source headless browser setups run on a Vercel function?

#### Takeaway
@sparticuz/chromium with puppeteer-core is the one setup I confirmed is built for serverless hosts. Hobby limits are 300 s, 2 GB and 1 vCPU, and the uncompressed bundle limit is 250 MB.

#### Cited Findings
- The chromium package is MIT, with 1.7k stars (21 Oct 2026), and its `chromium.br` file is "over 50 MB". It needs at least 512 MB of RAM, and 1600 MB or more is recommended. — [Sparticuz/chromium](https://github.com/Sparticuz/chromium) (WebFetch)
- Its recommended setup is puppeteer-core plus @sparticuz/chromium at matching Chromium versions, with `executablePath` set from `chromium.executablePath()`. — [Sparticuz/chromium](https://github.com/Sparticuz/chromium) (WebFetch)
- Hobby functions: 2 GB and 1 vCPU, with a 300 s default and maximum duration. Pro: 2 GB default, 4 GB and 2 vCPU maximum, 800 s maximum, and a 1800 s beta. — [Vercel functions limits](https://vercel.com/docs/functions/limitations) (WebFetch, last updated 24 Aug 2026)
- Uncompressed bundle limit is 250 MB including layers. A large-functions beta allows up to 5 GB for Node, enabled by the `VERCEL_SUPPORT_LARGE_FUNCTIONS` variable. — [Vercel functions limits](https://vercel.com/docs/functions/limitations) (WebFetch)
- Request and response bodies are capped at 4.5 MB. — [Vercel functions limits](https://vercel.com/docs/functions/limitations) (WebFetch)

#### Inferences
- A Chromium function with 1600 MB of memory fits Hobby's 2 GB limit but leaves little room for jsdom and other code, and Hobby's single vCPU will make each render slow. This is an inference from the limits above, not something a source states.
- If the bundle goes over 250 MB, the repo's `@sparticuz/chromium-min` variant (which the repo mentions but I did not check) or the large-functions beta would be the next routes.

#### Gaps
- No timeout guidance for Chromium itself, and no Vercel-specific guidance on the repo page.
- Maintenance is unclear, as no commit date was visible.

### 2. Which rendering services can be self-hosted, and what are their licences?

#### Takeaway
None of the three self-hostable services fits a small Node/TypeScript Vercel function. Browserless is SSPL with a paid commercial licence, Firecrawl is AGPL-3.0 and runs as several containers, and Crawl4AI is a Python library with a Docker server.

#### Cited Findings
- Browserless: "SPDX-License-Identifier: SSPL-1.0 OR Browserless Commercial License". Commercial use requires a paid licence. Stars 13.8k (21 Oct 2026). — [browserless/chrome](https://github.com/browserless/chrome) (WebFetch)
- Firecrawl: AGPL-3.0 core, MIT SDKs and some UI components. Self-hosting uses `SELF_HOST.md` and `docker-compose.yaml`. Stars 193.7k (21 Oct 2026). — [Firecrawl](https://github.com/mendableai/firecrawl) (WebFetch)
- Crawl4AI: Apache-2.0. It runs inside a Python script, or as a Docker server on port 11235 that needs an API token. Stars 86.0k (21 Oct 2026). — [Crawl4AI](https://github.com/unclecode/crawl4ai) (WebFetch)

#### Inferences
- Any of these three would be a second service next to the Vercel function. That changes the backend shape the brief fixes.

#### Gaps
- Last commit dates were not visible for any of the three.
- Firecrawl's cloud and Crawl4AI's Cloud terms were not checked.

### 3. Which text extractors work on rendered HTML?

#### Takeaway
Mozilla Readability (Apache-2.0) and Defuddle (MIT) both run on Node with a DOM library and are the two I would test first. Neither repo page showed a commit date, so maintenance is still open.

#### Cited Findings
- Readability: Apache-2.0, 11.5k stars (21 Oct 2026). Node use needs a DOM, and the README example uses jsdom. — [mozilla/readability](https://github.com/mozilla/readability) (WebFetch)
- Defuddle: MIT, 9.7k stars (21 Oct 2026). It runs in the browser and on Node (`defuddle/node`), with linkedom, JSDOM or happy-dom. Its async fallback calls the FxTwitter API for X content, which `useAsync: false` disables. — [kepano/defuddle](https://github.com/kepano/defuddle) (WebFetch)

#### Inferences
- Defuddle's browser bundle could run in the extension as well, but the extension cannot run page scripts, so it would only help on HTML the extension already has.

#### Gaps
- Neither repo page showed a commit date or release tag.
- Other extractors (@extractus/article-extractor, Trafilatura, the Postlight parser) were not checked.

### 4. Can the extension get a page's rendered output without the user opening it?

#### Takeaway
Chrome's documented route is an offscreen document that embeds an iframe. The docs do not say whether a remote page can load there or what cookies it sends, so it is not a settled option. A hidden tab in the normal profile would send the user's cookies, which breaks the no-cookies rule.

#### Cited Findings
- Offscreen reasons include `DOM_SCRAPING` ("needs to embed an iframe and scrape its DOM to extract information") and `IFRAME_SCRIPTING` ("embed and script an iframe in order to modify the iframe's content"). The API needs the `"offscreen"` permission and Chrome 109 or later with MV3. The runtime API is "the only extensions API supported by offscreen documents". An offscreen document's URL "must be a static HTML file bundled with the extension". — [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) (WebFetch)
- The offscreen page does not say whether remote pages can load in iframes. — [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) (WebFetch, same page)
- `incognito` manifest key: `spanning` is the default. In `split` mode, "This incognito process runs alongside the regular process, but has a separate memory-only cookie store." `not_allowed` stops the extension running in incognito. — [Manifest incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito) (WebFetch)

#### Inferences
- A hidden tab or window in the normal profile would load the page with the user's cookies. This breaks the no-cookies rule.
- An iframe in an offscreen document probably runs in the same profile, so it may have the same problem. Sites that send X-Frame-Options or frame-ancestors headers would block the frame, which is general browser behaviour and not stated in the Chrome page I read.
- A split-mode incognito process would give a cookie store that starts empty, which fits the no-cookies rule better. It needs the user to allow the extension in incognito. The docs I read do not say the user must do that, so this is unconfirmed.
- Permissions needed: `"offscreen"` for the offscreen route. Host permissions for the target site are probably needed to read a cross-origin iframe, but this is an inference and not confirmed.

#### Gaps
- Whether target sites allow framing, and what cookies an offscreen iframe sends.
- Whether DOM_SCRAPING gives cross-origin DOM access without host permissions.
- The Chrome permissions reference and host-permissions pages were not fetched, so the permission list is unconfirmed.

### 5. Which hosted extractors or rendering services would receive article URLs?

#### Takeaway
Jina Reader's hosted endpoint would receive every URL it is given. Its terms are mixed: it says it does not train on requests, but it keeps cached copies and reserves the right to keep some data. Jina is named here, so it passes the naming rule, but I do not recommend it until its terms are read in full.

#### Cited Findings
- Jina Reader FAQ (WebSearch snippet, page not confirmed): "We never use your API requests, inputs, or outputs to train our embedding, reranker, or any other models. Your data remains yours." — [jina.ai/reader](https://jina.ai/reader/) (search snippet; the exact page is not confirmed)
- Jina Reader caching (WebSearch snippet): "Our API caches URL contents for a certain amount of time." A header can bypass the cache. "Requests that include cookies are never cached." A "Do Not Cache or Track" header is described as meant to keep a request out of cache and logs, for "sensitive URLs". — [jina.ai/reader](https://jina.ai/reader/) (search snippet)
- A Jina blog post (WebSearch snippet, not Reader-specific): "Zero data retention policy - we don't store or log your requests." — the search summary flagged this as conflicting with the caching default. — [jina.ai/news](https://jina.ai/news/) (search snippet; exact page not confirmed)
- Terms, section 10.4 (WebSearch snippet): Jina "may keep operational, diagnostic, and usage metadata", and may use aggregated, anonymised data to run and improve services. "Jina AI shall, subject to applicable mandatory data protection requirements, be entitled to retain data collected by Jina AI in the course of providing the Services." — [jina.ai/legal](https://jina.ai/legal/) (search snippet; exact section not confirmed)
- Jina's website privacy policy covers visits to jina.ai, not API calls, and describes server logs kept "for up to seven days" (search snippet). — [jina.ai/legal](https://jina.ai/legal/) (search snippet)
- Firecrawl Cloud: a paid tier that is separate from the self-hosted AGPL core (WebFetch). Its terms were not checked. — [Firecrawl](https://github.com/mendableai/firecrawl)
- Crawl4AI Cloud: free plan of 1,000 credits a month, paid plans from $10 a month (WebFetch). Its terms were not checked. — [Crawl4AI](https://github.com/unclecode/crawl4ai)
- Defuddle's optional FxTwitter fallback sends X URLs to FxTwitter (WebFetch). — [kepano/defuddle](https://github.com/kepano/defuddle)

#### Inferences
- Jina would receive the full article URL, and the search summary says the caching default keeps copies. Whether it stores or logs requests is unclear, because the snippets conflict.
- A privacy note for LinkPeek would have to say that article URLs are sent to Jina if it is used. That is a user-facing change.

#### Gaps
- Full text of Jina's terms and its Reader page was not read, and whether Reader runs JavaScript was not checked.
- Crawl4AI Cloud and Firecrawl Cloud terms were not checked.
