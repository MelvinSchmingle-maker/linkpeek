# Open source tools for LinkPeek links: permissions

Research date: 2026-10-21. Scope: ways a Chrome Manifest V3 extension can avoid repeat permission prompts while keeping host access small, what Chrome shows for each option, and open-source examples.

Baseline: LinkPeek's current permissions and per-site prompt come from [docs/permissions.md](/home/user/linkpeek/docs/permissions.md) (local file, read with Read). The owner's rule "Smallest permissions possible. Prefer optional host permissions requested when the user acts." is in [build-plan/00-ground-rules.md](/home/user/linkpeek/build-plan/00-ground-rules.md), line 34 (local file, read with Read).

Method and limits:
- Tools: WebFetch and WebSearch only. No GitHub search tool was called. Repo facts came from WebFetch of public github.com pages and raw.githubusercontent.com manifests. Nothing was cloned, installed or run.
- Quotes are the text WebFetch returned. I did not check them by hand against the live page, so treat exact wording as "as fetched on 2026-10-21".
- Star counts are the values the repo pages showed on 2026-10-21. Last commit dates were not visible on any repo page, so every maintenance field is "not seen".
- About 31 tool calls in total, over the researcher guideline of about 15, because the question list was long.
- Open-source discovery was thin. Two WebSearch queries with "site:github.com" returned no GitHub results, so the examples below are few.

## Q1. What Chrome shows for optional host permissions, and how many prompts per request

### Takeaway
Chrome shows a prompt only when a runtime request adds warnings the user has not already accepted. The docs do not give the all-sites warning text for https://*/* and http://*/*, and they do not say how many prompts one call produces. One call is likely one dialog, but this is unconfirmed.

### Cited Findings
- Optional host permissions are "Granted by the user at runtime, instead of at install time." [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) (fetched)
- The sample puts "https://*/*" in optional_host_permissions, and "This lets you specify any origin in "Permissions.origins" as long as it has a matching scheme." The https wildcard covers only https. [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) (fetched)
- "Chrome prompts the user if adding the permissions results in different warning messages," and the page says a prompt appears only for warnings "than the user has already seen and accepted." [chrome.permissions reference](https://developer.chrome.com/docs/extensions/reference/api/permissions) (fetched)
- The same reference does not say how many prompts a request produces. It says an extension "can prompt the user once to accept all permissions," listed as an advantage of required permissions. [chrome.permissions reference](https://developer.chrome.com/docs/extensions/reference/api/permissions) (fetched)
- Chrome's permissions list shows "Read and change all your data on all websites." for the debugger, pageCapture, proxy, tabCapture and webAuthenticationProxy permissions. The page has no warning text for a single site. [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- Chrome Help says users can set site access to "On specific sites" or "On all sites", and can add or remove individual sites under "Allowed sites." [Chrome Help, article 160743](https://support.google.com/chrome/answer/160743?hl=en-GB) (search summary, not fetched)
- The MV2 transition guide says that with "on all sites", "The extension can automatically access any sites requested in the manifest." This is a 2018 MV2 page. [User controls for host permissions, MV2](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions) (fetched)

### Inferences
- One request for https://*/* and http://*/* is probably one dialog, since Chrome prompts when the warnings change. Not confirmed.
- One request listing several specific sites is probably one dialog too. The dialog text for a list is unknown.
- LinkPeek's current design sends one request per site, so the user sees one prompt for each site they choose.

### Gaps
- Exact prompt wording for https://*/* plus http://*/*, and for a host list, is not in the docs. Test LinkPeek's own build in Chrome and count the dialogs.
- The docs do not state a prompt count per call.

## Q2. Can one prompt appear at install through an onboarding page? Is a user gesture needed?

### Takeaway
Chrome does not show optional host permissions at install. The documented route is a button on an onboarding page that calls the request from its click handler. The docs do not say whether a page opened at install counts as a gesture context, so this needs a test.

### Cited Findings
- "Permissions must be requested from inside a user gesture, like a button's click handler." [chrome.permissions reference](https://developer.chrome.com/docs/extensions/reference/api/permissions) (sample code comment, fetched)
- Optional permissions are "Granted by the user at runtime, instead of at install time." [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) (fetched)
- "Consider using optional permissions wherever the functionality of your extension permits." [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) (fetched)
- The Web Store principles say: "All functionalities of extensions should be clearly disclosed to the user, with no surprises." [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/) (fetched, principles summary)

### Inferences
- A welcome page with one "Allow" button that calls the request in its click handler meets the documented gesture rule. This follows from the sample comment, not from a rule that names onboarding pages.
- One decision screen before Chrome's dialog lets the user see the site list, or the all-sites choice, before anything is granted.

### Gaps
- Whether a tab opened by runtime.onInstalled counts as a valid gesture context is not stated.
- The reference says a removed permission is "usually" added back "without prompting the user." That covers only the removed case, so it is no promise that later requests stay silent.

## Q3. Open-source extensions that ask for broad access once and explain it

### Takeaway
I did not find an open-source Chrome extension that both asks for broad access once and explains it in its own docs or onboarding. Two candidates have broad access, but neither was verified to explain it, and neither uses optional host permissions.

### Cited Findings
- Dark Reader: MIT (as fetched), 22.5k stars seen 2026-10-21, last commit not seen. The captured README has no permissions explanation and no mention of optional permissions. Its manifest was not read. [darkreader/darkreader](https://github.com/darkreader/darkreader) (WebFetch)
- Tabboost (samzong/chrome-tabboost): MIT per README, 82 stars seen 2026-10-21, last commit not seen. The manifest declares static host_permissions ["<all_urls>"] and content_scripts matching "<all_urls>", with permissions activeTab, storage, commands, notifications, clipboardWrite, scripting and declarativeNetRequest. It has no optional host permissions. The README does not state permissions, and does not say how its link preview fetches pages. [manifest.json](https://raw.githubusercontent.com/samzong/chrome-tabboost/HEAD/manifest.json) (WebFetch); [repo](https://github.com/samzong/chrome-tabboost) (WebFetch)
- A Mozilla forum thread (Firefox, not Chrome) describes pairing activeTab with an optional <all_urls> host permission, so the extension can detect repeat visits and then ask for one site. [Mozilla discourse](https://discourse.mozilla.org/t/how-to-avoid-access-your-data-for-all-websites-permission/141370) (search summary, not fetched)
- FantasyPros (not open source) asks for all-site access to insert icons into articles and tells users how to restrict it to specific sites. [FantasyPros support](https://support.fantasypros.com/hc/en-us/articles/18784011087515-How-can-I-restrict-the-access-of-the-FantasyPros-Browser-Extension-to-only-certain-websites) (search summary, not fetched). Listed only as an example of the explanation pattern.

### Inferences
- Explaining broad access is a user interface habit, not a manifest feature. A repo would have to ship onboarding code to show it, and none of the candidates read so far does.

### Gaps
- No verified open-source example. Reading candidate manifests and onboarding code needs known file paths, and the search queries so far did not surface GitHub results. Different queries are needed.

## Q4. Approaches with no host access: activeTab, declarativeNetRequest, offscreen

### Takeaway
None of the three can read the content of a link the user has not clicked. activeTab reads only the invoked tab, and only after the user acts. declarativeNetRequest changes or blocks requests without exposing response content. offscreen is a hidden extension page, and its docs do not say it avoids host access.

### Cited Findings
- activeTab gives "temporary access to the currently active tab" when the user invokes the extension. Access "lasts while the user is on that page, and is revoked when the user navigates away or closes the tab." Invocation comes from an action click, a context menu item, a keyboard shortcut or an omnibox suggestion. [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) (fetched)
- activeTab has no install warning: "activeTab: No warning is listed." [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- declarativeNetRequest can "Block a network request," "Upgrade the schema (http to https)," "Redirect a network request," and "Modify request or response headers." The page never says it can read response bodies or page content. [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) (fetched)
- The declarativeNetRequest permission shows the warning "Block content on any page." [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- offscreen documents must be "a static HTML file bundled with the extension." "The extension's permissions carry over to offscreen documents, but with limits on extension API access." The DOM_SCRAPING reason is for embedding an iframe and scraping its DOM. The page does not say whether an offscreen document can fetch cross-origin URLs or read arbitrary page content. [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) (fetched)
- offscreen has no install warning: "offscreen: No warning is listed." [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)

### Inferences
- activeTab cannot read an unclicked link's destination. Its scope is the invoked tab, and the docs say access needs an explicit gesture. Answer: no.
- declarativeNetRequest is not a read path. Answer: no.
- offscreen does not grant host access in the docs. Permissions carry over, so a cross-origin fetch from it probably still needs host access. Answer: not by itself, unverified.

### Gaps
- Whether an offscreen document can fetch another origin without host permission, and what it can read in an embedded iframe, is not in the docs. Test it.

## Q5. Chrome Web Store policy and what review asks the developer to justify

### Takeaway
The policy asks for the narrowest permissions and a justification for each one in the dashboard. Broad host access is not banned. The developer must justify it, and a request broader than needed "may cause your extension to be rejected." The pages read do not name host permissions specifically.

### Cited Findings
- "Request access to the narrowest permissions necessary to implement your Product's features or services." And "If more than one permission could be used to implement a feature, … the least access to data or functionality." [Program policies, Use of Permissions](https://developer.chrome.com/docs/webstore/program-policies/policies) (fetched)
- The privacy fields page has "a field for you to state the justification for each permission," and says to "request the minimum permissions consistent with the purpose of the extension." [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) (fetched)
- "Requesting broader permissions than necessary may cause your extension to be rejected." [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) (fetched)
- For unneeded permissions, the page says to "remove them from your manifest" and "upload a new version of your extension before continuing." [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) (fetched)
- Limited Use: "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose." It also says "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature," and that such use must be "described prominently in the Product's Chrome Web Store page and in the Product's user interface." The text covers "scraped content or otherwise automatically gathered user data." [Program policies, Limited Use](https://developer.chrome.com/docs/webstore/program-policies/policies#limited_use) (fetched)

### Inferences
- An all-sites grant needs a stronger single-purpose justification than a per-site grant, because the reviewer checks purpose against the access asked for. This is inferred from "narrowest" and "minimum", not from a host-permission rule.
- Reading linked pages in the background could count as collecting browsing activity. If it does, the Limited Use text requires prominent disclosure. Whether LinkPeek is covered depends on what it collects, and this report does not decide that.

### Gaps
- The full Extension Quality Guidelines and review FAQ were not fetched. Host-permission review criteria are not confirmed.

## Q6. Open-source backend fetch, and its trade-offs

### Takeaway
A server-side fetch needs no browser permission. Trafilatura and Postlight Parser can fetch a URL themselves, and Mozilla Readability only parses HTML that the caller supplies. The cost is that the server sees each URL and page, is more likely to be blocked by sites that refuse datacenter traffic, and makes the site see the server's address rather than the reader's.

### Cited Findings
- Trafilatura: Apache 2.0 (as fetched), 7.0k stars seen 2026-10-21, last commit not seen. Usage: `fetch_url("https://...")`, and the README lists "web crawling, downloads, scraping, and extraction." It does not mention robots.txt. The README says versions before v1.8.0 are under GPLv3+. [adbar/trafilatura](https://github.com/adbar/trafilatura) (WebFetch)
- Postlight Parser: the sidebar reads "Apache-2.0, MIT licenses found" (as fetched). That conflicts with my expectation of MIT, so the licence is unresolved, and I did not read the LICENSE file. 5.8k stars seen 2026-10-21, last commit not seen, no archive notice seen. The README says it extracts content "from any URL you give it," and that when pre-fetched HTML is passed, "the URL will not be used for fetching content." [postlight/parser](https://github.com/postlight/parser) (WebFetch)
- Mozilla Readability: Apache-2.0 (sidebar), 11.5k stars seen 2026-10-21, last commit not seen. "To parse a document, you must create a new Readability object from a DOM document object." In Node it needs jsdom, with the page URL passed in the JSDOM options. It does not fetch URLs. [mozilla/readability](https://github.com/mozilla/readability) (WebFetch)
- Anti-bot systems "usually block datacenter traffic on IP reputation alone," and some blocks return a stripped or placeholder page with a normal status code. These are vendor claims. [Massive blog](https://www.joinmassive.com/blog/why-ai-agents-get-blocked-on-datacenter-ips-and-how-to-fix-it) (search summary, not fetched; vendor source)

### Inferences (trade-offs)
- Privacy: the server reads and may store whatever it fetches. Page text leaves the browser only when the user asks, which the ground rules require, and the flow must be listed in docs/privacy.md. The server sends no cookies, which matches the ground rules.
- Site blocking: a server fetch is more likely to get 403, 429 or a placeholder page than a reader's browser. Those count as failures to show, not to get around. Residential proxies or other ways around blocks break the no-bypass rule.
- Site and server address: the site sees the server's IP and user agent, not the reader's IP. That helps the reader's privacy. The site operator still sees the request, and LinkPeek's own server would carry the extra traffic and any rate limits.
- LinkPeek already runs a server on Vercel (Part 06, per docs/permissions.md). A new fetch path adds load and needs a privacy note.

### Gaps
- Last commit dates for all three repos are not seen, so maintenance is unclear.
- Postlight Parser's licence is unresolved (see above).
- The blocking claims rest on vendor and search summaries. They were not measured.

## Option records

### Side by side

| Option | What Chrome shows | Prompts | User action first | What it can read | Cost to the user | Constraint check |
|---|---|---|---|---|---|---|
| O1 All sites, one request for https://*/* and http://*/* | Probably one dialog. Host wording not confirmed. | 1 per call (inferred) | Yes, click handler | Every https and http page, no further prompts | Broadest grant, trusted everywhere | Pass only as an opt-in choice. Fails as a default. |
| O2 Specific sites, one request per site (current) | One prompt per site. Site wording not confirmed. | One per site | Yes | Only allowed sites | A new prompt for each new site | Pass |
| O3 One onboarding button, one request for a chosen list | Probably one dialog listing the sites. Not confirmed. | 1 for the list (inferred); new sites prompt again | Yes, button click | Only listed sites | Choose sites in advance | Pass |
| O4 addHostAccessRequest (Chrome 133+) | Request shown only if access can be granted. UI not described. | One per site (inferred) | Not stated | Accepted site's top origin | Per-site request in Chrome UI | Pass in principle. Unverified. |
| O5 Static <all_urls> in host_permissions | Install-time warning. Wording not confirmed. | None after install | None | All sites from install | Full access on day one | Fail. See breaks-a-rule list. |
| O6 activeTab, plus contextMenus (current baseline) | No install warning | 0 | Yes, per invocation | Invoked tab only; not an unclicked link's destination | Click each time | Pass. Does not solve reading. |
| O7 declarativeNetRequest | "Block content on any page." | 0 after install | None | No page content | Install warning | Pass on size. Not a read path. |
| O8 offscreen | No warning | 0 | Not stated | Not stated for cross-origin | None stated | Pass on size. Read ability unverified. |
| O9 Server-side fetch | No extension permission; request to LinkPeek server | 0 | User asks for the article | Whatever the server can fetch without user cookies | Server sees URLs; more blocks | Pass if licence and privacy rules are met. |

### O1. All sites: one request for https://*/* and http://*/*
- Chrome shows: probably one dialog. Wording for these patterns is not confirmed. The docs show "Read and change all your data on all websites." for other permissions. [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- Prompts: one per call (inferred).
- User action first: yes, the request must come from a click handler. [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) (fetched)
- Can read: every https and http page once granted. Under the MV2 guide's "on all sites", that means no further prompts. [MV2 guide](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions) (fetched)
- Open-source examples: none with optional all-sites access verified. Tabboost has static all-sites access (see O5).
- Constraint check: pass only as a choice the user makes. It fails the "smallest permissions" default. Limited Use disclosure may apply.
- How verified: permissions reference, declaration page, permissions list, MV2 guide. The prompt wording was not verified.

### O2. Specific sites, one request per site (current LinkPeek)
- Chrome shows: one prompt per site. The site-specific wording is not confirmed. Users can remove sites under "Allowed sites." [Chrome Help](https://support.google.com/chrome/answer/160743?hl=en-GB) (search summary)
- Prompts: one per site the user chooses.
- User action first: yes.
- Can read: only the allowed sites.
- Open-source examples: none verified.
- Constraint check: pass.
- How verified: optional origins are documented. The prompt wording was not verified.

### O3. One onboarding button, one request for a chosen list of sites
- Chrome shows: probably one dialog listing the sites. Not verified.
- Prompts: one for the list (inferred). Sites added later prompt again.
- User action first: yes, a button click. [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) (fetched)
- Can read: only the listed sites.
- Open-source examples: none verified.
- Constraint check: pass. This is the narrowest option that gives one grant.
- How verified: the gesture and origin rules are documented. The one-dialog claim is not verified.

### O4. Per-site host access request (chrome.permissions.addHostAccessRequest, Chrome 133+)
- Chrome shows: the request "will only be signaled to the user if extension can be granted access to the host." Accepted, it "grants persistent access to the site's top origin." A new request "will override any existent request for tabId." The UI is not described. [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) (fetched)
- Prompts: one per site request (inferred). Requests reset on cross-origin navigation.
- User action first: not stated.
- Can read: the accepted site's top origin.
- Open-source examples: none found.
- Constraint check: pass in principle. Needs Chrome 133 or later. The docs do not say how it relates to optional_host_permissions.
- How verified: permissions reference only. Not tested.

### O5. Static all-sites in host_permissions or content_scripts
- Chrome shows: install-time warning. Wording for <all_urls> is not confirmed.
- Prompts: none after install.
- User action first: none.
- Can read: all sites from install.
- Open-source examples: [Tabboost](https://github.com/samzong/chrome-tabboost), MIT per README, 82 stars seen 2026-10-21, last commit not seen. Static <all_urls> confirmed in [manifest.json](https://raw.githubusercontent.com/samzong/chrome-tabboost/HEAD/manifest.json) (WebFetch).
- Constraint check: fails the smallest-permissions rule and the prefer-optional rule.
- How verified: raw manifest read.

### O6. activeTab, plus contextMenus (current baseline)
- Chrome shows: no install warning. [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- Prompts: none.
- User action first: yes, for each invocation: action click, context menu or shortcut. [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) (fetched)
- Can read: the invoked tab until the user leaves it. It cannot read an unclicked link's destination.
- Open-source examples: [ericjoye/copy-link-markdown](https://github.com/ericjoye/copy-link-markdown), MIT, activeTab, contextMenus and clipboardWrite per a search summary. Not fetched, so the details are unverified.
- Constraint check: pass. It does not solve the reading problem.
- How verified: activeTab doc and permissions list.

### O7. declarativeNetRequest
- Chrome shows: "Block content on any page." [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- Prompts: none after install.
- User action first: none.
- Can read: no page content. It blocks, redirects or changes headers. [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) (fetched)
- Open-source examples: Tabboost declares it, but the manifest does not show it being used to read pages.
- Constraint check: passes the size test, but it is not a fit for reading links.
- How verified: DNR doc and permissions list.

### O8. offscreen
- Chrome shows: no warning. [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list) (fetched)
- Prompts: none.
- User action first: not stated.
- Can read: not stated for cross-origin pages. DOM_SCRAPING covers an iframe the extension embeds. [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) (fetched)
- Open-source examples: none checked. LinkPeek already uses it for parsing (per docs/permissions.md).
- Constraint check: passes the size test. The docs do not show it avoids host access, so it is not a way around host access.
- How verified: offscreen doc and permissions list.

### O9. Server-side fetch, using an open-source fetcher on LinkPeek's server
- Chrome shows: no extension permission. The request goes to LinkPeek's server, which allows requests from any origin without cookies (per docs/permissions.md).
- Prompts: none.
- User action first: the user asks for the article.
- Can read: whatever the server can fetch without the user's cookies, subject to site blocks.
- Open-source examples:
  - [Trafilatura](https://github.com/adbar/trafilatura): Apache 2.0 as fetched, 7.0k stars seen 2026-10-21, last commit not seen. Versions before 1.8.0 are GPLv3+ per README.
  - [Postlight Parser](https://github.com/postlight/parser): licence unresolved, 5.8k stars seen 2026-10-21, last commit not seen.
  - [Mozilla Readability](https://github.com/mozilla/readability): Apache-2.0 as fetched, 11.5k stars seen 2026-10-21, last commit not seen. Parser only.
- Constraint check: pass if the fetcher is version-pinned to a permissive licence (Trafilatura 1.8.0 or later), sends no cookies, is disclosed in docs/privacy.md, and the server does not bypass blocks.
- How verified: READMEs and repo pages via WebFetch. No candidate was run.

Maintenance for all candidates: "unclear", because no last commit date was visible.

## Looks like a fit but breaks a rule

- Static all-sites access (O5), as in Tabboost. Breaks "Smallest permissions possible. Prefer optional host permissions requested when the user acts." (ground rules, line 34). It is also not requested when the user acts.
- Residential proxies or other ways around blocks, for a server-side fetch. Search summaries describe these as a common workaround, but no specific product was checked. Breaks "Never bypass paywalls, logins, CAPTCHAs or anti-bot checks." (ground rules, line 40).
- Any server fetch that forwards the reader's cookies or login. Breaks "Never send cookies, session tokens or login details to any outside service." (ground rules, line 36).
- Trafilatura versions before 1.8.0. The README says they are GPLv3+, which breaks the owner's licence preference (MIT, Apache-2.0, BSD or similar). Pin 1.8.0 or later and this is no longer a break.

## Could not verify

- Exact Chrome wording and prompt count for one request covering https://*/* and http://*/*, or for a host list. Settle it by loading LinkPeek's own build in Chrome and counting the dialogs.
- Whether a button on an onboarding page opened by runtime.onInstalled counts as a user gesture. Settle it by test in Chrome.
- How addHostAccessRequest looks to the user, whether it needs a gesture, and how it relates to optional_host_permissions. Settle it by test on Chrome 133 or later.
- Whether an offscreen document can fetch a cross-origin page with host access, and what it can read. The docs are silent. Settle it by test.
- Web Store host-permission review criteria beyond the privacy fields page and the policies. The full Extension Quality Guidelines and review FAQ were not read.
- Open-source examples of broad access explained once in-product. Dark Reader (MIT, 22.5k stars seen 2026-10-21) has broad access by design, but its manifest and onboarding code were not read. Settle it by reading its manifest and onboarding files at known paths.
- Maintenance for every candidate. Last commit dates are not visible on the repo pages. Settle it by reading each repo's commit history or releases page.
- Postlight Parser's licence. The sidebar text conflicts with my expectation, and the LICENSE file was not read.
- How often datacenter IPs are blocked. The claims rest on vendor and search summaries and were not measured.
- GPL and AGPL candidates were not searched, so no flag on them was checked here.
- Coverage of open-source Chrome extensions is thin. The site:github.com queries returned no GitHub results, and no GitHub search tool was used, per the owner's scope rule.
