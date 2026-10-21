# LinkPeek link reading: competitors and measurement

Checked 21 Oct 2026. Repo read at the local checkout `/home/user/linkpeek`, commit `f6c99c8` per `handoff.md`.

Scope and method. I read `handoff.md`, `todo.md`, `docs/progress.md`, `docs/compat/part-04-live.md`, `scripts/live-check.mjs` and `docs/privacy.md`, and grepped `src/` for redirect handling and failure reasons. I did not read `/home/user/reports`, `/home/user/research_notes` (other than creating this folder) or `docs/research/competitors-2026-10.md`, so this review does not depend on earlier conclusions. I fetched primary pages where they loaded. Where a page did not load, the finding comes from a search snippet and says so. I used about 52 tool calls, well above the usual budget of 10 to 15, because the brief covered about ten products plus measurement. One fetched page (Diffbot pricing) included text that read like an instruction to the reader. I ignored it.

## Key question 1. How do the products get text from JavaScript pages?

### Takeaway

Only Microlink documents, on a page I could read, that it runs page scripts in a real Chromium before capture. Iframely, Diffbot, Readwise and Instapaper did not document their method on pages I could reach. Browser-built readers work on the page the browser has already rendered, so scripts have run by then, but no extension can call them.

### Cited Findings

- Microlink says "Every request runs in a real Chromium instance" and "React, Vue, Svelte and Angular apps are rendered before capture." It says "A plain HTTP fetch gives you an empty shell on any modern site." These are vendor claims. Waits are `waitUntil` (network settle) and `waitFor` (a selector or a fixed time). The page gives a "P95 cold response" of 2.0 s. [Microlink HTML](https://microlink.io/html), checked 21 Oct 2026.
- Iframely's pricing page does not mention JavaScript rendering or headless browsers. Its privacy page calls it a "Data Processor for content retrieval, display, and caching of public URLs on behalf of Customers." Whether it runs a browser is not stated. [Iframely pricing](https://iframely.com/pricing); [Iframely privacy](https://iframely.com/privacy).
- Diffbot's pricing page does not mention rendering or the Article API. A search found no Diffbot document on JavaScript rendering. [Diffbot pricing](https://www.diffbot.com/pricing/).
- Readwise Highlighter's store listing says it sends pages into Reader and requires a Readwise account. It does not say whether the browser sends the rendered page or Readwise fetches the URL. [Readwise Highlighter listing](https://chromewebstore.google.com/detail/readwise-highlighter/jjhefcfhmnkfeepcpnilbbkaadhngkbi).
- The official Instapaper Chrome extension "works by saving the current tab to your Instapaper account." The official Firefox add-on metadata, seen only as a search snippet, says it collects "page URLs, HTML, and selected text" when the user acts. [Instapaper listing](https://chromewebstore.google.com/detail/instapaper/ldjkgaaoikpmhmkelcgkgacicjfbofhh); [Firefox add-on](https://addons.mozilla.org/firefox/addon/instapaper-official/).
- Chromium's developer doc says Chrome's desktop reader mode is built on DOM Distiller. It keeps the main text and drops images, interface elements and scripts. The doc exists in several revisions and may be out of date. [Chromium reader_mode.md](https://chromium.googlesource.com/chromium/src/+/47cd4f581fdc93cbca03bc94de084cd418c8c59e/docs/accessibility/reader_mode.md).
- Brave's SpeedReader, per Brave's own research post, removes non-essential content "before page load" on pages it judges suitable. Brave claims 20x to 27x faster loads on those pages. These are self-reported. [Brave SpeedReader](https://brave.com/research/speedreader-reader-mode-made-fast-and-private/).
- Edge Immersive Reader opens with F9, or with "Open in Immersive Reader" from the context menu after selecting text. Microsoft's support page does not say how it processes a page. A Microsoft Q&A answer, seen only as a search snippet, says the button is missing on some pages because Edge "can't figure out how to process" them. [Microsoft support](https://support.microsoft.com/topic/78a7a17d-52e1-47ee-b0ac-eff8539015e1).
- Pocket no longer exists. Mozilla announced the shutdown on 22 May 2025, and the service stopped on 8 July 2025 ([9to5Mac](https://9to5mac.com/2025/05/22/mozilla-announces-shutdown-of-pocket/)). Press at the time gave 8 Oct 2025 as the deletion date. The Mozilla support article, seen only as a search summary because the fetch did not render, gives 12 Nov 2025 ([Mozilla support](https://support.mozilla.org/en-US/kb/future-of-pocket)). Either way, no Pocket data is available in October 2026.
- LinkPeek reads the HTML the server returns and does not run page scripts. A page that builds its text in the browser comes back nearly empty. `handoff.md` line 19; `todo.md` line 13.

### Inferences

- Browser-built readers handle JavaScript pages because they act on the DOM after scripts have run. This follows from how Chrome and Edge invoke them on the current tab. No primary source states it.
- A server product that runs scripts must run a browser, which costs more than a plain fetch. That is why the prices in Key question 4 are per request or per credit.
- LinkPeek's gap has two possible fixes, and both carry a cost. Either the extension gets rendered text from the target page in a tab it can script (this needs host access to that site), or a server renders the page (this sends every opened URL to a third party).

### Gaps

- Iframely's and Diffbot's extraction method: no document reached.
- Whether Readwise and Instapaper render in the browser or on their servers: listing text only.
- Safari Reader's method: no Apple document found. A 2021 WebKit bug report (search snippet, [WebKit bug 226853](https://bugs.webkit.org/show_bug.cgi?id=226853)) says Reader can drop text that belongs to the article. Its current status is not confirmed.
- Whether Chrome, Edge or Brave reader processing leaves the device: not stated in the pages I read.

## Key question 2. What permissions do they need?

### Takeaway

A Chrome extension can get access to the tab the user invokes (activeTab) without a prompt. It can also get host access for a specific site at runtime with an optional host permission. A hover card for a link to another site needs access to that other site. activeTab does not give that for a tab the user did not invoke. The store listings for the official Readwise and Instapaper extensions do not show their permissions in the text I could fetch.

### Cited Findings

- activeTab "gives an extension temporary access to the currently active tab when the user invokes the extension." Invocation means an action click, a context menu item, a keyboard shortcut from the commands API, or an omnibox suggestion. Access "lasts while the user is on that page, and is revoked when the user navigates away or closes the tab." The docs do not address tabs the extension opens. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
- Optional host permissions are "Granted by the user at runtime, instead of at install time." The docs say "Consider using optional permissions wherever the functionality of your extension permits." They do not say whether each runtime request gets its own prompt, and they do not give the install warning text for broad host access. [Chrome declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
- Readwise Highlighter (version 0.18.3, last updated 24 Sep 2026): the fetched listing has no permissions section. Its privacy practices list "Website content." [Listing](https://chromewebstore.google.com/detail/readwise-highlighter/jjhefcfhmnkfeepcpnilbbkaadhngkbi). A third-party scanner, seen as a search snippet, reports high-severity broad host access, a content script on all sites, activeTab, contextMenus, notifications and unlimitedStorage ([ExtensionAuditor](https://extensionauditor.com/scan/readwise-highlighter-jjhefcfhmnkfeepcpnilbbkaadhngkbi)). That is not the manifest, so treat it as unconfirmed.
- Instapaper Chrome extension (version 3.1.2, last updated 6 Nov 2024): the fetched listing has no permissions section. Its privacy practices list "Website content." [Listing](https://chromewebstore.google.com/detail/instapaper/ldjkgaaoikpmhmkelcgkgacicjfbofhh).
- Firefox has `tabs.toggleReaderMode`, which "Toggles Reader Mode for the given tab." Its `tabId` is optional and defaults to the current tab. The page does not say it returns article text. [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/toggleReaderMode). The compatibility table did not load, so "Firefox only" rests on the page and on Chrome's API index not listing an equivalent.
- Chrome's extension API index (85 APIs, checked 21 Oct 2026) has no reader, distiller or article-extraction API. The closest is `readingList`, which reads and changes items in Chrome's Reading List (Chrome 120 and later). [Chrome API index](https://developer.chrome.com/docs/extensions/reference/api).

### Inferences

- For LinkPeek's hover card, the grant that matters is host access to the linked site, not reader mode. The per-site prompts versus one all-sites grant is therefore a host-permission decision, as `handoff.md` already says.
- activeTab does not cover a link's destination unless the user opens that page. A hidden tab opened by the extension would need host access to that origin. This follows from the activeTab wording, which ties the grant to the tab the user invoked.
- Firefox's toggle does not solve the problem for LinkPeek. It can switch a tab into reader view, but the page does not say it returns text to the extension.

### Gaps

- Install warnings and per-prompt behaviour for Edge, Brave, Safari and Firefox: not checked.
- The install warning text for broad host access: not confirmed from Chrome's docs.
- Readwise and Instapaper manifests: not readable from the listings.
- Whether Safari Web Extensions can open or read Safari's reader: not checked.

## Key question 3. Privacy terms and what each keeps

### Takeaway

The products I could check all say they do not sell data and use service providers. Iframely caches URL data for up to 30 days and calls it "not considered private." Microlink's policy gives no retention period for submitted URLs. Readwise gives no retention period either. Readwise's and Instapaper's store declarations list "Website content" as collected. The Chrome Web Store's Limited Use rules prohibit collecting web browsing activity, so any telemetry has to be designed around them.

### Cited Findings

- Iframely (policy effective 30 Oct 2025, last reviewed 19 Oct 2026): "URL data is cached by Iframely for up to thirty days and deleted when no longer used." Billing usage records "remains available in itemized form for up to one month." "Customers' URL data is not considered private." Deletion on request by email. Payments go through Stripe. Media providers such as YouTube and Meta are named. [Iframely privacy](https://iframely.com/privacy).
- Microlink (no date shown on the policy): API data is "handled like website analytics data." The policy names no retention period for submitted URLs or rendered output, no sub-processor for the API, and no statement on sale. Deletion is not addressed beyond withdrawing consent. It names Google Analytics. [Microlink privacy](https://microlink.io/privacy).
- Diffbot: the privacy policy URL returned HTTP 404. Not verified.
- Readwise privacy (last revised 20 Dec 2024): no fixed retention period, only "for as long as is necessary." Service providers include those for "customer support, content moderation, hosting, analytics, email delivery." Payments go through Stripe. Google Analytics is used. "Our business model has never been to sell data and it never will." The policy does not say whether saved content goes to AI providers. [Readwise privacy](https://readwise.io/privacy).
- Instapaper: the store listing declares "Website content" as collected, not sold, and not used for unrelated purposes. The privacy policy page returned only its title, so its retention terms are not verified. [Instapaper listing](https://chromewebstore.google.com/detail/instapaper/ldjkgaaoikpmhmkelcgkgacicjfbofhh).
- Chrome Web Store Limited Use policy. Item 4: "Collection and use of web browsing activity is prohibited." Item 5.2: "Only transfer user data to third parties." Item 5.4.2 prohibits "transferring or selling user data to third parties like advertising platforms, data brokers, or other information resellers." Item 6 requires "An affirmative statement that your use of the data complies with the Limited Use restrictions," on a website connected to the extension. The page does not define "user data." The exceptions to item 4 were not visible in the text I fetched. [Chrome Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use).
- Built-in readers (Chrome, Edge, Brave, Safari) need no account. Their privacy statements for the reader features were not checked. Brave's SpeedReader claims are self-reported.

### Inferences

- A third-party fetch or render service would receive every URL the user opens a card for. That contradicts the current promise in `docs/privacy.md` lines 7 to 13: LinkPeek "fetches that one page from the website the link points to," and "Nothing is sent onward." So any fallback through Iframely, Microlink or Diffbot would change the privacy note. Iframely's policy says it keeps URL data for up to 30 days, which means the URL would be stored at that service.
- Telemetry that names the hostnames of clicked links is "web browsing activity" in plain terms, so it is the risky category under Limited Use. Reason codes with no hostname are a different case. The owner needs the full policy text, and possibly legal advice, before anything that sends counts ships.

### Gaps

- Readwise and Instapaper retention in full. The Instapaper policy page was not reached.
- Edge, Brave and Chrome built-in privacy statements: not read.
- Whether Iframely or Microlink log URLs in analytics: not stated beyond the Google Analytics mention.

## Key question 4. Pricing and limits

### Takeaway

Hosted extraction APIs charge per request, per hit or per credit. Microlink Pro works out at about $0.001 per request, and Diffbot Startup at about $0.0012 per credit. A fallback for failed links only would cost little at low volume, but each product has a monthly minimum. The built-in readers have no price.

### Cited Findings

- Iframely pricing (checked 21 Oct 2026): Starter $0 with 2,000 hits per month and $0.40 per additional 100 hits, for one brand. Business $49 with 25,000 hits. Editorial $149 with 100,000. Enterprise $399 with 500,000. Custom above that. For previews, "a 'hit' is an hour of URL activity on Iframely." For the Data API, "a 'hit' is each individual request." A third-party directory, seen as a search snippet, gives 1,000 free hits. I used the vendor page. [Iframely pricing](https://iframely.com/pricing).
- Microlink (checked 21 Oct 2026): Free $0 with 100 requests per month and no payment method. Pro $49 with 46,000 requests per month (about $1.07 per 1,000). No price is shown for Business or Enterprise. [Microlink HTML](https://microlink.io/html).
- Diffbot (checked 21 Oct 2026): Free $0 with 10,000 credits per month (the calculator shows 9,500) and 5 requests per minute. Startup $299 with 250,000 credits, overage $0.001 per credit. Plus $899 with 1,000,000 credits, overage $0.0009 per credit. "Extract 1 page" costs 1 credit, and "Extract 1 page via datacenter proxy" costs 2 credits. The page does not say whether rendering costs extra. [Diffbot pricing](https://www.diffbot.com/pricing/).
- Readwise Highlighter: free extension, with a Readwise account required ([listing](https://chromewebstore.google.com/detail/readwise-highlighter/jjhefcfhmnkfeepcpnilbbkaadhngkbi)). The account price was not retrieved.
- Instapaper: price not retrieved. The subscribe page returned only its title ([Instapaper](https://www.instapaper.com/subscribe)).
- Pocket: discontinued (see Key question 1).
- Chrome reading mode, Brave SpeedReader, Edge Immersive Reader and Safari Reader are built into the browser. No separate price was found, and limits were not checked.
- LinkPeek's own backend is on Vercel's Hobby plan, which `docs/progress.md` says is for personal, non-commercial use.

### Inferences

- At Microlink Pro's rate, 1,000 fallback requests cost about $1.07. The cost of a fallback depends on the failure rate and the number of users, so it cannot be known until the failure rate is measured.
- Iframely's hits are time-based for previews, so its numbers cannot be compared with per-request prices.

### Gaps

- Instapaper and Readwise prices.
- Diffbot rendering cost: not on its pricing page.

## Key question 5. Can an extension use a browser-built reader?

### Takeaway

No Chrome extension API opens Chrome's reading mode or returns its text. I checked Chrome's API index on 21 Oct 2026. Firefox's `tabs.toggleReaderMode` can switch a tab into reader view, but the MDN page does not say it returns article text. Browser readers need no extension permission for the user, but an extension cannot use them to get text for a card. The working route is the one LinkPeek already has, which reads the page with Readability and still needs host access to the target.

### Cited Findings

- Chrome API index: no reader API. `readingList` exists for the Reading List only. [Chrome API index](https://developer.chrome.com/docs/extensions/reference/api).
- Firefox `tabs.toggleReaderMode`: "Toggles Reader Mode for the given tab." The promise is rejected with an error, for example when "the page was not an article." [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/toggleReaderMode).
- Chrome's Link Preview, a flag-gated overlay triggered by Alt+Click, Alt+Hover or Long Press (`chrome://flags/#link-preview`), was reported removed from desktop Chromium in a Gerrit commit. This is from an OnMSFT article seen as a search snippet ([OnMSFT](https://onmsft.com/?p=58741)). The Chrome version was not confirmed. The feature showed the page itself, not a summary. `docs/progress.md` says Chrome 149. I did not confirm that.
- The Chromium reader mode doc says the desktop version was hidden behind a feature flag. It may be out of date ([Chromium doc](https://chromium.googlesource.com/chromium/src/+/47cd4f581fdc93cbca03bc94de084cd418c8c59e/docs/accessibility/reader_mode.md)).

### Inferences

- The only way to get rendered text for a link in Chrome is to load the target in a tab the extension can script. That needs host access to the target site, or a user action on that tab.
- LinkPeek's reader already does the extraction step that browser reader modes do (Readability on fetched HTML, `docs/progress.md` Part 04). The difference is the input: the rendered DOM versus the server HTML.

### Gaps

- Edge and Brave: whether either exposes a reader API to extensions. Not checked.
- Safari: no extension path checked.
- The Chrome version that removed Link Preview.

## Key question 6. How common are JavaScript-built pages? (published figures)

### Takeaway

The HTTP Archive Web Almanac JavaScript chapter does not measure how much content depends on JavaScript. The two published figures that do are a 2023 academic study (43% of pages not strictly dependent on JavaScript) and a 2026 vendor report (40.6% of landing pages serve empty shells to HTTP scrapers). Their definitions differ, and neither covers news links. No source I found gives the share of news article links that need JavaScript, so LinkPeek would have to measure it.

### Cited Findings

- Web Almanac 2024 JavaScript chapter (page date shown as 3 Mar 2025 in the text I fetched): no figure on content dependence, client-side rendering, empty shells or hydration. Its figures are library use (jQuery 75% desktop and 74% mobile; React 10% on both) and median JavaScript (613 KB desktop, 558 KB mobile). The chapter does not state its crawl date. [Web Almanac 2024 JavaScript](https://almanac.httparchive.org/en/2024/javascript).
- Web Almanac 2025 JavaScript chapter: the URL returned HTTP 404 on 21 Oct 2026, and a search found no 2025 JavaScript chapter. This is not confirmed as absent from the edition. [URL](https://almanac.httparchive.org/en/2025/javascript).
- Web Almanac 2025 methodology: "all metrics were sourced from the July 2025 crawl." The dataset covers 16,213,084 websites (15,426,398 mobile, 12,155,374 desktop). The site list comes from CrUX 202507. Tests run on WebPageTest private agents with Chrome 138 (desktop on a Linux VM, mobile on an emulated Moto G4). "All pages are tested with an empty cache in a logged out state." The page calls HTTP Archive "a lab testing tool, meaning it tests websites from a datacenter." It does not say whether JavaScript runs. The tests use real Chrome, so it probably does (inference). [Methodology](https://almanac.httparchive.org/en/2025/methodology).
- Academic: "Breaking Bad: Quantifying the Addiction of Web Elements to JavaScript," arXiv 2301.10597, submitted 25 Jan 2023, "ACM Transactions on Internet Technology, In press" per the arXiv comment. Sample: "6,384 pages, including landing and internal web pages." Method: JavaScript disabled in the browser. "43% of web pages are not strictly dependent on JavaScript." "More than 67% of pages are likely to be usable as long as the visitor only requires the content from the main section." So at most about a third of pages were not usable for main content with JavaScript off (my arithmetic). The measurement date and sampling method are not in the abstract. [arXiv](https://arxiv.org/abs/2301.10597).
- Zyte, "State of Web Access 2026": "40.6% of landing pages serve empty shells to HTTP scrapers — the content only appears after JavaScript runs." The page header gives 11,100 landing pages. Later figures are 10,087 landing pages "where content difference was measurable" and 3,669 "JS-required sites." It gives 230 countries in one place and 221 in another. It defines no test for "requires JavaScript," gives no crawl method or date, and says "JavaScript adoption clusters near 45% globally" without explaining the gap to 40.6%. It is a vendor report from a scraping company. [Zyte](https://www.zyte.com/sowa/2026/barriers/javascript).
- Onely analysis, seen as a search snippet via Search Engine Journal and not fetched: 25% of analysed pages had "crucial JavaScript content that was unindexed by Google." This measures indexing, not what a page shows without scripts. [SEJ](https://www.searchenginejournal.com/80-of-major-us-e-commerce-stores-use-javascript-for-crucial-content/338113/).
- LinkPeek's own live check of 10 pages (17 Oct 2026): one page (YouTube) returned `js-rendered-empty`. Two others were a login wall and a paywall. That is too small to estimate a rate. [live check](/home/user/linkpeek/docs/compat/part-04-live.md).

### Inferences

- The 2023 study and the 2026 vendor report both put a large share of sites, roughly 40 to 60 percent, in a JavaScript-dependent group. The definitions do not match, so the two numbers cannot be compared directly. The 57% that is the complement of 43% is my arithmetic, not a figure in the paper, and the paper's own wording is "not strictly dependent."
- For LinkPeek, the relevant number is the share of news links where the reader gets under 50 words with JavaScript off. No published source gives it.

### Gaps

- The Web Almanac 2025 JavaScript chapter, at the expected URL.
- The crawl date of the 2024 Almanac, and its methodology page.
- Zyte's method.
- The HTTP Archive BigQuery and Common Crawl access costs. The BigQuery pricing fetch was truncated, so the free-tier figure is unverified.

## Key question 7. Measurement options

Each option lists what it shows, what it cannot show, its privacy effect on `docs/privacy.md`, and its cost.

### Option 0. The owner's manual check (no build)

- What it does: the owner opens the four Facebook links, and for each one records the full URL, the text the card shows and the message. Before clicking, the owner also reads the link address to see whether it is a Facebook redirect.
- Shows: exact failures for four links, with the messages LinkPeek shows.
- Cannot show: anything beyond those four links.
- Privacy effect: none.
- Cost: under an hour for the owner.
- Why it matters: `handoff.md` still lists this as step 2. The source has no redirect unwrapping. My grep of `src/` found no `l.facebook.com` or `l.php` handling, and `facebook.com` appears only in `SOCIAL_HOSTS` in `src/core/detect/classify.ts` line 103. I could not confirm whether Facebook's outbound links still pass through a redirect in 2026.

### Option A. Local-only failure counter with an export

- What it does: on each card result, count the failure reason code per day in `chrome.storage.local`. The codes are the `FailureReason` values in `src/core/types.ts` (for example `js-rendered-empty`). A button in Settings saves the counts as a JSON file. The user can attach that file to a report by hand. Nothing goes over the network.
- Shows: this user's failure mix and daily counts, using the codes the code assigned.
- Cannot show: population rates, which sites failed (unless hostnames are stored), or whether a reason code was right. A reason is the classifier's guess, and it only gets checked when someone compares it with the real page.
- Privacy effect: nothing leaves the device unless the user exports the file and sends it. It adds a row to the stored-data table in `docs/privacy.md`. Storing hostnames would make the line "No browsing history is kept" (line 52) false, so store reason codes and counts only, with no hostnames and no paths. The feedback votes already keep hostnames on the device (line 46), which is a precedent, but it is not a reason to add more.
- Cost: about one day to build and test. No hosting and no running cost. One privacy-doc change.

### Option B. Opt-in anonymous count of failure reasons sent to the project

- What it would send: a daily batch of `{reason code: count}`, with the LinkPeek version and browser major version. No URLs, no hostnames and no install ID, so counts cannot be linked across days. Counts below a set threshold would be dropped, because small counts can identify people. The endpoint would sit beside `/api/summarise` in `server/`, with the same logging rules (counts only). Vercel still sees IP addresses, as `docs/privacy.md` already says.
- Shows: the population mix of failure reasons for each version, and whether a fix moved the mix. This is the only option that gives population numbers.
- Cannot show: which sites failed, whether a reason code was right, or a rate per link opened (the denominator is unknown unless the extension also sends the number of cards opened). People who opt in are not a random sample.
- Privacy effect: material. `docs/privacy.md` line 5 says LinkPeek's server "is only used if you choose 'LinkPeek's AI'," and line 50 says no page text is sent "unless you've asked for a feature that needs it." Both would need updating to describe the counts. The default must stay off. The Chrome Web Store privacy form would need the new data category. The Limited Use text above must be read in full before anything ships.
- Cost: one to three days to build with tests, an endpoint, storage, rate limiting and privacy text. Storage pricing was not checked. Storing user-sent counts on the Hobby plan needs a check of Vercel's terms, because the plan is for personal, non-commercial use.

### Option C. Fixed, project-maintained test list run on a schedule

- What it does: the owner keeps a list of 60 to 100 public URLs across types (UK news, pages a Facebook post might link to, government, blogs, Medium and Substack, PDFs, and known JavaScript-built pages). Each URL gets a human-labelled expected result. A scheduled runner (GitHub Actions on this public repo) runs LinkPeek's reader on the list. For each URL it also loads the page in headless Chromium, compares the visible text with the text in the server HTML, and records whether `looksJsRendered` (`src/core/retrieve/diagnose.ts` line 91) agrees with what the rendered page shows.
- Shows: regressions between versions on a fixed mix. It also shows whether the "browser tab" rule fires correctly on pages a human has labelled, which is the check in `todo.md` item 4. It shows the share of JavaScript-dependent pages within the list (not in the population).
- Cannot show: what users actually click, population rates, or behaviour from home connections. The runner uses a data-centre address, as the 17 Oct live check did. In that run, repeated fetches from one address drew Google's robot check on YouTube.
- Privacy effect: none for users, and no user data is involved. The runner does send requests to third-party sites. The owner should set the rules: check `robots.txt` before each run (`scripts/live-check.mjs` does not check it, and I read the whole file), limit the rate, and identify the project in the requests. This is a decision for the owner, not a privacy-doc change.
- Cost: GitHub's billing docs say standard GitHub-hosted runners are free in public repositories ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), seen as a search summary). About one to two days to build, including the labels. Upkeep: sites change, so the list needs review, which I estimate at a few hours a month.

### Option D. Public datasets

- HTTP Archive and the Web Almanac: population trends in web technology. They do not measure content dependence (see Key question 6), and they are a datacenter lab run. They do not measure LinkPeek's links.
- Common Crawl (access not verified in this run): archived HTML. Running the reader on saved HTML tests the "no scripts" case without any new requests to sites. It shows how the reader does on archived server HTML, not on what users click. Access cost not verified.
- HTTP Archive through BigQuery: query cost not verified. The free-tier figure in my notes is from memory, not from the page.
- Shows: population context, and an offline test set.
- Cannot show: LinkPeek's own failure rates, because the URLs in these datasets are not what LinkPeek users open.
- Privacy effect: none.
- Cost: a few hours of analysis. BigQuery and Common Crawl costs are unverified.

### Option E. User-submitted report with the URL (not recommended as a default)

- What it does: a "this link failed" button that sends the reason and the URL.
- Shows: exact failures, with the page to check.
- Cannot show: population numbers beyond the people who press the button.
- Privacy effect: the highest of the options. Each report sends a URL the user chose to open, which is web browsing activity under Limited Use. Hashing the URL would not make it anonymous, because the pages on the web can be listed and checked against the hashes. This last point is my reasoning, not a sourced claim.
- Cost: moderate to build, and a high privacy-review cost.

## Key question 8. Recommended plan and the owner's decision

### Takeaway

Do Option 0 now. Then build Option C and Option A together. Neither changes what LinkPeek sends, and together they answer "is the reader right on a labelled set" and "what is failing for me." Neither answers how often real users' links fail. Only Option B does that. Because B changes the privacy promise, it is the owner's decision, and it should be taken after the first results from C.

### Plan

1. Owner: Option 0. Send the four full URLs and what each card showed. The `handoff.md` step 2 needs them anyway.
2. Build Option C. Start with 60 to 100 labelled URLs. Run the rendered-text comparison and report the results as a dated table in `docs/compat/`. Use the list to check the `looksJsRendered` rule (`todo.md` item 4). Respect `robots.txt`, limit the rate, and run it on a schedule (weekly is enough for a list this size, my estimate).
3. Build Option A. Store reason codes and counts per day, with no hostnames and no paths, and add an Export button. Update the stored-data table in `docs/privacy.md`.
4. After two to four weeks of C, look at the mix. If JavaScript-built pages are a large share of failures, the owner can decide whether to pay for a hidden-tab fix (which needs a host permission for each site) or a server fallback (which needs a privacy change and a cost). Either way, the owner decides, and it is not a measurement decision.

### Decision the owner must make

Should LinkPeek send an opt-in, anonymous count of failure reasons (no addresses, no hostnames, no install ID) to a project server, so that population numbers exist? The default would stay off. A yes changes `docs/privacy.md` lines 5 and 48 to 53, needs a new category in the Chrome Web Store privacy form, and needs a full Limited Use review. A no means measurement stays limited to the labelled list and to what each user chooses to export.

A second, smaller decision: does the owner accept the project's scheduled runner making requests to third-party sites, with `robots.txt` checks and rate limits?

### What would change this plan

- If the owner needs population numbers within a month, Option B moves first. It then needs the labelled set from Option C to mean anything, because a reason code that is wrong at scale is still wrong.
- If the full Limited Use text forbids even hostname-free counts, Option B is out.
- If Facebook's outbound links are redirected, the test list should include redirect wrappers and LinkPeek may need to unwrap them. Not checked.

## Consolidated gaps

- Not reached or not confirmed: Iframely and Diffbot extraction method; Diffbot privacy policy (404); Instapaper policy page and prices; Readwise and Instapaper manifests; Pocket's exact deletion date (sources conflict); Safari Reader internals; Edge and Brave reader APIs and privacy; install warning text for broad host access; Chrome's Link Preview removal version; the 2025 Web Almanac JavaScript chapter (404 at the expected URL); the 2024 Almanac crawl date; Zyte's method; BigQuery and Common Crawl costs; Vercel storage pricing; whether Facebook's links are redirected in 2026.
- Not checked in this run: the Limited Use exceptions to item 4 (only one sentence of it was visible); Edge, Brave, Safari and Firefox install warnings.
