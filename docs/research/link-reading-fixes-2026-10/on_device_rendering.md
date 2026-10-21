# On-device rendering of JavaScript-built pages

Facet: rendering on the user's device only, with no LinkPeek server involved. The question is how a Manifest V3 extension can read the rendered text of a remote page whose text is built by JavaScript, and what each route costs in permissions, privacy, security, Web Store policy and reliability.

Method: I read LinkPeek's own docs and code first (handoff.md, todo.md, docs/permissions.md, docs/privacy.md, docs/decisions.md D24 to D27, docs/progress.md, src/core/retrieve/diagnose.ts, src/core/retrieve/fetcher.ts, src/background/retrieve.ts, scripts/manifest.mjs). Then I read Chrome for Developers reference pages, the Chrome Web Store policy page, MDN, one Chrome blog post, a Chromium extensions group thread, and WebSearch results (with site:github.com for discovery). I did not clone or run code, did not fetch the talkSPORT page, and did not use GitHub search tools. This took about 27 research calls, above the usual budget, because the brief asked for primary sources on many points. Items marked UNVERIFIED are ones no source I could read settles. The WebFetch tool summarises pages, so quotes below are as returned by that tool. Check the live page before quoting any of them externally.

## Key Question 1: Can an MV3 extension get the rendered DOM of a remote page without the user opening it?

### Takeaway
Two scripted routes can read a remote page's rendered text with no visible tab. One is a cross-origin iframe inside the offscreen document, with the extension's content script running inside that frame. The other is a background tab read through chrome.scripting. Both need a host grant for the target site. The iframe route fits best, but its support rests on a 2023 Chrome blog post and a 2024 forum thread, and any site that sends X-Frame-Options or a frame-ancestors policy will refuse to load in it.

### Cited Findings
- Offscreen documents may embed cross-origin frames: "we allow these documents to embed cross-origin frames following the same rules that extension pages have today." The post also says "In offscreen documents, content scripts specified by the extension are able to run in these frames." The page was last updated 2023-01-25. — [Chrome blog: Offscreen Documents in Manifest V3](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3)
- The offscreen API is "Chrome 109+ MV3+". Its reasons include DOM_SCRAPING (embeds an iframe and reads its DOM) and IFRAME_SCRIPTING (embeds and scripts an iframe), alongside DOM_PARSER and WORKERS. The reasons are set when the document is created. — [Chrome API reference: offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- In an offscreen document "the runtime API is the only extensions API supported." The blog says the same: "only the chrome.runtime messaging APIs are exposed to the offscreen document." "An installed extension can only have one open at a time." Reasons other than AUDIO_PLAYBACK set no lifetime limit. — [offscreen reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen); [blog](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3)
- The scripting API targets tabs and frames only (tabId, allFrames, frameIds). The page does not mention offscreen documents. It needs the scripting permission "plus the host permissions for the pages to inject scripts into." Chrome 88+ MV3. — [Chrome API reference: scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- Workaround from a Chromium extensions group thread (28 Mar 2024). A developer asked how to reach the DOM of an iframe inside an offscreen document, since the scripting API does not target offscreen documents. The reply suggests registering a content script with chrome.scripting.registerContentScripts and allFrames:true, sending results with chrome.runtime.sendMessage, then unregistering it. It also suggests checking that the script runs in the offscreen document with `location.ancestorOrigins[0] + '/' === chrome.runtime.getURL('')`. The asker wrote "That's more of a workaround than a solution." The page does not show author roles. — [Chromium extensions group thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/rMKJc8Yy9nU)
- Chromium bug 41090046 is titled, per a search result, "Extension pages can't access iframe content due to cross origin policies". The page could not be read (it showed only a sign-in link). A search summary says an older 2014 report got a "by design" answer, but I did not read that thread. — [Chromium issue 41090046](https://issues.chromium.org/issues/41090046) (UNREAD)
- X-Frame-Options DENY: "The document cannot be loaded in any frame, regardless of origin." SAMEORIGIN: "The document can only be embedded if all ancestor frames have the same origin as the page itself." — [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- CSP frame-ancestors "specifies valid parents that may embed a page using <frame>, <iframe>, <object>, or <embed>." 'none' "may not be embedded." The directive is "not supported in the <meta> element." MDN does not say which wins when both headers are sent. — [MDN: frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors); [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- declarativeNetRequest and declarativeNetRequestWithHostAccess: "both require host permissions; however, the latter prevents host permission warnings." That line is on the MV2 reference page. The MV3 page does not state the host-permission rule for modifyHeaders. — [Chrome reference: declarativeNetRequest (MV2 page)](https://developer.chrome.com/docs/extensions/mv2/reference/declarativeNetRequest); [MV3 page](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- Chromium's IDL (a pinned commit, date unknown, because the main-branch URL returned 404) defines `RemoveHeaderType` as cookie, referer and setCookie, described as "the headers which can be removed from the network request", and that list belongs to the removeHeaders action. Chrome's public pages give no allowlist for the remove operation of modifyHeaders. — [Chromium IDL, commit 2c3a61c3](https://chromium.googlesource.com/chromium/src/+/2c3a61c3e26ef4c8f41e0171eb50f2d2a4c3e132/extensions/common/api/declarative_net_request.idl)
- activeTab grants access after the user clicks the action, uses a context menu item, uses a keyboard shortcut or accepts an omnibox suggestion. Access "lasts while the user is on that page, and is revoked when the user navigates away or closes the tab." The page says nothing about tabs created by chrome.tabs.create or about hidden tabs. — [Chrome concept: activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- The debugger API lets an extension "attach to one or more tabs to instrument network interaction, debug JavaScript, mutate the DOM and CSS, and more." It needs the "debugger" permission. The page does not mention host permissions or a user-facing warning. Flat sessions arrived in Chrome 125. — [Chrome API reference: debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- The manifest key `incognito` defaults to "spanning": "the extension will run in a single shared process." Split mode runs incognito pages "in their own incognito process" with "a separate memory-only cookie store", and "The processes are unable to communicate with each other." The page was last updated 2013-05-12. — [Chrome manifest: incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito)
- Credentialless iframes "doesn't have access to any of the cookies associated with the top level website", "starts with an empty cookie jar", and keep storage in an ephemeral partition. Enabled by default from Chrome 110. Last updated 2023-01-12. — [Chrome blog: iframe credentialless](https://developer.chrome.com/blog/iframe-credentialless)
- MDN on the credentialless attribute: the iframe "doesn't have access to the network, cookies, and storage data associated with its origin." Its COEP embedding rules "can be lifted, so documents with COEP set can embed third-party documents that do not." MDN states no requirement on the embedding document. — [MDN: iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- requestAnimationFrame "calls are paused in most browsers when running in background tabs or hidden <iframe>s." MDN does not mention minimised windows. — [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- LinkPeek's manifest (scripts/manifest.mjs) declares permissions storage, activeTab, scripting, contextMenus and offscreen. It declares optional_host_permissions https://*/* and http://*/*, sets minimum_chrome_version to 116, and sets no content_security_policy key, so Chrome's default extension policy applies. LinkPeek creates its offscreen document with reasons DOM_PARSER and WORKERS (src/background/retrieve.ts). The offscreen document closes after 2 minutes idle (OFFSCREEN_IDLE_MS).
- GitHub discovery (WebSearch, site:github.com): no public project found that renders a remote page this way inside an extension. The closest results were detj/offscreen (zero-size iframes, an old non-extension project, https://github.com/detj/offscreen), and GoogleChrome/chrome-extensions-samples issue #821, which asks whether an offscreen iframe can use a content script and shows no answer (https://github.com/GoogleChrome/chrome-extensions-samples/issues/821).

### Approaches

The matrix below covers all six routes. Each route has its own detail below it.

| Route | Permission beyond today's | Visible to user | Sends cookies by default | Main blocker | Status |
|---|---|---|---|---|---|
| A. Offscreen iframe, content script inside the frame | None for the base route (offscreen, scripting and the host grant already exist). DNR only if frame headers must be stripped. | No | Yes, as a third-party context, unless credentialless | Sites that refuse framing. Header stripping is undocumented. | Most promising, untested |
| B. Background tab and scripting.executeScript | None beyond the host grant. DNR for cookies. | Tab shows in the tab strip | Yes, all first-party cookies | Bot checks, background throttling, cookie and storage side effects | Workable with a cookie plan |
| C. Minimised or background window | Same as B | Window in the taskbar | Yes | Same as B. Hiding the window is a stealth pattern. | Not recommended |
| D. Incognito window (spanning or split) | User turns on "Allow in Incognito" | Incognito window | No, separate memory-only jar | User step. Split mode cannot send results back. | Viable, privacy-positive |
| E. chrome.debugger | debugger permission, probably a host grant too | Chrome may show a debugging bar (UNVERIFIED) | Yes, unless cleared | Heaviest permission | Not recommended |
| F. User click on a visible tab (activeTab) | None (activeTab and scripting are already requested) | Yes, the user's own tab | Yes, the user's own cookies | Needs the user to open the article first | Most reliable fallback |

#### Route A: offscreen document, cross-origin iframe, content script inside the frame
- What it does: LinkPeek's offscreen document appends an iframe whose src is the article URL. It registers an extraction-only content script for that origin with allFrames (chrome.scripting.registerContentScripts, as in the 2024 thread). When the page settles, the script reads the text and sends it to the service worker with chrome.runtime.sendMessage. Then it unregisters the script and removes the iframe.
- Permissions: offscreen and scripting (already present). A host grant for the target origin (already optional). The offscreen reasons would need DOM_SCRAPING or IFRAME_SCRIPTING, because the reasons are fixed at creation. DNR (declarativeNetRequest or declarativeNetRequestWithHostAccess) only if frame headers must be stripped.
- What it sends off the device: the site receives ordinary requests from the user's browser (IP address, browser type), the frame's sub-requests, and the page's own scripts and analytics. Nothing goes to LinkPeek.
- Cookies: the iframe is a cross-site (third-party) context, so the browser's third-party cookie rules apply. I could not confirm the current Chrome default for those rules (see Q2). A credentialless iframe starts with no cookies and ephemeral storage (Chrome 110+), so it is the candidate for cookie-free rendering. Not tested from an extension page.
- Reliability: no visible tab. Sites with X-Frame-Options SAMEORIGIN or DENY, or with a frame-ancestors policy that excludes the extension, will refuse to render in the frame. This follows from the MDN definitions, because a chrome-extension:// parent is never the site's own origin (inference). Pages that render on animation frames may stall, since rAF pauses in hidden iframes (MDN). The offscreen document is shared by all of LinkPeek's reads, so a stuck frame must be removed on timeout.
- Chrome version: offscreen 109+ (API reference), credentialless 110+ (blog), and LinkPeek's minimum is 116. The cross-origin content script behaviour comes from a 2023 blog and a 2024 thread. Current behaviour is UNVERIFIED.
- Policy: see Q4.
- Sources: the blog, the offscreen reference, the 2024 thread, the MDN XFO and frame-ancestors pages, the credentialless blog and MDN rAF, all cited above.
- Unverified: (1) whether content scripts still run inside offscreen frames in current stable Chrome; (2) whether DNR can remove X-Frame-Options and frame-ancestors, since only community advice says so and Chrome's public pages do not list it; (3) whether a DNR rule can be scoped to this one iframe, since offscreen documents have no tab ID and tabIds is session-scoped only; (4) whether credentialless works from an extension page and whether the embedder needs COEP (a `cross_origin_embedder_policy` manifest key exists from Chrome 93, which applies to requests to the extension's origin); (5) whether the iframe sends a Referer, and whether DNR can remove it (the IDL lists referer as removable on removeHeaders).

#### Route B: background tab with chrome.tabs.create and chrome.scripting.executeScript
- What it does: create a tab with active set to false, wait for the load to complete, run an injected function that returns innerText once the DOM settles, then close the tab.
- Permissions: scripting and a host grant, as in today's model. I believe chrome.tabs.create needs no permission of its own, but I did not check the tabs reference. A tabId-scoped DNR session rule for cookies needs declarativeNetRequest or declarativeNetRequestWithHostAccess. Clearing site data after the tab closes would need browsingData. That is an inference.
- What it sends off the device: a full visit from the user's browser, including the page's scripts, analytics and ads, plus any cookies or storage the page writes.
- Cookies: the normal profile sends the user's first-party cookies, so a logged-in state is used unless stripped. Chrome's documented sample removes the cookie request header for main_frame and sub_frame requests. Session-scoped rules accept a tabIds condition (Chrome 92+), so the rule can be limited to LinkPeek's tab. This covers request headers only. Page script can still write document.cookie and localStorage, so the tab must be cleared afterwards, or the route must run in an incognito window (Route D).
- Reliability: a background tab loads, but background tabs throttle timers and pause rAF (MDN). I did not verify whether Chrome discards background tabs under memory pressure. A challenge page is seen only by the tab, not by the user.
- Chrome version: scripting 88+ (API reference). DNR tabIds 92+ and modifyHeaders 86+ (DNR reference). WithHostAccess 96+ (from a search summary of the reference, not checked directly).
- Policy: see Q4 (web browsing activity, non-obvious functionality, ads).

#### Route C: minimised or background window
- It is Route B in a window instead of a tab. MDN says rAF pauses in background tabs and hidden iframes, but it does not say whether a minimised window behaves the same (UNVERIFIED).
- I recommend against it. A window the user cannot see is a stealth pattern, and the project rules rule that out. It also adds a "non-obvious functionality" risk under the Web Store rule on concealed functionality. A visible background window gains nothing over Route B.

#### Route D: incognito window (spanning or split)
- What it does: the user turns LinkPeek on in incognito, and the background opens the page in an incognito tab and reads it there.
- Permissions: no new manifest permission. The manifest key `incognito` defaults to "spanning". The docs say the key applies "if allowed to run in incognito mode", but they do not describe the user switch (UNVERIFIED wording). The host grant is still needed.
- What it sends off the device: the same as Route B, inside an incognito session.
- Cookies: an incognito window has its own memory-only cookie store, so none of the normal profile's cookies are sent (split-mode docs). Chrome blocks third-party cookies by default in incognito, according to secondary sources only. Nothing persists after the window closes.
- Architecture: in split mode "the processes are unable to communicate with each other", so a split-mode instance cannot report back to LinkPeek's normal profile. In spanning mode, "Any events or messages from an incognito tab will be sent to the shared process," with a flag. Spanning is the workable mode for LinkPeek (inference).
- Reliability: same as Route B. Some sites treat incognito visits differently. LinkPeek should report what comes back and should not try to detect or get around any such check.
- Chrome version: the manifest key is long-standing, and I did not check the exact version. It is below 116.
- Policy: the user's opt-in is clear. The listing and the card would need to say what happens.

#### Route E: chrome.debugger
- What it does: attach to a tab with the DevTools protocol, then read the DOM with Runtime.evaluate or a DOM snapshot.
- Permissions: the "debugger" permission. Whether attaching also needs a host grant, and whether Chrome shows a visible debugging bar, is not in the page I read (UNVERIFIED for both). The bar is widely reported, but I have no source for it here.
- What it sends off the device: the same as Route B.
- Cookies: the protocol can also read and clear cookies (inference from the protocol's breadth, not checked).
- Reliability: the same tab limits as Route B. Flat sessions from Chrome 125.
- Policy: the debugger permission is sensitive. The page I read says nothing about Web Store review. Not recommended under the "smallest permissions" rule.

#### Route F: user-invoked activeTab on a visible tab
- What it does: the user opens the article normally and presses LinkPeek's button or shortcut. The grant covers that tab until the user navigates away or closes it. Then the content script reads innerText.
- Permissions: activeTab and scripting, both already requested. No host grant is needed for that tab, because activeTab grants temporary host access.
- What it sends off the device: nothing beyond the user's own visit.
- Cookies: the user's own cookies, because it is the user's own visit. This matches the D24 rule for the page the user is already on.
- Reliability: the most reliable route for JavaScript-built pages, because the page runs as it would for a reader. It does not meet the goal of previewing without opening.
- Chrome version: activeTab has been available for a long time. scripting is 88+.
- Unverified: whether activeTab alone allows scripting.executeScript on the active tab in current Chrome. The activeTab page is silent on tabs created by chrome.tabs.create.

### Inferences
- No scripted route avoids the per-site host grant, because the content script and executeScript both need it. On-device rendering therefore does not fix the prompt count unless the owner chooses all sites. Only Route F avoids the grant. This bears on the owner's decision 1 in handoff.md.
- Route A is the only route that renders with no visible tab and no new tab in the strip. Its main limit is sites that refuse framing.
- Route B is the fallback for sites that refuse frames. It needs the cookie and storage plan above.
- The owner's privacy promise in docs/privacy.md says the site receives the request "without your cookies, logins or saved passwords" and "without telling it which page you were on (no referrer)". Routes A and B break that promise unless the cookie and referrer controls in Q2 are in place. The fetch path's `credentials: 'omit'` and `referrerPolicy: 'no-referrer'` (src/core/retrieve/fetcher.ts) do not reach a tab or an iframe.

### Gaps
- No readable Chrome source says whether DNR modifyHeaders removes X-Frame-Options or frame-ancestors. The only support is community advice in the 2024 forum.
- Chromium bug 41090046 is unread.
- I found no shipping extension that renders a remote page this way. That may mean the approach is rare, or that the search missed it.

## Key Question 2: Can an extension stop the page's cookies being sent, and is that reliable and allowed?

### Takeaway
Cookies can be stopped on both scripted routes, using different tools. The iframe route can use credentialless iframes, which the Chrome blog documents from Chrome 110. The tab route can use a DNR cookie-removal rule scoped to the tab with tabIds, which is a documented pattern. The fetch option `credentials: 'omit'` does not reach rendered pages. The Web Store policy text I read does not forbid stripping cookies, and stripping them is the privacy-positive direction.

### Cited Findings
- LinkPeek's current promise: the site sees the request "without your cookies, logins or saved passwords", and "without telling it which page you were on (no referrer)" (docs/privacy.md). Every article fetch uses `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` and `cache: 'no-store'` (src/core/retrieve/fetcher.ts). Those options apply only to a fetch from the extension, not to a tab or an iframe.
- The DNR sample removes all cookies from main_frame and sub_frame requests with `{ "header": "cookie", "operation": "remove" }`. The `remove` operation "Removes all entries for the specified header." — [Chrome reference: declarativeNetRequest (MV2 page)](https://developer.chrome.com/docs/extensions/mv2/reference/declarativeNetRequest); [MV3 page](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- The tabIds condition is "Only supported for session-scoped rules" and is Chrome 92+. — [MV3 DNR reference](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- The Chromium IDL lists cookie, referer and setCookie as removable on the removeHeaders action (see Key Question 1, pinned commit). — [Chromium IDL](https://chromium.googlesource.com/chromium/src/+/2c3a61c3e26ef4c8f41e0171eb50f2d2a4c3e132/extensions/common/api/declarative_net_request.idl)
- Credentialless iframes "doesn't have access to any of the cookies associated with the top level website" and "starts with an empty cookie jar". Enabled by default from Chrome 110. — [Chrome blog: iframe credentialless](https://developer.chrome.com/blog/iframe-credentialless)
- Split-mode incognito gives "a separate memory-only cookie store". — [Chrome manifest: incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito)
- Google's Privacy Sandbox cookies page (last updated 2025-12-11) says "Some Privacy Sandbox technologies are being phased out" and "Cookies can be blocked by browser design, Enterprise policy, or user choice." It does not say that third-party cookies are being removed, and it does not state Chrome's default. — [privacysandbox.google.com/cookies](https://privacysandbox.google.com/cookies)
- Secondary sources from a WebSearch say Google dropped its third-party cookie deprecation in July 2024, that no replacement prompt is planned, and that third-party cookies stay on by default in Chrome, with Incognito blocking them by default. These are not Google primary sources and I could not confirm them from one. — e.g. [Consentik](https://consentik.com/google-third-party-cookies/), [Cookiebot](https://www.cookiebot.com/en/google-third-party-cookies/)
- Web Store Limited Use: "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose." Also: "Extensions must use existing Chrome APIs for their designated use case." — [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

### Inferences
- The tab route has a gap. DNR changes request headers only. Page script can still write document.cookie and localStorage, and those persist after the tab closes. The tab therefore needs clearing afterwards (browsingData, which is one more permission) or must run in an incognito window (Route D).
- The iframe route has no such storage gap, because a credentialless iframe's storage is ephemeral and cleared when the top document unloads (Chrome blog).
- Stripping cookies may make some sites serve their logged-out version. LinkPeek already accepts that outcome. D27 says a page that the publisher marks as not free never shows body text, even when the HTML contains it. Keep that rule for any rendered page too.
- A request-only rule cannot stop a site from seeing the user's IP address. The privacy text should say so.

### Gaps
- Whether DNR cookie removal works for sub_frame requests in current Chrome. The sample says it does, but I found no test report. A Safari/WebKit report says a Cookie removal rule was not applied, though that is not Chromium evidence.
- The current Chrome default for third-party cookies is not confirmed from a Google primary source.
- Whether a credentialless iframe can be created inside an extension page, and whether it needs COEP on the embedder (MDN and the blog do not say).

## Key Question 3: What isolation does Chrome give, and what could go wrong?

### Takeaway
The remote page's scripts run under the site's own origin. Chrome's same-origin policy stops an extension page reading a cross-origin iframe's DOM, so only a content script can read it. The page cannot call extension APIs. The realistic risks are on LinkPeek's side: treating page text as data, the scope of any frame-header or cookie rule, clickjacking exposure, runtime and navigation limits, and content scripts that land in the wrong frame.

### Cited Findings
- Offscreen frames follow "the same rules that extension pages have today" (blog). Content scripts run in those frames, and the 2024 thread's ancestor check confirms the frame's origin.
- The offscreen document exposes only runtime messaging (blog and reference), so a remote page's frame has no path into the extension's other APIs.
- Split-mode incognito processes "are unable to communicate with each other." — [Chrome manifest: incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito)
- A sandboxed iframe without allow-same-origin "is treated as being from a special origin that always fails the same-origin policy (potentially preventing access to data storage/cookies and some JavaScript APIs)." — [MDN: iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)
- DNR rules are browser-wide unless scoped. tabIds works only for session-scoped rules (MV3 DNR reference).
- LinkPeek already treats fetched text as data. docs/decisions.md D25 says page text is placed with `textContent` and never treated as instructions.
- The 2024 thread's advice is to check the frame's ancestor origin, so the extraction script runs only where it should. — [Chromium extensions group thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/rMKJc8Yy9nU)

### Inferences
- In Route A, the page reaches the extension only through the content script's DOM reads and any message it listens for. The extraction content script should be separate from the card's content script, check the ancestor origin, ignore window messages, and inject no UI. The current LinkPeek content script must not run inside remote frames, because it scans links and injects UI.
- A frame-header stripping rule that matches example.com would also remove clickjacking protection from the user's own tabs on that site while the rule exists, unless the rule is scoped. An offscreen document has no tab ID to scope by, and whether an extension-origin initiator can be matched is unverified. This is the largest security cost in the design, and it should not ship until scoping is shown to work.
- A sandbox attribute on the iframe would limit navigation and popups, but it removes same-origin access, which breaks sites that need storage, and it may stop the content script running. Test before using it.
- Runtime and navigation need limits. A page can keep running after the text is read, and it can navigate the frame to another origin. Use a hard timeout, remove the frame when done, and treat a final origin that differs from the requested site as a failure.
- In Route B, the page runs in a normal renderer with site isolation, and it can run ads, timers and other scripts. I did not verify how Chrome isolates frames inside extension pages, which the docs I read do not describe.
- If a page detects the embedding context and changes what it serves, LinkPeek should report that as a failure and should not try to evade the check.

### Gaps
- Site isolation for extension-page iframes and offscreen documents is not documented in the pages I read.
- No source checked whether Chrome blocks popups or automatic downloads from a background tab created by an extension. That is standard browser behaviour, but I did not verify it here.

## Key Question 4: Chrome Web Store policy on rendering third-party pages and on remote code

### Takeaway
No policy text I read names rendering third-party pages in an MV3 extension, or stripping their headers. The closest rules are: the remote-code rule (it concerns the extension's own logic), the Limited Use rule on web browsing activity, the rule against concealed or non-obvious functionality, and the rule against circumventing paywalls or login restrictions. Whether a hidden-load design passes review is a reviewer's call that I could not check.

### Cited Findings
Quoted as returned by WebFetch from https://developer.chrome.com/docs/webstore/program-policies/policies. Check the live page before quoting.
- Remote code (under "Additional Requirements for Manifest V3"): "Execution of logic from a remote source is permissible only when accomplished through a documented API." Also: "these external resources must not contain any logic." The summary adds that loading scripts from outside the package or executing fetched strings (for example via eval()) is prohibited.
- Limited Use: "Collection and use of web browsing activity is prohibited." "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose." "All other transfers, uses, or sale of user data is completely prohibited."
- Concealment: "Developers must not obfuscate code or conceal functionality of their extension." "Don't misrepresent the functionality of your product or include non-obvious functionality."
- Paywalls and logins: "Do not facilitate unauthorized access to content on websites, such as circumventing paywalls or login restrictions."
- Enforcement: "Any attempt to circumvent intended limitations or enforcement actions."
- API use: "Extensions must use existing Chrome APIs for their designated use case."
- The only text I found on loading third-party sites is a Chrome Apps rule, "Provide a WebView of a website that is not owned or administered by you.", which applies only to Chrome Apps.
- Sources: [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies); the MV3 remote-code text is in the same page.

### Inferences
- Remote code: the page's own scripts belong to the site, not to the extension. LinkPeek's packaged content script is the extension's code and does not fetch or eval anything. So no violation is expected. The extension must still never fetch and run script text. Reviewers may still ask why the extension renders third-party code, so the permission justification should say so plainly (inference that such a form exists; not checked).
- Limited Use: local-only reading with no transfer fits "necessary for the extension's disclosed single purpose" best. Any server call, such as the existing opt-in AI summaries, is a separate transfer and needs its own disclosure (not reviewed here).
- Non-obvious functionality: a hidden load of a site the user did not open may count as non-obvious unless the listing and the card say what happens. Route D's opt-in is the clearest form.
- Paywalls: rendering a subscriber-only article with the user's own cookies is the kind of access the paywall rule names. Strip cookies and keep D27.
- Ads and page views: the policy text I read has no rule on impressions or page views caused by a hidden load. Publishers may still object. This is not verified.

### Gaps
- Web Store review outcomes for hidden-load or header-stripping extensions. I did not find a published case or reviewer guidance.
- Whether "web browsing activity" covers page content that the user linked to but did not open.
- The exact wording of the permission justification form. I did not check it.

## Key Question 5: Reliability on bot-check sites, which routes need a visible tab, and Chrome versions

### Takeaway
The hidden routes (tab, window, iframe) are most likely to fail on bot checks and frame-protected sites. The user cannot see or pass a challenge in a hidden tab or frame, and some sites refuse framing outright. Route F, a user click on a visible tab, is the most reliable. Every API in the scripted routes is at or below Chrome 116, except the 2023 iframe behaviour, which is unverified for current Chrome.

### Cited Findings
- Versions: offscreen 109+ (offscreen reference). credentialless default from 110 (Chrome blog). scripting 88+ (scripting reference). DNR modifyHeaders 86+ and tabIds 92+ (DNR reference). responseHeaders rule conditions 128+ (DNR reference). WithHostAccess 96+ (search summary). cross_origin_embedder_policy 93+ (manifest reference). debugger flat sessions 125+ (debugger reference). LinkPeek's minimum is 116 (scripts/manifest.mjs).
- rAF pauses in background tabs and hidden iframes (MDN rAF).
- LinkPeek's challenge classifier (src/core/retrieve/diagnose.ts, looksLikeChallenge) recognises Cloudflare, DataDome, PerimeterX, Imperva and Akamai markers, and the "unusual traffic" text. Once text is read, every route must end at this classifier, and a challenge is reported, never passed.
- Project rules: no paywall, login or CAPTCHA bypass, and no stealth or bot-check evasion (handoff.md, rules to keep).

### Inferences
- A challenge page inside a hidden tab or frame is invisible to the user, so the user cannot pass it either. Treat it as a robot check and stop. How Turnstile and similar widgets behave in background tabs or cross-origin frames is UNVERIFIED.
- Frame refusal is per site. Any site with X-Frame-Options DENY or SAMEORIGIN, or a frame-ancestors policy, fails Route A unless headers are stripped. The share of target sites that do this is unmeasured. A headers-only sample of news sites would size it, without rendering.
- Suggested test order for the owner's build. (1) Route F as the reliable fallback for JavaScript-built pages, since it needs no new permission. (2) Route A with credentialless and a content-script extraction, tested against local pages on 127.0.0.1 that send frame-blocking headers, a test cookie and a JavaScript-built body. scripts/serve-test-pages.mjs already serves local test pages. (3) Header stripping and tabId-scoped cookie removal, only if Route A's scope problem can be solved. (4) Route B and Route D as second tier.

### Gaps
- No measured data on how many news sites refuse framing, or how many use bot checks that break in hidden contexts.
- No test report for any route on current Chrome.

## Key Question 6: Open questions that a Chrome test on LinkPeek's own build would settle

1. Route A: does a content script run inside an iframe that the offscreen document embeds, on current stable Chrome? Test against a local page first, then the talkSPORT article. This settles the 2023 blog claim.
2. Route A: does an `<iframe credentialless>` load and render from an extension page? Does it need COEP on the offscreen document (the `cross_origin_embedder_policy` manifest key, Chrome 93)? Does it send a Cookie header? Set a test cookie on the local server and read the request headers in DevTools. Use no real login.
3. Route A: which headers stop framing (X-Frame-Options SAMEORIGIN and DENY, frame-ancestors variants)? Does a DNR modifyHeaders rule that removes them take effect for sub_frame requests that the offscreen document starts?
4. Route A scope: with such a rule active, does a normal tab that opens the same site also lose its frame protection? If it does, the rule is browser-wide and must not ship as written.
5. Route A timing: does rAF-driven rendering stall in the offscreen iframe? Compare extraction time for a page that renders on timers with one that renders on rAF.
6. Route B: does chrome.tabs.create with active set to false, then executeScript, read a JavaScript-built page with no window shown? Does Chrome discard the tab in a long session?
7. Route B: with a tabId-scoped session rule that removes the Cookie header, does the server receive no Cookie header? Are Set-Cookie responses removed as well?
8. Route B: does page-written document.cookie or localStorage survive the tab's close? What clean-up is needed, and does it need browsingData?
9. Route F: does executeScript work on the active tab with activeTab alone, after the user clicks LinkPeek's button? Does it also work on a tab that LinkPeek created?
10. Route D: in spanning mode, can a background instance executeScript into an incognito tab once the user has turned LinkPeek on in incognito? What is the exact wording of that switch in Chrome?
11. Permissions: does adding declarativeNetRequest (or WithHostAccess) to the manifest change the install or update warning in chrome://extensions? Does a new offscreen reason need a new version?
12. Bot checks: on a real challenge page (not solved, not passed), does the hidden tab or frame show the challenge, and does diagnose.ts's classifier catch it?
13. Versions: run the chosen route on Chrome 116 (LinkPeek's minimum) and on current stable.
14. talkSPORT (the first real case): does the server HTML hold the article text (LinkPeek's own diagnose shows this)? Which frame-blocking headers does it send (DevTools, Response headers)? Does the rendered DOM contain the text after load? Check for a challenge without trying to pass one.
15. Route E: does chrome.debugger attach need a host grant, and does Chrome show a debugging bar? Not needed unless the owner wants Route E.
16. chrome.pageCapture.saveAsMHTML, which needs the pageCapture permission: does its output for a hidden tab include the rendered DOM? This is a candidate I did not check.
17. Web Store: whether a reviewer accepts a hidden-load or header-stripping design. A test cannot answer this. The owner could ask Chrome Web Store support, or prepare the listing text and the permission justification first.
18. A headers-only sample of news sites (no rendering) would show how many refuse framing. This is the number that decides whether Route A is worth building.
