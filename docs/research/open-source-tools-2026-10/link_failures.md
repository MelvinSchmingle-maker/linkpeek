# Open source tools for LinkPeek links: failure types

Research date: 21 Oct 2026. Scope: how open-source link previewers, readers and metadata libraries handle links that fail for reasons other than JavaScript. Nothing was cloned, installed or run. No news site was tested. No GitHub search tool was used. Discovery used WebSearch and WebFetch only.

## How to read this file

- Stars come from repo pages as WebFetch returned them on 2026-10-21. No repo page showed a date next to its star count, so each star figure is dated only by when I saw it.
- "Last commit: not seen" means the repo page's commit column was empty in the fetch. The one dated status found is an archive notice (unfurl.js).
- Each fact carries an inline link. Where a fact came only from a search snippet or a third-party page, the record says so.
- Tool calls: about 28, above the usual budget of 15, because the scope covers six failure types.
- LinkPeek facts come from `/home/user/linkpeek/` (handoff, todo, `docs/decisions.md` D24 to D27, `docs/permissions.md`, `build-plan/00-ground-rules.md`) and the source files named below.

## Summary

| Failure type | Top pick | Verdict |
|---|---|---|
| 1. Redirects and wrappers | ClearURLs Facebook rule (LGPL-3.0) | Decodes on the device. t.co and bit.ly need a request, and no library was verified for them. |
| 2. Consent walls | None to adopt | The two verified auto-answer tools act without asking. Detect and disclose, do not click. |
| 3. Late-loading text | Mozilla Readability (Apache-2.0), metascraper (MIT) | Both work on HTML already fetched. Neither runs scripts. |
| 4. PDFs | pdf.js (Apache-2.0) | Already used. Fits the offscreen document. |
| 5. Bot checks | None | The verified bypass tools break the rules. Show a failure. |
| 6. Non-article pages | Readability's isProbablyReaderable | A rough heuristic with false positives and negatives. |

## 1. Redirects and link wrappers

### Takeaway

A verified rule decodes Facebook's l.php wrapper on the device. Nothing verified decodes t.co or bit.ly without a request, and Google News needs a call to a Google endpoint.

### Candidate records

**ClearURLs rules (Facebook l.php)**
- Name and URL: ClearURLs add-on, https://github.com/ClearURLs/Addon. Rules data at https://gitlab.com/anti-tracking/ClearURLs/rules/-/raw/master/data.min.json, the rules repo the add-on's README points to.
- What it does: a browser add-on that strips tracking parameters and, through its rules, takes the destination out of redirect wrappers. Its README says it "Supports redirection to the destination, without tracking services as middleman" ([ClearURLs README](https://github.com/ClearURLs/Addon)).
- The Facebook rule (`providers.facebook.redirections`) is `^https?:\/\/l[a-z]?\.facebook\.com/l\.php\?.*?u=(https?%3A%2F%2F[^&]*)` ([ClearURLs rules](https://gitlab.com/anti-tracking/ClearURLs/rules/-/raw/master/data.min.json)). The captured value is percent-encoded, so it needs one decode. The capture stops at the next `&`, which leaves out the wrapper's `h` and `s` parameters. That reading is mine, taken from the regex.
- Licence: LGPL-3.0 for the add-on ([ClearURLs repo page](https://github.com/ClearURLs/Addon)). The rules repo's licence was not stated.
- Last commit: not seen. Stars: 5.1k, seen 2026-10-21, no date on page.
- Maintained: unclear. The page showed 1,011 commits and no commit date.
- Where it plugs in: extension. Run the regex on link `href`s already in the page. No new permission, because the links are already in the DOM.
- What it sends off the device: nothing. The match is local.
- Main risk: the rule matches today's wrapper format, and Facebook can change it. The same file also has a `messenger.com` rule and an `instagram` rule that matches any `u=` parameter. Copy only the Facebook entry. The LGPL-3.0 licence needs an owner decision: copying a data file is different from writing our own regex.
- Constraint check: passes, with a flag. LGPL-3.0 is in the GPL family, so the project rule says flag.
- How verified: WebFetch of the add-on repo page (README statements). WebFetch of the rules file, which is 106,070 characters. The tool read the first 100,000 characters, and the Facebook entry was in that part. The last 6,070 characters were not read.

**Google News decoder (googlenewsdecoder)**
- Name and URL: googlenewsdecoder on PyPI, https://pypi.org/project/googlenewsdecoder. WebFetch of that page failed, so this record rests on search snippets.
- What it does: decodes news.google.com article links to the original address. A search summary says it "tries news.google.com/articles first and falls back to news.google.com/rss/articles" ([PyPI, via search summary](https://pypi.org/project/googlenewsdecoder)). An Elixir port's readme says it "calls Google's internal batchexecute endpoint" ([hex.pm readme, via search summary](https://readme.hex.pm/google_news_decoder/0.1.0)).
- Licence: not verified. Last commit: not seen. Stars: not seen.
- Maintained: unclear.
- Where it plugs in: backend, since the published packages are Python and Elixir. A JavaScript port would run in the extension and need access to news.google.com.
- What it sends off the device: the Google News link, to Google's endpoint. Run from the backend, LinkPeek's server would send it first.
- Main risk: it calls an internal, unofficial endpoint. A search summary says Google can rate-limit the calls with HTTP 429 ([PyPI, via search summary](https://pypi.org/project/googlenewsdecoder)).
- Constraint check: not passed. The call goes to a third party, so the privacy rule needs the terms and the data sent to be named before use.
- How verified: search snippets only.

**Fetch that follows the redirect (no library)**
- What it does: t.co and bit.ly answer with an HTTP redirect, so a request to them returns the destination. LinkPeek's own fetcher already does this: `redirect: 'follow'` and `finalUrl` in `src/core/retrieve/fetcher.ts`, with a test "follows ordinary redirects and records where it ended up" in `src/core/retrieve/fetcher.test.ts`. This is LinkPeek's code, not an open-source library.
- Licence: not applicable.
- Where it plugs in: extension. It needs access to the shortener's host, which LinkPeek does not have after install. The existing "Allow access" card flow covers this. The landing site may need its own access.
- What it sends off the device: a request to t.co or bit.ly with no cookies. D24 already does this for same-site and allowed-site links.
- Main risk: the landing page is on another site, which LinkPeek may not be allowed to read. How Chrome treats a redirect into a site without permission is not verified.
- Constraint check: passes. No cookies, no keys, and access is asked for when the user acts.
- How verified: LinkPeek source and test names, read locally.

### Inferences

- Decoding on the device works for wrappers that carry the target in a query parameter, such as Facebook's l.php and Google's `/url?q=`. Shorteners and Google News need a request each time.
- A 2014 Launchpad mailing-list post says a simple prefix trim is not enough and a regex is needed ([Launchpad thread](https://archive.lists.launchpad.net/touch-packages/msg32427.html), search snippet). The ClearURLs regex takes that approach. The post is old, so it is background only.

### Gaps

- No open-source unshortener library for t.co or bit.ly was verified.
- The Google News decoder's licence, repo and network path are unconfirmed, because the PyPI page did not load.
- The Facebook regex has not been run against a live wrapper link. A unit test with a synthetic link would show whether it still matches.
- Chrome's treatment of a redirect into a site without access is unverified.

## 2. Consent and cookie walls

### Takeaway

No verified tool is a fit as a clicker for LinkPeek. Consent-O-Matic and DuckDuckGo's autoconsent both answer consent popups without asking the user at each one, and the README of neither states its default. LinkPeek does not run page scripts (D25), so a JavaScript consent overlay usually does not run. The better approach is to detect the banner, say so on the card, and keep the banner's words out of the extracted text. Do not click.

### Candidate records (all flagged, none shortlisted)

**Consent-O-Matic**
- Name and URL: https://github.com/cavi-au/Consent-O-Matic
- What it does: a browser extension that handles consent popups for the user. Its README says it "automatically handles consent banners on your behalf" ([repo page](https://github.com/cavi-au/Consent-O-Matic)). The raw README says: "After you set your preferences during installation" ([raw README](https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/HEAD/README.md)).
- Licence: MIT, from the raw LICENSE file ([LICENSE](https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/HEAD/LICENSE)). The repo page did not name it.
- Last commit: not seen. Stars: 4.3k, seen 2026-10-21, no date on page.
- Maintained: unclear. No date was visible.
- Where it plugs in: rule data for banner detection only. Running it would need a content script on every site, which LinkPeek does not hold. That is my inference from its page-by-page on/off design ("You can turn the extension on/off on a page-by-page basis by clicking the icon").
- What it sends off the device: not stated in the README.
- Main risk, and the flag: the raw README does not state the default answer for each popup, and it does not say whether the user is asked each time ("Not stated" in the fetch). The choice is made once, at install. So the tool answers for the user, and the answer cannot be confirmed as reject or accept.
- Constraint check: fails the user-choice rule. It answers consent on the user's behalf, and the user did not decide each popup.
- How verified: WebFetch of the repo page, WebFetch of the raw README, WebFetch of the raw LICENSE.

**autoconsent (DuckDuckGo)**
- Name and URL: https://github.com/duckduckgo/autoconsent
- What it does: a library of rules for working through consent popups. Its README says "opt-in and opt-out options can be selected automatically, without requiring user-input" ([README](https://github.com/duckduckgo/autoconsent)).
- Licence: MPL-2.0 (repo sidebar).
- Last commit: not seen. Stars: 131, seen 2026-10-21, no date. The page showed 2,298 commits.
- Maintained: unclear. No date was visible.
- Where it plugs in: content script for the runtime, or rule data for detection only.
- What it sends off the device: not stated.
- Main risk: the README states no default. It describes no user override. Its code example maps the text "Reject all" to reject, which shows how a button is classified, not what the default is.
- Constraint check: fails the user-choice rule for the same reason as Consent-O-Matic. MPL-2.0 is file-level copyleft, so it is flagged.
- How verified: WebFetch of the repo page.

**"I still don't care about cookies" fork (OhMyGuus)**
- Name and URL: a fork that a search summary names as OhMyGuus/I-Still-Dont-Care-About-Cookies. The repo was not fetched.
- What it does, per search snippets from [ful.io](https://ful.io/blog/i-still-dont-care-about-cookies-the-extension) and [a Firefox reviews page](https://firefox-stats.com/d/istilldontcareaboutcookies/reviews): it hides or blocks cookie pop-ups, and "accepts the cookie policy automatically when the site needs it to work."
- Licence: GPL-3.0, per the same snippets.
- Stars: 3,157 (Ecosyste.ms) and 4,140 (AlternativeTo). These are third-party snapshots, not the repo page. Last commit: not seen.
- Maintained: disputed in the snippets. One reviewer says it has been "a bit unmaintained for a year". Another says there were 5 releases in 2025.
- Constraint check: fails the user-choice rule, since it accepts for the user (per snippet). GPL-3.0 is flagged.
- How verified: search snippets only.

### Inferences

- Do not try to click a consent control. Detect a consent wall using consent-manager patterns, show a line on the card that the text may be incomplete, and keep the banner's own words out of the summary.
- autoconsent's rule set could serve as a detection list, if its licence and file layout allow it. MPL-2.0 is file-level copyleft, so copying single entries needs a check.

### Gaps

- Consent-O-Matic's default answer and whether it asks are not in the README. Its rule and config files were not read.
- autoconsent's choice when both accept and reject exist is not stated.
- The OhMyGuus repo page was not fetched.
- Whether a consent overlay's text reaches the HTML that LinkPeek fetches was not tested. No news site was checked.

## 3. Late-loading text and metadata fallbacks

### Takeaway

Mozilla Readability and metascraper both work on HTML that has already been fetched, so neither helps when the text is built only by scripts. metascraper falls back between metadata sources, including JSON-LD. No verified library documents a description-only card. open-graph-scraper has an explicit switch to turn fallbacks off, but it runs on a server.

### Candidate records

**Mozilla Readability**
- Name and URL: https://github.com/mozilla/readability
- Licence: Apache-2.0 (sidebar). Stars: 11.5k, seen 2026-10-21, no date. Last commit: not seen (540 commits on the page).
- What it does: "A standalone version of the readability lib" (repo description). Its README defines `charThreshold` as "the number of characters an article must have in order to return a result", default 500 ([README](https://github.com/mozilla/readability)).
- The README does not mention lazy-loaded content or noscript.
- Where it plugs in: extension. LinkPeek already runs it in the offscreen document (D25).
- What it sends off the device: nothing.
- Maintained: unclear. No commit date was visible.
- Main risk: it reads only the DOM it is given. The README does not cover lazy images or noscript fallbacks. Its 500-character threshold is different from LinkPeek's 150-word rule in D26. The README also says sanitising is not its job.
- Constraint check: passes.
- How verified: WebFetch of the repo page.

**metascraper**
- Name and URL: https://github.com/microlinkhq/metascraper
- Licence: MIT (sidebar). Stars: 2.7k, seen 2026-10-21, no date. Last commit: not seen (2,230 commits on the page).
- What it does: "Scrape metadata from any URL using Open Graph, JSON-LD, HTML meta tags, and smart fallbacks" ([README](https://github.com/microlinkhq/metascraper)). The README says "If the first rule fails, then it falls back on the second rule."
- The README calls its description rule "The publisher's chosen description of the article." It does not give the order of description sources.
- Where it plugs in: extension, on HTML from the offscreen DOMParser (fits D25). Bundle size and whether it runs in a context without a DOM were not checked. A backend is also possible.
- What it sends off the device: nothing when run in the browser.
- Main risk: its page-rendering path is html-get, a headless-browser service. It also offers a paid cloud API for "antibot workarounds" ([README](https://github.com/microlinkhq/metascraper)). Both are excluded (see sections 5 and "breaks a rule").
- Maintained: unclear. No date was visible.
- Constraint check: passes for the library. Fails if html-get or the cloud API is used.
- How verified: WebFetch of the repo page.

**open-graph-scraper**
- Name and URL: https://github.com/jshemas/openGraphScraper
- Licence: MIT. Stars: 754, seen 2026-10-21, no date. Last commit: not seen. No archive notice was shown.
- What it does: a Node module that scrapes Open Graph, Twitter Card and other metadata. Its options table says `onlyGetOpenGraphInfo` means "Only fetch open graph info and don't fall back on anything else" ([README](https://github.com/jshemas/openGraphScraper)). `jsonLDOptions` controls only whether JSON parse errors are thrown or logged.
- Where it plugs in: backend only. It is a Node module that fetches the page itself.
- What it sends off the device: the URL to LinkPeek's server, which then fetches the site. D24 rejects this path: "No LinkPeek server. A server could fetch any site without asking, but it would see every link people preview and would cost money per request."
- Main risk: a server fetch is the design D24 chose against.
- Constraint check: the licence passes. It conflicts with D24, which is a decision the owner can reverse, not a ground rule. It is listed under "breaks a rule" for that reason.
- How verified: WebFetch of the repo page.

Checked and dropped:
- unfurl.js (jacktuck/unfurl): MIT, 497 stars seen 2026-10-21. The repo page says it was "archived by the owner on Jun 12, 2026" and is now read-only. Its README covers oEmbed, Twitter Cards and Open Graph. JSON-LD is not mentioned ([README](https://github.com/jacktuck/unfurl)). Not maintained.

### Inferences

- JSON-LD and Open Graph descriptions in the initial HTML are the usual fallback for text that scripts build later. No site was tested, so this stays an inference.

### Gaps

- Readability's handling of noscript and lazy images needs its source code, not the README.
- metascraper's description source order, and its bundle size in an extension, were not checked.
- No verified library offers a description-only card as a mode. open-graph-scraper's switch does the opposite. LinkPeek's own D26 "partial" state is the closest existing behaviour.
- link-preview-js and the Mercury parser (postlight) were not checked.

## 4. PDFs

### Takeaway

pdf.js (Apache-2.0) is the one verified choice, and LinkPeek already uses it. The README says the worker loads itself, which fits the offscreen document in D25. No second PDF library was verified.

### Candidate records

**pdf.js**
- Name and URL: https://github.com/mozilla/pdf.js
- Licence: Apache-2.0 (sidebar). Stars: 54.0k, seen 2026-10-21, no date. Last commit: not seen.
- What it does: "PDF Reader in JavaScript" (repo description). Its README says it is built into Firefox 19 and later, and that the official Chrome extension is a separate build ([README](https://github.com/mozilla/pdf.js)).
- The README says "only pdf.js needs to be included, because it loads pdf.worker.js itself."
- Where it plugs in: offscreen document. Already in LinkPeek (D25: first 15 pages, font loading and XFA forms off).
- What it sends off the device: nothing. It reads the bytes the fetcher already received.
- Maintained: yes. Mozilla maintains it and ships it in Firefox, per the README. No commit date was visible, so recent activity is not confirmed.
- Main risk: a scanned PDF with no text layer gives no text. pdf.js does not do OCR, and no OCR tool was checked.
- Constraint check: passes.
- How verified: WebFetch of the repo page.

### Inferences

- pdf.js covers PDFs that have a text layer. Scanned PDFs need OCR, which would be a separate tool, and none is on this list.

### Gaps

- The npm package pdfjs-dist, from the same project, was not fetched. Its licence and last publish date would confirm the packaging.
- unpdf and pdf-parse were not checked.
- No OCR option was checked.

## 5. Bot checks (Cloudflare, DataDome and similar)

### Takeaway

No tool on this list gets past a bot check, and none should. The two verified tools that do are bypass tools, which the rules exclude. The reader and metadata libraries checked here have no bypass code and do not claim to handle challenges. The answer "show a failure" rests on LinkPeek's own rules and classifier, not on these projects' documentation.

### Candidate records

No candidate is shortlisted. The verified bypass tools are in "breaks a rule":
- FlareSolverr: MIT, 16.0k stars (seen 2026-10-21, no date). Its README: "FlareSolverr is a proxy server to bypass Cloudflare and DDoS-GUARD protection" ([README](https://github.com/FlareSolverr/FlareSolverr)).
- cloudscraper: MIT, 6.8k stars (seen 2026-10-21, no date). Its README: "A Python module to bypass Cloudflare's anti-bot page (also known as "I'm Under Attack Mode", or IUAM)" ([README](https://github.com/VeNoMouS/cloudscraper)).

Evidence for "show a failure":
- LinkPeek's rule: "HTTP 403, 429, login pages and challenge pages are failures, not article text" (`build-plan/00-ground-rules.md`, privacy and security rules).
- LinkPeek checks robot-check signatures before it reads text, and marks them as failures. This is `looksLikeChallenge` in `src/core/retrieve/diagnose.ts`, and D26 lists robot checks first in the order of checks. A refusal, rate limit or robot check is never retried (D24).
- metascraper's README treats "antibot workarounds" as a cost of running at scale, and sells a service that does them ([README](https://github.com/microlinkhq/metascraper)). That is a warning about the cost, not a method, and the service is excluded.

### Inferences

- Show the specific reason ("blocked by a robot check") and do not retry.

### Gaps

- No open-source reader or metadata library was found whose documentation says to show a failure on a challenge page. The confirmation rests on LinkPeek's rules.
- Cloudflare's own challenge documentation was not fetched.
- undetected-chromedriver and similar stealth tools were not checked. They are excluded by the rule regardless.

## 6. Pages that are not articles

### Takeaway

Only one verified tool helps: Readability's isProbablyReaderable. Its README calls it quick and rough. Deciding that a page is not an article needs more signals than that, and LinkPeek already reads most of them.

### Candidate records

**isProbablyReaderable (in Mozilla Readability)**
- Name and URL: https://github.com/mozilla/readability (the same repo as section 3). Apache-2.0.
- What it does: "A quick-and-dirty way of figuring out if it's plausible that the contents of a given document..." The README adds: "It is likely to produce both false positives and false negatives" ([README](https://github.com/mozilla/readability)).
- Where it plugs in: extension, in the offscreen document, on the fetched DOM.
- What it sends off the device: nothing.
- Maintained: unclear.
- Main risk: false positives and negatives. A forum thread or index page may pass, and a short article may fail.
- Constraint check: passes.
- How verified: WebFetch of the repo page.

### Inferences

- Use it as one signal, not a verdict. Combine it with the page's JSON-LD type or Open Graph type, and with LinkPeek's word count (D26), to label a page "not an article" on the card. Keep it a label, not a refusal to read. This is my suggestion, not a verified approach. I did not check whether metascraper returns the type.

### Gaps

- metascraper's type output was not verified.
- isProbablyReaderable's behaviour on forums, index pages and product pages was not tested. No real site was checked.

## Looks like a fit but breaks a rule

- **FlareSolverr** (MIT, 16.0k stars seen 2026-10-21): bypasses Cloudflare and DDoS-GUARD protection by design. Breaks the no-bypass rule. [README](https://github.com/FlareSolverr/FlareSolverr)
- **cloudscraper** (MIT, 6.8k stars seen 2026-10-21): bypasses Cloudflare's IUAM page. Breaks the no-bypass rule. [README](https://github.com/VeNoMouS/cloudscraper)
- **Consent-O-Matic** (MIT): answers consent popups for the user from an install-time setting, with no per-popup question and no stated default. Breaks the user-choice rule. [README](https://github.com/cavi-au/Consent-O-Matic)
- **autoconsent** (MPL-2.0, 131 stars seen 2026-10-21): selects opt-in or opt-out "without requiring user-input". Breaks the user-choice rule, and MPL-2.0 is flagged. [README](https://github.com/duckduckgo/autoconsent)
- **"I still don't care about cookies" fork** (GPL-3.0 per search snippet): accepts the cookie policy automatically when a site needs it, per snippet. Breaks the user-choice rule, and GPL-3.0 is flagged. Repo not fetched. Sources: search snippets from [ful.io](https://ful.io/blog/i-still-dont-care-about-cookies-the-extension) and [a Firefox reviews page](https://firefox-stats.com/d/istilldontcareaboutcookies/reviews).
- **Apify Google News decoder** (paid, hosted): a paid third party that receives article URLs. Breaks the privacy rule until its terms are read. A search snippet gives the price as $0.80 per 1,000 links. Source: [Apify listing](https://apify.com/hiver/google-news-scraper), search snippet only.
- **metascraper's html-get and cloud API** (headless browser, paid service): runs page scripts off the device, which D24 rules out, and receives URLs. Breaks D24 and the privacy rule. [README](https://github.com/microlinkhq/metascraper)
- **open-graph-scraper as a backend fetcher** (MIT): a server fetch of the page, which D24 rejects. Breaks D24, a decision the owner can reverse. [README](https://github.com/jshemas/openGraphScraper)

## Could not verify

- **Google News decoder:** licence, source repo, endpoint and rate limits. Settle by reading the PyPI page or its source repo.
- **t.co and bit.ly:** no open-source unshortener was verified. Settle by searching npm for unshortening packages and reading their licences and READMEs.
- **Facebook l.php today:** the ClearURLs regex has not been run on a live wrapper link. Settle with a unit test on a synthetic link.
- **Readability's noscript and lazy-image handling:** read the source, not the README.
- **metascraper's description source order, bundle size and DOM-less behaviour:** read its rules folder and check the package's bundle size.
- **Consent-O-Matic's default and whether it asks:** read its config and rule files.
- **autoconsent's default:** read its rule files.
- **pdfjs-dist (npm) and unpdf:** licence and last publish date, from their npm pages.
- **OCR for scanned PDFs:** no tool checked.
- **OhMyGuus fork:** licence, last commit and default behaviour. Fetch its repo page.
- **Chrome's handling of a redirect that lands on a site LinkPeek cannot read:** read Chrome's extension networking documentation.
- **Commit dates for every repo:** not visible on the pages fetched. Check github.com/OWNER/REPO/commits for each candidate.
- **link-preview-js and the Mercury (postlight) parser:** not fetched, so licence and archive status are unknown.
- **Cloudflare's own challenge documentation:** not fetched.

## Pages fetched on 2026-10-21

- https://github.com/mozilla/readability
- https://github.com/mozilla/pdf.js
- https://github.com/cavi-au/Consent-O-Matic
- https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/HEAD/README.md
- https://raw.githubusercontent.com/cavi-au/Consent-O-Matic/HEAD/LICENSE
- https://github.com/duckduckgo/autoconsent
- https://github.com/microlinkhq/metascraper
- https://github.com/ClearURLs/Addon
- https://gitlab.com/anti-tracking/ClearURLs/rules/-/raw/master/data.min.json (first 100,000 characters read)
- https://github.com/FlareSolverr/FlareSolverr
- https://github.com/VeNoMouS/cloudscraper
- https://github.com/jacktuck/unfurl
- https://github.com/jshemas/openGraphScraper
- https://pypi.org/project/googlenewsdecoder (failed to load)

Search queries were run through WebSearch (standard mode). Most `site:github.com` queries returned no GitHub results, so the GitHub findings above come from direct page fetches.
