# LinkPeek permission design: one grant or per-site

Date of research: 21 Oct 2026. Scope: Chrome Manifest V3 options for LinkPeek reading links, and what Chrome shows and costs for each.

Method and limits. I read the LinkPeek source and docs locally (paths below). I read Chrome, Chrome Web Store and Google help pages through WebFetch, which returns model-written excerpts with quotes capped at 125 characters. Treat quoted wording as "reported by the fetch tool" until someone checks the live page. I ran no code and cloned nothing. I did not read /home/user/reports or /home/user/research_notes beforehand. I did not use any GitHub search tool.

Chrome version context: the Chrome docs I read mention "Chrome 148" for the browser.* namespace (page last updated 2026-09-11), so the current stable Chrome is at least 148. LinkPeek's manifest sets minimum_chrome_version 116.

Baseline, from the repo:
- Manifest (dist/manifest.json): permissions storage, activeTab, scripting, contextMenus, offscreen. optional_host_permissions https://*/* and http://*/*. No host_permissions.
- Per-site flow: popup "Turn on" and the card's "Allow access..." window call chrome.permissions.request (src/permission/permission.ts line 36; src/background/index.ts lines 65-68, 199-212).
- The window already has an "Allow all websites" button (src/permission/permission.ts line 55). Settings has a "Turn on for all websites" checkbox (src/options/options.ts lines 92-96).
- Smart mode is the default (src/core/storage/settings.ts line 23).

---

## 1. Chrome's per-extension site access settings, and whether an extension can change them

### Takeaway
Chrome gives the user a site access level for each extension, and I found no documented API that lets an extension change that level. The user changes it in Chrome. An extension can only ask for a host permission, which Chrome may show as a prompt.

### Cited Findings
- Current Chrome labels, extensions menu: "When you select the extension", "On [current site]", "On all sites". In Details: "On select", "On specific sites", "On all sites". Under On specific sites, an "Allowed sites" list has an "Add" button and a "Remove" option per site. Source: [Chrome help, site access](https://support.google.com/chrome/answer/160743?hl=en).
- The same help page says every described change is made by the user. It describes no prompt for changing the setting, no badge, and no way for an extension to change it. Source: same.
- The MV2 "User controls for host permissions" page (last updated 2018-10-01, a Manifest V2 page): "Beginning in Chrome 70, users have the ability to restrict extension host access". It says "In future releases, Chrome will provide more controls to users to adjust settings." It says on-click access acts "as if the extension had the activeTab permission" and that Chrome "badges your extension". It names no API for the setting. Source: [MV2 user controls](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions).
- The permissions reference has no call that reads or sets the site access level. Source: [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).
- Chrome never gives extensions access to restricted pages such as chrome:// pages. Source: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab). The docs I read do not list the Chrome Web Store as restricted. LinkPeek's own list includes it (src/core/sites.ts lines 42-47), and that is the team's claim.

### Inferences
- "Asking the user to change the setting" can only mean showing text and a screenshot that tells them where to click. The extension cannot open chrome://extensions in any way the docs I read allow. Treat that as unavailable until tested.
- An optional host grant should appear under "Allowed sites" in the On specific sites view. LinkPeek's options page lists granted origins that way (src/options/options.ts lines 132-143). Not confirmed in Chrome.
- Under "On click", the docs imply the extension gets access only after a click. A registered content script for an all-sites grant would then probably not run on its own. Not confirmed in Chrome.

### Gaps
- Whether chrome.permissions.contains still returns true for an all-sites grant when the user has picked On click. The grant exists, but automatic access may be off, and the options page may show a wrong state.
- The exact dialog text for each level.
- Whether an extension can tell which level the user chose.

---

## 2. chrome.permissions.request with several origins: prompts and what Chrome shows

### Takeaway
The docs do not say how many dialogs one request makes when it lists several origins. They say Chrome prompts "if adding the permissions results in different warning messages." That sentence is about when a prompt appears, not how origins are grouped. The number of prompts for LinkPeek's two-origin all-sites request has to be tested.

### Cited Findings
- "Chrome prompts the user if adding the permissions results in different warning messages." Source: [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions). The page does not say whether one call with several origins produces one prompt or several.
- "This lets you specify any origin in 'Permissions.origins' as long as it has a matching scheme." Paths on origin patterns are ignored. Source: same.
- "optional_host_permissions: Granted by the user at runtime, instead of at install time." Source: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
- "Adding or changing match patterns in the 'host_permissions' and 'content_scripts.matches' fields will also trigger a warning." Source: same.
- Install-time warnings: "Permission warnings dialog displayed on installation." On update, the extension "will be disabled until the user accepts the new permission." Source: [Permission warning guidelines, last updated 2024-02-05](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings). That page does not list the warning text for https://*/*, http://*/* or specific hosts. It refers to the permissions reference, and it says "Some permissions may not display warnings when paired with other permissions."
- Google help, medium-alert wording: "Your data on all the websites you visit" is described as giving "access to read, request or modify data from every page you visit (bank account, Facebook)." "Your data on a list of websites" is described as giving "access to read, request or modify data on pages you visit on a list of specified websites." Source: [Chrome Web Store help, permissions](https://support.google.com/chrome_webstore/answer/186213?hl=en).
- The same help page: "Optional permissions will ask you to deny or allow permissions after the app or extension has been installed." It also says "When you allow optional permissions, you can't change them after." That sits oddly next to the site access help, which does let users remove sites. Read it as unclear, and test it.
- LinkPeek requests both schemes in one call (src/options/options.ts line 96; ALL_SITES in src/core/sites.ts line 62). The repo says Chrome refuses a single any-scheme pattern (src/core/sites.ts lines 79-82). That is the team's observation. The docs say only that the pattern must have a matching scheme.

### Inferences
- A two-origin all-sites call probably gives one dialog, because the two origins carry the same warning. Not confirmed.
- A list of named sites probably gives one dialog with the "list of websites" warning. Not confirmed, and the number of origins that Chrome accepts in one call is not documented.
- The exact Chrome text for https://*/* and http://*/* is not confirmed from a primary source. The Google help wording above is the best primary text I found. A search snippet quoted a one-off wording, "Read and change all your data on the websites you visit", from a 1Password forum thread. I did not open that thread, so I give no URL.

### Gaps
- The number of dialogs per call. The docs are silent. I tried the Chromium source: a raw GitHub fetch of chrome/browser/extensions/api/permissions/permissions_api.cc returned 404, and a search did not find the current file.
- Whether origins that are already granted in the same call are re-prompted or skipped.
- The dialog text for one site, for a list, and for all sites, as Chrome shows it today.

---

## 3. addHostAccessRequest (the per-site toolbar request)

### Takeaway
It asks for access to one site, for one tab, through an "Allow" message beside the toolbar icon. It needs Chrome 133 or later, and the new extensions menu that it depends on was in testing in late 2024. I could not confirm that it reached stable Chrome. It still asks site by site, so it does not give one grant.

### Cited Findings
- "Chrome 133+ MV3+." "Request will only be signaled to the user if extension can be granted access to the host in the request." "When accepted, grants persistent access to the site's top origin." "Request will be reset on cross-origin navigation." Source: [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).
- Blog, 19 Nov 2024: "calls will be ignored if the new menu is not enabled." "The API is enabled by default in Chrome 133.0.6860.0 and higher (currently in Chrome Canary)." "A user can also choose to turn off the ability for an extension to show requests." "Chrome might throttle excessive requests." "Clicking 'Allow 1?' within the toolbar provides a faster way to grant immediate access." Source: [Prepare your extension as we begin testing a new extensions menu](https://developer.chrome.com/blog/new-extensions-menu-testing).
- The blog example calls the method from a tabs.onUpdated listener, not a click. The blog does not say whether a user gesture is required. Source: same.
- One search snippet of the reference listed a documentId option. The blog mentions only tabId. I did not confirm documentId from the page.

### Inferences
- Its best use is as a second step when a user has already chosen to read a withheld site. It would replace LinkPeek's own window with Chrome's toolbar message, but the user would still give one grant per site.
- The grant is persistent, like an optional host grant. It would probably appear in the same site list, but that is untested.
- Because the user can turn off all requests, LinkPeek would still need its own window as a fallback.
- Feature detection is required. The minimum Chrome version of 116 would not have it.

### Gaps
- Whether the new menu is on by default in stable Chrome in 2026.
- Whether a click is needed.
- Whether the grant shows under Allowed sites.

---

## 4. User gesture rules

### Takeaway
chrome.permissions.request must run inside a user gesture. The docs' example is a button's click handler. They do not say what happens to a page opened at install, and they do not say how long a gesture lasts across await calls.

### Cited Findings
- "Request the permissions from within a user gesture using permissions.request():" and the example comment "Permissions must be requested from inside a user gesture, like a button's click handler." Source: [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).
- The MV2 page says permissions.request "requires a user gesture." Source: [MV2 user controls](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions).
- activeTab is enabled by an action click, a context menu item, a keyboard command from the commands API, or an omnibox suggestion. "An extension with the 'activeTab' permission only obtains access to a tab in response to an explicit user gesture." Source: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
- Repo: the request is called first in the click handler at src/permission/permission.ts line 36 and src/options/options.ts line 96. The "all websites off" path in src/options/options.ts lines 99-106 calls permissions.request on line 105, after two awaits (lines 103-104). The comments in that file say Chrome "doesn't ask again" for access the extension gave back. The docs do not say this.
- Weak and old evidence: a 2016 W3C thread says gestures sometimes fail to carry through Promise.then, and the author called that a bug. Source: [W3C public-webapps 2016](https://lists.w3.org/Archives/Public/public-webapps-github/2016Apr/0996.html). A 2014 Chromium review, seen only as a search snippet, says a gesture carries into the success callback of permissions.request when the request is made with a gesture. Source: [codereview.chromium.org/2153763002](https://codereview.chromium.org/2153763002/) (not opened).

### Inferences
- A click on a button in an extension page (the options page, the popup, or the permission window) should count as a gesture, because that is the docs' own example. Whether a page opened at install counts the same way is untested. The docs do not exclude it.
- The "all websites off" restore on line 105 may fail silently, because .catch(() => false) hides the error. If so, per-site grants would be lost when the user unticks all websites. This is a bug candidate to test, not a confirmed bug.
- Safe pattern: call chrome.permissions.request synchronously in the click handler, before any await.

### Gaps
- The exact time window of a gesture across awaits.
- Which extension contexts can call request. The repo comment says extension pages only. The docs I read do not list the contexts.

---

## 5. activeTab, declarativeNetRequest and offscreen: what each reads

### Takeaway
None of these three lets LinkPeek read the text of a link on another site without a host grant. activeTab reads the one tab the user acted on, and only until the user leaves that page. declarativeNetRequest cannot read page content. offscreen carries the extension's own permissions, so it adds no reading power.

### Cited Findings
- activeTab: "gives an extension temporary access to the currently active tab." "Access to the tab lasts while the user is on that page, and is revoked when the user navigates away or closes the tab." With the scripting permission, it allows scripting.executeScript on that tab. It also allows reading the tab's URL, title and favicon. It does not display a permission warning. Source: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [Permission warning guidelines](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings).
- declarativeNetRequest: "Triggers a permission warning at install time." declarativeNetRequestWithHostAccess: "A permission warning is not shown at install time." The API "block or modify network requests by specifying declarative rules." The docs describe modifying requests "without intercepting them and viewing their content." That implies no content reading, but the docs do not state it as a rule. Redirect examples say they "require host permission". Available since Chrome 84. Source: [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
- offscreen: "The extension's permissions carry over to offscreen documents, but with limits on extension API access." Reasons include DOM_PARSER ("needs to use the DOMParser API") and WORKERS. Only AUDIO_PLAYBACK has a lifetime limit ("close after 30 seconds without audio playing"). "All other reasons don't set lifetime limits." Available since Chrome 109 with the offscreen permission. Source: [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen). LinkPeek's two-minute idle close is the team's own timer (src/background/retrieve.ts lines 132-162).

### Inferences
- The docs settle what each one is for, not what it can read across sites. For cross-site fetching I infer that an offscreen document still needs a host grant, because it carries the extension's permissions and cross-origin requests are governed by them. The docs do not say this in so many words.
- For LinkPeek: offscreen can keep the DOMParser role it already has (fetched HTML goes in, Readability runs). It cannot widen what the extension may fetch.
- declarativeNetRequest could not supply article text. Its install warning would be an extra cost with no benefit for this feature.
- Under activeTab, the card can read same-site links, because a same-site fetch happens inside the page (docs/decisions.md D24). A link to another site still needs a host grant.

### Which options let LinkPeek read a link the user has not clicked
- Any option that gives a host grant, plus a content script on that page: per-site grants, a list grant, the all-sites grant, or an addHostAccessRequest grant.
- A server-side fetch by LinkPeek's own backend. This needs no extension grant, but it breaks the privacy rules (see option H).
- None of activeTab, declarativeNetRequest or offscreen.

### Gaps
- Whether declarativeNetRequest can read response bodies. The docs imply no, and do not say it.
- Whether offscreen cross-origin fetches need host permission in practice. Test it.

---

## 6. The content script footprint

### Takeaway
A granted site gets LinkPeek's full content script on each top-level page load. Under an all-sites grant with the default Smart mode, that means icon scanning on every site the user visits, unless the user turns sites off one by one. The file is small (about 47 KB unminified, 17 KB gzipped), so the cost is behaviour, not download size.

### Cited Findings
- One dynamic script, id "linkpeek-sites": matches are the granted origins, js is content.js, runAt document_idle, persistAcrossSessions true (src/core/sites.ts lines 20-36). allFrames is not set, so the Chrome default applies: "Defaults to false, meaning that only the top frame is matched." Source: [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting). persistAcrossSessions defaults to true (same page).
- At load, the script reads settings, builds the page controller, removes leftovers, listens for messages, and calls apply (src/content/index.ts lines 33-48).
- apply() returns at once if the site is disabled or the mode is not smart (src/content/controller.ts line 103). In Smart mode it asks the service worker whether the site is allowed (line 104; src/background/index.ts line 85 checks permissions.contains). Then it starts scanning (line 107), after a quiet-page wait on the first scan (lines 111-113).
- DEFAULT_SETTINGS.mode is 'smart' (src/core/storage/settings.ts line 23).
- Measured locally on today's build (not profiled in Chrome): dist/content.js is 48,027 bytes, 16,780 bytes gzipped. dist/background.js is 27,930 bytes.

### Inferences
- Under an all-sites grant, content.js runs on every http and https top-level page. Mode Manual or Scan returns before scanning (controller line 103), so the cost there is start-up only: a storage read, building the controller, one listener. I did not profile that cost.
- Under an all-sites grant in Smart mode, icons would appear on every site by default. The only per-site brake in LinkPeek is disabledSites (src/core/storage/settings.ts lines 9-12; src/content/controller.ts line 152; src/popup/popup.ts line 95). The user would have to turn sites off one at a time.
- Can it load only when needed? Options:
  - Keep the registration, but make it a small loader that stops unless the user has acted. It still runs on every page.
  - Remove the registration and inject with scripting.executeScript on demand. Under activeTab that happens only on a click. Under an all-sites grant it could run on navigation, but that needs a navigation trigger, and webNavigation's warning text is not verified here.
  - Change the default mode to Manual or Scan, so no page scans by default. The script still runs on each page.
- Product decisions that follow from this are for the owner: the default mode, and whether D17 ("Sites are switched on one at a time") still stands.

### Gaps
- How the registered script behaves under On click, and whether it runs at all.
- The real start-up cost on busy pages under an all-sites grant.

---

## 7. Chrome Web Store policy

### Takeaway
The policy text asks for the narrowest permission that does the job, the least access when more than one permission could do it, a narrow single purpose, and a justification for each permission. It does not name all-sites access as a breach. The statement in docs/decisions.md D17 that broad access "slows Chrome Web Store review" is not in the policy text I read. The one review sentence I found is "Requesting broader permissions than necessary may cause your extension to be rejected."

### Cited Findings (quotes as reported by the fetch tool; re-check on the live page before quoting to a reviewer)
- Use of Permissions (last updated 2022-11-01): "Request access to the narrowest permissions necessary to implement your Product's features or services." "If more than one permission could be used to implement a feature, you must request those with the least access to data or functionality." "Don't attempt to 'future proof' your Product by requesting a permission that might benefit services or features that have not yet been implemented." Source: [Use of permissions](https://developer.chrome.com/docs/webstore/program-policies/permissions).
- Program policies, "Be Safe": "We will remove extensions that pose security threats, access data beyond what is necessary to implement their functions." Source: [Program policies](https://developer.chrome.com/docs/webstore/program-policies).
- Limited Use (last updated 2022-11-01): "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose." "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature." "Do not allow humans to read user data, unless:" (with listed exceptions). "Limit your use of user data to providing or improving your single purpose." Source: [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use).
- Single purpose (Quality guidelines, last updated 2024-07-10): "An extension must have a single purpose that is narrow and easy to understand." The page says nothing on host access. Source: [Quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines).
- Developer dashboard privacy page (last updated 2020-06-12, so probably out of date): "Fill out these fields to tell the reviewers why your extension needs to use each permission." "Requesting broader permissions than necessary may cause your extension to be rejected." The page also covers the data-collection disclosure and the limited-use certification. Source: [Dashboard privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
- Warnings shown to users (Google help): "When you install or update apps and extensions, a warning to access your data may appear." "The warning doesn't mean the app is dangerous, just that it can be." Source: [Chrome Web Store help](https://support.google.com/chrome_webstore/answer/186213?hl=en).

### Inferences
- A reviewer would probably ask why all sites are needed, and LinkPeek's answer would have to explain why per-site grants do not serve the feature. The policy does not define "necessary" for a link preview, so that call is the reviewer's.
- The limited-use line on browsing activity matters for any feature that reads every page. LinkPeek's on-page scanning is local, and nothing leaves the browser unless the user turns on AI summaries (docs/decisions.md D35 and D36). The reviewer may still ask for the scanning to be explained in the privacy disclosure.
- Ground rule 34 in build-plan/00-ground-rules.md ("Smallest permissions possible. Prefer optional host permissions requested when the user acts.") fits the policy's least-access wording.

### Gaps
- No source found on how long reviews take for host permissions, or on rejection rates.
- The fetch tool summarised the policy pages. Quotes are close to the text but are not checked against the raw HTML.
- The current dashboard privacy form may differ from the 2020 page.

---

## 8. User comprehension evidence

### Takeaway
The best studies I could read show that people pay little attention to install-time permission warnings and understand little about what extensions can do. They are about Android (2012) and a 2021 online survey of browser extension users. I found no study of Chrome's three site access levels, the all-sites wording, or a prompt shown at the moment of need.

### Cited Findings
- Felt et al., "Android Permissions: User Attention, Comprehension, and Behavior" (SOUPS 2012). An internet survey of 308 Android users and a lab study of 25. "17% of people paid attention to permissions during installation." "Only 3% of Internet survey respondents could correctly answer all three permission comprehension questions." Conclusion: "current Android permission warnings do not help most users make correct security decisions." Source: [Berkeley EECS-2012-26](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2012/EECS-2012-26.html).
- Kariryaa et al., SOUPS 2021, "Understanding Users' Knowledge about the Privacy and Security of Browser Extensions." An online survey of 353 participants. "They have limited knowledge about the technical abilities of browser extensions." "We found that users report interest in seeking information, trust the developers but do little to protect their data." Participants "prefer permission statements that evoke a clear mental model." Source: [USENIX SOUPS 2021](https://www.usenix.org/conference/soups2021/presentation/kariryaa). I read only the abstract, and the study is self-report.
- Not used: a 2011 Felt et al. WebApps paper on app permissions that claims repeated warnings lose their effect. The PDF returned as unreadable binary, so I could not check its claims. Source: [PDF](https://people.eecs.berkeley.edu/~daw/papers/perms-webapps11.pdf). Not used: a vendor blog's claim that under 20% of users can explain "<all_urls>". No study is named, so it is unverified. Source: [Remio](https://www.remio.ai/post/chrome-extension-permissions-are-becoming-a-new-browser-risk).

### Inferences
- An install-time all-sites prompt, shown before any use, probably gets the least attention. A prompt shown at the moment of need might get more attention, but I found no evidence either way. That is a real gap for option B against option C.
- Both studies measure self-report or attention, not whether a grant changed what users did. Neither tests Chrome's current dialog.

### Gaps
- No Chrome-specific comprehension study found.
- No study of the On click or On all sites settings.
- The 2021 study's full method and results were not read, only the abstract.

---

## 9. Examples: extensions that ask for broad access

### Takeaway
The examples I could read ask for broad access at install and explain little in the manifest. The one wording I found that ties all-sites access to a user action is in a help article I could only see as a search snippet.

### Cited Findings
- uBlock Origin (manifest version 1.15.11.0): permissions include "<all_urls>", webRequest and webRequestBlocking. No optional or host_permissions fields. Content scripts match http and https pages at document_start with all_frames true. The description is a message key, so the explanation is not in the manifest. Source: [uBlock manifest](https://raw.githubusercontent.com/gorhill/uBlock/master/platform/chromium/manifest.json).
- Vimium: "<all_urls>" in host_permissions, which is install-time, with content scripts on all URLs at document_start and all_frames true. No optional fields. Description: "The Hacker's Browser. Vimium provides keyboard shortcuts for navigation and control in the spirit of Vim." Source: [Vimium manifest](https://raw.githubusercontent.com/philc/vimium/master/manifest.json).
- Awesome Screenshot help article "Explain the On all sites permission": a search snippet reads "'On all sites' is a one-time access grant after you click our extension." The page returned HTTP 403 when fetched, so I could read only the snippet. Source: [Awesome Screenshot help](https://support.awesomescreenshot.com/hc/en-us/articles/52312193217689-Explain-the-On-all-sites-permission-for-This-can-read-and-change-site-data).
- GitHub search: two searches with a site:github.com filter returned no GitHub repositories. I found no open-source example of an optional all-sites request with onboarding text.

### Inferences
- Common practice in the examples is install-time broad access, not a later optional grant. That is the opposite of LinkPeek's current design, so it does not support the owner's proposal by example.
- The Awesome Screenshot wording ("one-time", "after you click") is the closest model for copy that ties a grant to a click, but I could not read the whole article.

### Gaps
- Examples that use optional all-sites requests with on-page explanations, read from the source.

---

## 10. The options compared

For each option: what the user sees, how many prompts, whether it needs a click first, what it can read, the policy and rule implications, the comprehension evidence, the sources, and what I could not verify.

### A. Current per-site grants (baseline)
- What the user sees: nothing at install. When the user acts on a new site, Chrome shows its site dialog (help wording "Your data on a list of websites").
- Prompts: one per new site, each time the user acts. This is the owner's complaint.
- Click first: yes (Turn on, or Allow access in the window).
- What it reads: the granted site only, through its content script and the service worker.
- Rules: matches ground rule 34 and D6, D17. Warnings: none at install, as the team's table in docs/permissions.md says. Not checked against a fresh install.
- Evidence: Felt 2012 and Kariryaa 2021 (attention and understanding are low for install-time warnings).
- Sources: docs/permissions.md; src/permission/permission.ts; [Chrome help](https://support.google.com/chrome/answer/160743?hl=en).
- Not verified: the exact dialog text for one site.

### B. "Allow all websites" at the moment of need (already in the window)
- What the user sees: when a card needs a site they have not allowed, the LinkPeek window offers "Allow this site", "Allow all websites" and "Not now". Choosing "Allow all websites" shows one all-sites dialog.
- Prompts: one all-sites dialog, after which the user is not asked again. Count not verified.
- Click first: yes, the user picks the button in LinkPeek's window.
- What it reads: any http or https site the user visits, through the content script, and any article fetch the service worker makes. This is the widest host permission Chrome offers, and Chrome offers no read-only host permission in the docs I read.
- Rules: fits ground rule 34 (optional, requested when the user acts). Changes D17 only if the user chooses it. Smart mode becomes the default across all sites unless the default changes (section 6). Policy: the least-access wording applies, so the justification must say why per-site grants do not serve the feature.
- Evidence: the attention and understanding figures from section 8. No evidence on prompts shown at the moment of need.
- Sources: src/permission/permission.ts line 55; docs/decisions.md D24; the sources in sections 1, 2 and 7.
- Not verified: dialog count, dialog text, behaviour under On click, and whether the current permission window copy explains what all-sites access does.

### C. One all-sites request from a setup button after install
- What the user sees: a welcome or options page opened at install with a button such as "Turn on for all websites". The button triggers the all-sites dialog.
- Prompts: one all-sites dialog (not verified).
- Click first: yes, a button on an extension page. Whether a page opened at install counts is not verified.
- What it reads: the same as B, from the first page load after install, with Smart mode as the default unless changed.
- Rules: optional, but the user has not yet needed any site. This goes against the purpose of ground rule 34 ("requested when the user acts") and reverses D6 and D17. Policy: the reviewer would need the justification for all sites before any feature needed it.
- Evidence: an install-time prompt is the case where Felt 2012 found the lowest attention. Same as section 8.
- Sources: [Permission warning guidelines](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings); [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions).
- Not verified: whether the button works from the install-opened page, and the dialog text.

### D. One grant for a named list of sites
- What the user sees: one dialog with the "list of websites" warning (help wording), then the list under Allowed sites.
- Prompts: one per call (not verified). A new site outside the list prompts again.
- Click first: yes.
- What it reads: only the listed sites. Coverage depends on the list, so most links elsewhere still need a new prompt.
- Rules: narrower than B and C, and the least-access wording is easier to meet. But the list must be justified, and it does not give "never asked again".
- Evidence: the list wording is less alarming than the all-sites wording. No study.
- Sources: [Chrome Web Store help](https://support.google.com/chrome_webstore/answer/186213?hl=en).
- Not verified: how Chrome handles long lists (for example, 100 or more origins in one call), and the dialog text.

### E. activeTab only (no host grant)
- What the user sees: no dialog. The user clicks the toolbar button, a context menu item or the shortcut.
- Prompts: none.
- Click first: yes, every time.
- What it reads: the clicked tab, until the user leaves it. Same-site links can be fetched inside the page (D24), so the card works for same-site articles. Cross-site articles cannot be fetched without a host grant. Icons would not appear on other pages.
- Rules: the cleanest fit with ground rule 34 and the least-access rule. It removes the cross-site reading flow that D24 depends on.
- Evidence: none needed; no prompt is shown.
- Sources: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab); docs/decisions.md D13 and D24.
- Not verified: how often the cross-site article case occurs in real use. The live check in docs/compat would answer it.

### F. addHostAccessRequest per site
- What the user sees: an "Allow" message beside the puzzle-piece icon in the toolbar, or "Allow 1?" for a quick grant.
- Prompts: one per site, per tab. The grant is persistent.
- Click first: not stated. The blog's example calls it without a click.
- What it reads: the granted site, like A.
- Rules: still per-site, so it does not give one grant. It needs Chrome 133 or later and the new menu, and the user can turn off all requests.
- Evidence: none found.
- Sources: [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions); [Blog, 19 Nov 2024](https://developer.chrome.com/blog/new-extensions-menu-testing).
- Not verified: current stable availability and whether a click is needed.

### G. declarativeNetRequest or offscreen as a reading route
- What the user sees: declarativeNetRequest shows a warning at install (per the docs). offscreen shows nothing.
- Prompts: none for offscreen. The declarativeNetRequest warning is at install.
- Click first: not relevant.
- What it reads: declarativeNetRequest cannot read content (the docs imply it and do not say so). offscreen has the extension's own permissions and adds no reading power.
- Rules: no benefit for the reading problem. It would add a warning for declarativeNetRequest.
- Sources: [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest); [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
- Not verified: whether declarativeNetRequest can read response bodies.

### H. LinkPeek's server fetches the article (no extension grant)
- What the user sees: nothing from Chrome.
- Prompts: none from Chrome.
- Click first: yes, to ask for a card.
- What it reads: the server fetches any site without the user's grant and sees every link the user previews. The fetch also leaves the user's IP and cookies behind, and it can be blocked or served different content.
- Rules: this breaks "No LinkPeek server" (D24), "Never send page text anywhere without the user asking" and "Never send cookies, session tokens or login details to any outside service" (ground rules), and the cost concern in D24. Under the Web Store policy, sending every previewed address to a server is hard to square with "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature." I would not recommend it.
- Sources: docs/decisions.md D24 and D36; build-plan/00-ground-rules.md; [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use).
- Not verified: how the server route would be reviewed in practice.

### Which option gives one grant with the smallest footprint
Among options that end the repeat prompts, B is the smallest footprint. It is the same permission as C, but the user is asked only when a card needs a site they have not allowed, so fewer users receive it and the reason is visible at the time. It already exists in the window. C matches the owner's wording ("one grant after install") and is the weaker fit for ground rule 34. D and F still prompt again. E avoids prompts but gives up cross-site reading. H breaks the privacy rules.

---

## Questions a Chrome test on LinkPeek's own build would settle

Use the real build (dist/, not dist-e2e or dist-live), current stable Chrome, with the version recorded. Each item has a question, a test and the option it affects.

1. How many dialogs does the all-sites request produce? Click "Turn on for all websites" in Settings. Record the number of dialogs and screenshot the text. Repeat with https://*/* only, with three named sites in one call, and with the same three sites in three calls. (Options B, C, D.)
2. Does an origin that is already granted get re-prompted in a later call? Grant one site, then request a list that includes it. (B, C, D.)
3. Is the gesture rule met by a call in the click handler, before any await? Then test the options.ts line 105 path: grant per-site origins, tick and untick "all websites", and check whether the per-site grants come back, come back with a prompt, or disappear. (B, C, the bug candidate.)
4. Does a button press on the page opened at install count as a gesture for permissions.request? Test this with a fresh install. (C.)
5. Under On click, with all sites granted, does the registered content script still run? Check window.__linkpeekLoaded on a news page after switching the setting. What do permissions.contains and the options page show? (B, C, and the claim in section 1.)
6. Under an all-sites grant, how many icons appear by default, and does Manual or Scan avoid scanning as controller.ts line 103 says? Measure start-up time on a 1,200-link page. (B, C, and the mode decision.)
7. Does an all-sites grant still refuse chromewebstore.google.com and chrome:// pages? (B, C.)
8. With no host grant, does an offscreen cross-origin fetch fail? Does a per-site grant make it work? Does activeTab reach a new tab? (E, G, and the claims in section 5.)
9. With Chrome 133 or later and the new menu on, does addHostAccessRequest work without a click? What does the toolbar show? Does the grant appear in the Allowed sites list? (F.)
10. Does a fresh install of the current manifest show any warning? The team's table in docs/permissions.md says none, and the warnings page does not list per-permission warnings. (A, all options.)
11. What does a user see after allowing all websites: can each site be removed, and does the help page's "you can't change them after" line hold? (B, C, D.)
12. A usability test, not a Chrome test: show 10 to 15 people the actual dialog text from items 1 and 2, then ask what they think LinkPeek can read. Compare an install-time prompt with a prompt at the moment of need. Only a user test can settle comprehension, and no study found here covers this case. (B, C.)

---

## Summary of what I could not confirm
- The number of dialogs for one permissions.request call, and the exact dialog text for each pattern.
- Whether a gesture survives an await in Chrome (options.ts line 105 is a suspect).
- Whether addHostAccessRequest needs a click, and whether the new menu is on by default in stable Chrome.
- Whether the registered content script runs under On click.
- The Chromium source for the permission request path (raw GitHub fetch returned 404).
- The Felt 2011 claims (PDF unreadable). The 20% statistic from the vendor blog is unsourced and not used.
- The Awesome Screenshot help article (HTTP 403; snippet only).
- The Web Store policy quotes come from a fetch tool that summarises pages. Check them against the live pages before quoting them to a reviewer.
