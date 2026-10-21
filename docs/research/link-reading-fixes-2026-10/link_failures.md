# LinkPeek link reading fixes in depth

Prepared 21 Oct 2026. Scope: the common reasons a link to an article fails to give readable text, and how a link reader should handle each one. Read the decisions list at the end first if you only have five minutes.

## Method, sources and limits

- Repo read: docs/decisions.md (D20 to D51), src/core/retrieve/diagnose.ts, src/core/messages.ts, docs/compat/part-04-live.md, docs/progress.md. Also the code that fetches, judges and reads a page (fetcher.ts, assess.ts, offscreen.ts, extract/html.ts, view-model.ts), plus a grep of src/ for each signal named below. /home/user/reports and /home/user/research_notes were not read.
- Labels used below: (fetched) = read on the page or file; (snippet) = seen only in search result text; (secondary) = law firm, vendor or news report; (not checked) = not confirmed in this run.
- Blocked or empty: EUR-Lex (ePrivacy Directive, GDPR, Planet49) returned empty pages; the CURIA link redirected to an empty page; the Bitly support article returned 403; the raw autoconsent README returned 404. Points that depend on those are marked.
- Process note: about 75 tool calls, well above the usual research budget, because the brief covers about twelve failure types and each needed a source.

Biggest unverified items: the ePrivacy Article 5(3) text, the Planet49 ruling, the CNIL decision (press reports only), the Digital Omnibus status, the default behaviour of both consent tools, t.co and Bitly redirect behaviour, and the DataDome and PerimeterX signals (secondary sources only).

## What LinkPeek does today

Checked against the code. Line numbers refer to the current repo.

- Fetches send no cookies and no referrer, follow redirects, time out, and stop at size limits (fetcher.ts lines 48 to 66). Only the body and two headers (content-type, content-length) are read. A grep of src/ finds no use of cf-mitigated, x-datadome, Retry-After or Link headers.
- A PDF is detected only when the content type is application/pdf, or when the type is empty and the address ends in .pdf (fetcher.ts line 68). A PDF sent as application/octet-stream becomes "unsupported" (diagnose.ts contentKind). This is a real gap.
- HTTP 451 falls into the generic 4xx branch and shows "The site said the page isn't available." (diagnose.ts failureFromStatus; messages.ts).
- There is no link-wrapper unwrapping. A grep for l.php, t.co and news.google finds nothing in the source.
- A link that lands on another page of the same host gets no note. view-model.ts only notes a different host (line 87). The card is built from whatever page the link lands on.
- Readability runs with charThreshold 400 (html.ts line 114). Its documented default is 500 (fetched README).
- No consent detection, no iframe handling and no shadow DOM handling. A grep finds none.
- Paywalls use isAccessibleForFree, read from JSON-LD including nested parts (html.ts lines 290 to 296), plus text patterns for short pages (diagnose.ts). Body text from a paywalled page is never shown.
- The "mismatch" link-warning level exists in the types and the copy. I found no code path that produces it outside fixtures and tests. src/core/security/README.md lists redirects and mismatched links as Part 11 work.

## Alternative public sources: when they are allowed

Takeaway: An alternative source is acceptable only when the publisher offers the same article openly, the page itself is not marked as non-free, and the request carries no login or cookies. It is never acceptable for a paywalled or login-only article, and never through archives or third-party caches.

### Cited findings

- Google's paywall guidance (fetched) says a section behind a paywall is marked with isAccessibleForFree set to false, and tells publishers to "ensure that your bot access policy is the same for AMP and non-AMP pages." https://developers.google.com/search/docs/appearance/structured-data/paywalled-content
- Google dropped the requirement for AMP in Top Stories (Search Central blog, May 2020 and April 2021; snippets). Current AMP status was not checked. https://developers.google.com/search/blog/2020/05/evaluating-page-experience and https://developers.google.com/search/blog/2021/04/more-details-page-experience
- How often feeds or AMP copies carry full text of paywalled articles: no source found (not checked).

### Inferences

- Allowed: the publisher's own feed item, AMP copy or other public version of the same article, when the page is free (no isAccessibleForFree false, no paywall markers), with no login and no cookies. The publisher is choosing to publish it openly, so the reader is not getting past a wall.
- Not allowed: the same copies for an article the page marks as paid. A feed or AMP copy of paywalled text is a route round the publisher's stated paywall, which the owner's no-bypass rule forbids.
- Not allowed: archive services (Wayback Machine, archive.today). They are third-party copies made for readers who did not reach the page, they send the link to another company, and they are often used to get round paywalls. Their own terms were not checked.
- Not allowed: Google News decoding or any other undocumented Google endpoint (see the redirects section).
- Owner's decision: official oEmbed endpoints for video and social pages. They are public and built for embedding, but they send the link to the platform. Current YouTube and X documentation was not checked.

### Gaps

- How common full text in feeds or AMP copies is.
- Current AMP status in 2026.
- Feed discovery through a link rel="alternate" tag is standard HTML practice (general knowledge; not checked).

## Redirects and link wrappers

### Takeaway

Wrappers come in three kinds: a destination written in the address (Facebook's l.php?u=), a server redirect that needs a request (t.co, bit.ly), and an address that holds no visible destination (Google News). Unwrap the first on the device, don't follow the second on hover, and don't call Google's internal endpoints for the third.

### Cited findings

- Facebook: the ClearURLs rules database (fetched) has a Facebook rule, `^https?:\/\/l[a-z]?\.facebook\.com/l\.php\?.*?u=(https?%3A%2F%2F[^&]*)`, which captures the percent-encoded destination. It has a matching Messenger rule for l.messenger.com. https://raw.githubusercontent.com/ClearURLs/Rules/master/data.min.json
- Facebook's wrapper reportedly still applies to outbound links and logs clicks (blog snippets; not checked).
- Google News: the decoder README (fetched) says: "After 2024 that id is opaque — it is not a base64 publisher URL." Decoding sends a signature request, then one POST to Google's batchexecute endpoint. The README suggests an interval between requests to avoid HTTP 429. https://github.com/SSujitX/google-news-url-decoder
- Google News: one port's author reports that non-browser clients are sent to Google's unusual-traffic page. The author calls this their own inference (secondary; not checked).
- bit.ly: Bitly's support article (snippet; the page returned 403) says "we introduced an interstitial page that includes a preview of the link destination and an ad" for free links, and that a paid plan removes it. https://support.bitly.com/hc/en-us/articles/32874287800333-Why-are-there-ads-on-my-links
- bit.ly: whether the preview is a 301 or a page with a client-side redirect is disputed between two blogs (snippets). Unresolved.
- bit.ly: adding "+" to a short link is said to show a stats or preview page (a travel blog's claim; not checked against Bitly).
- t.co: no primary source found. The visible part of the ClearURLs file has no t.co or bit.ly entry, but the file is truncated after t.umblr.com, so this is partial.
- Click counting: shorteners count clicks, so a preview fetch probably counts as a click for the link owner (inference from how shorteners work; not checked).

### Signals

- Known wrapper hosts and paths: l.facebook.com/l.php and l.messenger.com/l.php with a u= parameter; t.co; bit.ly and other shorteners; news.google.com/articles/ and /rss/articles/ with opaque IDs.
- A 3xx response that the fetch follows, ending on a different host (res.url shows the end).
- A 200 page on the shortener's own host, with preview or advert wording.
- Final address still on the wrapper host after the fetch.

### Inferences

1. Facebook-style wrappers: unwrap on the device. Parse the u parameter, check it is http or https, and treat the result as the link. No request is made, so there are no cookies, no referrer and no permission needed for the wrapper host. The destination still follows the normal access rule (D24). Reason: it removes a request and avoids asking the user to allow a wrapper domain.
2. Server-redirect shorteners (t.co, bit.ly, unknown wrappers): do not follow them on hover or during a scan. When the user opens the card, show "This is a short link. Open it to see where it goes." Following it would need permission for the shortener's host before the article's host, would probably count as a click for the link owner, and could land on an advert interstitial. Following it is one of the owner's decisions below.
3. Interstitial pages: if the final page is still on the wrapper's host, or its text is preview or advert wording, show "This link goes through a preview page, not the article." Don't summarise it. That text belongs to the wrapper.
4. Google News: show "This is a Google News link. LinkPeek can't open these yet." Don't call batchexecute or any other Google endpoint. It is undocumented and rate-limited, and it belongs to a third party's internal interface that could change or block the extension.
5. Any other wrapper: treat it as a shortener.
6. Privacy copy: the options page says LinkPeek fetches "that one page from its own website" (src/options/index.html line 79). Following a wrapper to another host would make that wrong, so the copy must change if following is chosen.

### Rules and law

- No cookies, no logins and no referrer on any fetch (fetcher.ts). Local unwrapping sends nothing at all.
- Access: a fetch from the extension needs host access to the host it reaches. Chrome's guidance (fetched) says extensions "can talk to remote servers outside of its origin, as long as the extension requests host permissions." For a shortener, following it would mean asking the user to allow t.co before the article.
- Law: UK PECR regulation 6 and the EU ePrivacy rule concern storing or reading information on the user's device (see the consent section for the text). A local URL parse and a no-cookie request store and read nothing on the device, so they don't raise the consent question. This is my reading, not legal advice.
- Fetch Standard (fetched, section 2.2.5): with credentials "omit", "any credentials sent back in the response" are ignored. So a redirect cannot leave a cookie behind.

### Open-source tools

- ClearURLs rules: the Facebook unwrap pattern above. Its visible part has no t.co or bit.ly redirect entries. Licence not checked. Use it as a reference and write a small rule of our own.
- googlenewsdecoder and its ports (Python, Node): make network requests to Google (above). Not suitable under these rules.
- Clean Links (snippet): unwraps Facebook links by sending the user's browser to the destination. It navigates rather than fetching, so it is not a model for LinkPeek. Not checked.

### Gaps

- t.co status codes and behaviour: no X developer documentation was found.
- bit.ly: 301 versus client-side redirect unresolved; the support page was not opened; the "+" preview is unconfirmed.
- Whether Facebook's l.php still wraps every outbound link in 2026 (snippets only).
- Mail and newsletter wrappers (Outlook safe links, Mailchimp, SendGrid, Substack) not researched.
- Click counting by shorteners and by Facebook is inference.

## Redirects to a different article, and soft redirects

### Takeaway

A link can land on another article, a section or front page, a login page, or a "not found" page that returns 200. The reader currently summarises whatever it lands on and says nothing when the host stays the same. Show a note when the path changed, and don't judge the headline against a different story.

### Cited findings

- Soft 404 (Google Search Central blog, 2008; snippet): a soft 404 is a non-404 response, usually 200, for a page that does not exist, and Google discourages it. The troubleshooting page says to return 404 for pages that no longer exist (snippet). https://developers.google.com/search/blog/2008/08/farewell-to-soft-404s
- Link rot (Pew Research Center, May 2024; snippets, data to October 2023): about one in four pages that existed between 2013 and 2023 are no longer accessible; 38% of 2013 pages; 23% of news pages contain at least one broken link. https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/ (the report appeared in search results; not opened)
- The code: assess.ts line 88 works out whether the final path differs from the requested one and uses it to hide the description on login walls. No note is shown for a same-host change (view-model.ts line 87).
- Readability and metascraper do not handle redirects. metascraper uses the URL only to resolve relative links (fetched README).
- Meta refresh and JavaScript redirects are not followed, because the fetch follows HTTP redirects only and the reader runs no scripts (D25). Such a page is read as it is. How often this happens was not checked.

### Signals

- Final path differs from the requested path on the same host (already computed in assess.ts).
- Final path is "/" or a section page ("/news/", "/latest/") while the requested path had a long slug or a date.
- The canonical link (html.ts reads it) points to a different path from the final URL. This is ambiguous, because sites use canonical links for many things.
- A meta refresh with a URL, or a page whose only text says "redirecting".
- A soft 404: a title or heading such as "page not found", "we can't find", or "no longer available", on a short page with status 200.

### Inferences

1. Same host, different article: keep reading the landing page, but show "This link opens a different page on <host>: <landing title>." Don't run the headline check on it, because the verdict would judge a story the user did not click.
2. Landing page is a front page or section page: show "This link opens the site's front page, not an article." Front-page text is not article text.
3. Soft 404: show "The site shows an error page at this address." Needs new wording, since the current 404 message says the site said the page isn't available. An error page must never be summarised as an article. assess.ts already refuses error descriptions.
4. Meta refresh: treat as a redirect page. Either follow it once with the same no-cookie fetch under the same host rules, or show "This page redirects somewhere else." Owner's choice. Volume is probably low, but not measured.
5. Canonical: don't switch to the canonical address. Use it only to add a note when it points to another article. Canonical links are hints, and following them would change the article identity without the user asking.

### Rules and law

- No cookies sent, no bypass. Nothing in consent law applies unless the redirect page sets cookies, which the fetch ignores.

### Open-source tools

- None of the libraries handles redirects or soft 404s. Readability's README does not mention them. metascraper uses the URL for relative links only.

### Gaps

- How common soft 404s and redirects to other articles are. No measure found.
- Whether Google's current guidance matches the 2008 post (snippets only).
- Canonical handling and meta refresh prevalence.

## Consent and cookie walls

### Takeaway

Most consent banners sit on top of the article rather than hiding it, so reading what the page already contains usually works. The harder case is a cookie wall that withholds the text until a choice is made. The safe default is to read what is there, say that a consent request is showing, and never click it. Clicking "reject all" is a real choice the owner must make. Clicking "accept" should be ruled out.

### Cited findings

Frequency and compliance

- Web Almanac 2025, privacy chapter (fetched; published 15 January 2026, updated 16 January 2026): gives no overall share of sites with a consent banner, and calls consent dialogs "a near-universal feature of the modern web" without a figure. It measures IAB framework adoption at about 5.5% to 6% of sites (the chapter's two numbers differ), TCF at 4.0% and TCFv2 at 3.8%, and says 1.7% of sites are fully TCFv2 compliant. Its crawler is US-based, and banners are not required for non-EU visitors, so EU-facing figures are probably understated. https://almanac.httparchive.org/en/2025/privacy
- Nouwens et al., CHI 2020 (arXiv abstract, fetched): the five most popular consent platforms on 680 UK top-10,000 sites: "only 11.8% meet the minimal requirements that we set based on European law." The abstract does not name the five platforms. The data is from 2019 to 2020. https://arxiv.org/abs/2001.02479

Law (EU)

- EDPB Guidelines 05/2020 on consent, version 1.1 (fetched from the PDF):
  - Para 7: "the GDPR conditions for obtaining valid consent are applicable in situations falling within the scope of the e-Privacy Directive."
  - Para 8 quotes Article 4(11): "any freely given, specific, informed and unambiguous indication of the data subject's wishes by which he or she, by a statement or by a clear affirmative action, signifies agreement to the processing of personal data relating to him or her."
  - Para 39: "access to services and functionalities must not be made conditional on the consent of a user to the storing of information, or gaining of access to information already stored, in the terminal equipment of a user (so called cookie walls)."
  - Example 6a, paras 40 and 41: a script blocks content until the user clicks "Accept cookies"; "This does not constitute valid consent".
  - Para 36: the burden of proof for Article 7(4) is on the controller.
  https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf
- Article 5(3) of Directive 2002/58/EC: text not checked (EUR-Lex returned an empty page). The place to check is https://eur-lex.europa.eu/eli/dir/2002/58/oj/eng.
- GDPR Article 7(3) and recital 32: text not checked (EUR-Lex returned empty). The EDPB quotes recital 32 in para 43, on granularity (fetched).
- Planet49, C-673/17 (CJEU, 1 October 2019): not checked. The operative text could not be retrieved (EUR-Lex and CURIA). The place to check is https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62017CJ0673.
- France's CNIL, decision dated 31 December 2021 and announced 6 January 2022: fined Google €150m (€90m to Google LLC, €60m to Google Ireland) and Facebook €60m, because refusing cookies took more steps than accepting (CNBC and DLA Piper reports; snippets). The CNIL release itself was not found. https://www.cnbc.com/2022/01/06/google-hit-with-150-million-euro-french-fine-for-cookie-breaches.html
- EU Digital Omnibus (a proposal, not in force): secondary reports say the Council's draft reported for 2 October 2026 keeps consent in Article 5(3) and drops the browser-signal provision (Article 88b). Parliament has not adopted a position. The EDPB and EDPS reportedly backed browser signals in February 2026 (EDPB-EDPS Joint Opinion 2/2026, snippet). The status after mid-October was not confirmed. https://ppc.land/eu-council-drops-cookie-signal-after-google-lobbying-eur-40-50-bn-at-stake/

Law (UK)

- PECR regulation 6, as substituted by the Data (Use and Access) Act 2025 (legislation.gov.uk, fetched; the text came back as a tool summary): "Subject to Schedule A1, a person must not store information, or gain access to information stored, in the terminal equipment of a subscriber or user." Regulation 6(2)(a) says storing or accessing includes "instigating the storage or access." https://www.legislation.gov.uk/uksi/2003/2426/regulation/6
- Schedule A1 (fetched, summarised): para 2, consent after clear information, which can be given by changing browser controls (para 2(3)(a)); para 3, transmission; para 4, strictly necessary for a service the user requested; para 5, statistics (sole purpose, improving the service, clear information, a simple and free way to object, and no objection); para 6, appearance and functionality (the same objection conditions); para 7, emergency. https://www.legislation.gov.uk/uksi/2003/2426/schedule/A1
- ICO exceptions page (fetched): lists the five exceptions, requires "a simple means of objecting, free of charge" for analytics and appearance, says strictly necessary is judged from the user's perspective, and says that you "must not solely rely on browser settings as an indication of whether a person does not object." https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- ICO's older cookies page (fetched; it says it is based on the previous version): "users should have the means to enable or disable non-essential cookies, and you should make this easy to do." https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
- The ICO's final storage and access guidance (reported as finalised 29 April 2026): refusing should be as easy as accepting, and PECR penalties rise to the UK GDPR scale (secondary; not checked on the ICO site).

The fetch itself

- Fetch Standard (fetched, section 2.2.5): "omit" means "Excludes credentials from this request, and causes any credentials sent back in the response to be ignored." Section 2 defines credentials to include HTTP cookies. So LinkPeek's fetch does not store cookies. https://fetch.spec.whatwg.org/
- MDN (fetched): the default is "same-origin", which "Only send[s] and include[s] credentials for same-origin requests." https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials

Consent tools

- Consent-O-Matic (MIT licence, fetched LICENSE): the README says it "currently works with more than 200 CMPs," applies choices made at installation, and "We do not recommend installing from source." Reports sent from its icon go to a site hosted by Aarhus University. The CHI 2022 paper (Nouwens, Bagge, Kristensen and Klokmose; search result, not opened) describes answering pop-ups from user preferences. Its fallback order was not confirmed. https://github.com/cavi-au/Consent-O-Matic
- autoconsent (DuckDuckGo; MPLv2 per its GitHub page): handles opt-in and opt-out per CMP "without requiring user-input." It runs in a Chrome extension content script with background configuration. The rules ship inside the library (imported as rules.json in its example), so they are not fetched remotely. The default choice, and what happens when no opt-out exists, were not confirmed; the raw README returned 404. https://github.com/duckduckgo/autoconsent
- Chrome Web Store policy for Manifest V3 (snippet from developer.chrome.com, "Improve extension security"): all logic must be in the package, and remotely hosted code is not allowed. Any CMP rules must ship inside the extension. https://developer.chrome.com/docs/extensions/develop/migrate/improve-security

Signals for detection (not verified except where marked)

- Known consent-platform containers (OneTrust, Cookiebot, Didomi, Sourcepoint, Quantcast, TrustArc): element names from general knowledge, not checked. Consent-O-Matic and autoconsent carry rules for these.
- The IAB TCF API (__tcfapi): general knowledge, not checked.
- A full-screen overlay with role="dialog" or aria-modal, and locked page scroll: general knowledge.
- Banner wording such as "accept all", "reject all", "manage cookies": general knowledge.
- Many banners are iframes served by the consent vendor (general knowledge; not checked).

### Inferences

The project has not chosen between these options. This is what each one means.

A. Detect and disclose. When a consent request is found and it hides or blocks the text, the card says so: "This page is asking for cookie consent. LinkPeek didn't answer it." The reader still reads whatever text the page contains.
- The user's choice: untouched.
- The device: no clicks and no writes. Detection must come from the DOM. LinkPeek must not read document.cookie or the page's storage.
- The law: LinkPeek's fetch stores and reads nothing on the device (Fetch Standard, "omit"). Reading the DOM is not access to stored information. The writes that matter under PECR regulation 6 and Article 5(3) come from the site's own scripts, which run whatever LinkPeek does.
- Recommendation: yes, as the default.

B. Leave the banner alone. No click and no special message beyond the normal failure. If the text is missing, the card says the page gave no readable text.
- The user's choice: untouched. The card explains less.
- Recommendation: yes, combined with A as the fallback.

C. Click "reject all" for the user.
- The user's choice: overridden without the user deciding. Even a privacy-favouring choice is one the user did not make, and the site's record of it stays on the device.
- The device: the site writes its refusal record. If the click happens in the user's own page, the record lands in the user's real browser storage.
- The law: a refusal is not consent, so Article 4(11) does not apply in the same way (EDPB para 8). But the record is storage on the device. Under PECR regulation 6(2)(a), "instigating the storage" could bring an extension that causes it into scope. I could not check whether a refusal record is exempt under Article 5(3) or Schedule A1. The ICO's view that browser settings can't be relied on for objection points the same way. This needs legal review.
- Library: autoconsent or Consent-O-Matic. Their fallback behaviour is unconfirmed.
- Recommendation: not by default. If the owner wants it, make it a per-site opt-in with plain wording, after legal review.

D. Click "accept" for the user.
- The user's choice: consent the user never gave, recorded in their browser. The EDPB's example 6a says a forced "Accept cookies" is not valid consent (paras 40 and 41). The GDPR requires "a clear affirmative action" by the data subject (para 8).
- The law: the clearest conflict with the texts above.
- Recommendation: never. It also breaks the owner's no-bypass rule in spirit, although a consent click is not a listed bypass.

Cookie walls (a choice needed before any text shows): the reader cannot read these without a choice. The failure message should say "The site needs a cookie choice before showing the text." The wall is the site's problem; the EDPB says such a wall does not give valid consent (para 39).

Rules: no cookies sent, no bypass, and page text is data. The owner's no-bypass rule names paywalls, logins and CAPTCHAs. A consent click is not one of those, but treat it as the same kind of act.

### Open-source tools

- Consent-O-Matic: MIT. Automates choices on more than 200 CMPs. Relevant only to option C, and its fallback is unconfirmed.
- autoconsent: MPLv2 (file-level copyleft; general knowledge). Automates opt-out and opt-in per CMP. Rules are bundled. Built for extensions and headless browsers. Relevant only to option C.
- Neither is a detection-only library. Neither was run here.

### Gaps

- The EU text of Article 5(3), Article 7(3), recital 32 and Planet49: not checked.
- The CNIL primary decision: not found.
- The ICO's final guidance text and its refusal wording: secondary only.
- The default behaviour and fallback order of both consent tools.
- The "scrolling is not consent" point (para 86 of version 1.1): secondary only, from law-firm snippets. Pages 18 and 19 were not read.
- The share of sites with a cookie wall or with text hidden until a choice: not found.
- Detection signals: general knowledge, untested.

## Text that loads late

### Takeaway

Late text almost always means JavaScript builds the article after the page loads. The reader runs no scripts, so it sees only the first HTML. Keep the "needs a browser tab" failure. Don't run the page's code in a hidden frame, and don't scroll the page.

### Cited findings

- Readability (fetched source): removes script and noscript nodes in parse(), after first unwrapping noscript images. So images inside noscript survive, but noscript text does not. Its README does not address lazy loading. https://raw.githubusercontent.com/mozilla/readability/main/Readability.js
- The repo flags client-rendered pages from small text with script tags, an empty app root, or a noscript that asks for JavaScript (diagnose.ts looksJsRendered). YouTube hit this in the live check (docs/compat/part-04-live.md).
- metascraper README (fetched): it expects accurate HTML, and for JavaScript pages it recommends rendering with a headless browser through a separate package. The extension cannot do that.
- Frequency of client-rendered articles and infinite scroll: no source found.

### Signals

- Small body text with script tags and an empty root (#root, #app, #__next), or a noscript that asks for JavaScript (existing).
- Infinite scroll: a "load more" control or paging parameters, with only the first batch present. Frequency not measured.
- Lazy-loaded images: harmless for text.
- Text inside template elements: not read (general knowledge; not checked).

### Inferences

1. Lazy-loaded images: no action.
2. Noscript text that holds the article: Readability drops it. Reading noscript only when the main body is empty would recover some text. The risk is that noscript often holds login or consent prompts. Owner's choice, low priority.
3. Infinite scroll: read what is there, label the card "The first part of the page", and never simulate scrolling.
4. Client-rendered pages: keep the existing "needs a browser tab" message.
5. Don't render pages in a hidden tab or iframe. The page's scripts would run, load third-party trackers, can trigger consent and bot checks, and can write to device storage. Under PECR regulation 6 and Article 5(3), those writes need a basis the user has not given. Out of scope.

### Rules and law

- Running the page's scripts is what breaks the rules. Reading the HTML does not.

### Open-source tools

- Readability: runs no scripts, does not handle lazy loading (its README is silent), and removes script and noscript nodes.
- metascraper: metadata only; it needs rendered HTML for JavaScript pages.
- No open-source library renders pages safely inside the extension. Headless browsers such as Playwright or Puppeteer are server-side tools, and LinkPeek has no server for reading pages (D24).

### Gaps

- Frequency of client-rendered articles and infinite scroll: not found.
- Declarative shadow DOM: see the iframes and web components section.

## PDFs

### Takeaway

LinkPeek reads the first 15 pages of a PDF with pdf.js. The gap is PDFs sent with a generic type, which the code treats as unsupported. Detect a PDF from its own header, keep the 15-page limit, and say when a PDF has no readable text.

### Cited findings

- pdf.js: Apache License 2.0 (fetched LICENSE). https://raw.githubusercontent.com/mozilla/pdf.js/master/LICENSE
- The repo runs pdf.js in the offscreen document with font loading and XFA forms switched off, reads 15 pages at most and stops at 10 MB (D24, D25). Part 04 tests cover full, partial and scanned PDFs (docs/progress.md).
- Code: a PDF is detected by application/pdf, or by an empty type plus a .pdf address (fetcher.ts line 68). Other non-text types are unsupported (diagnose.ts contentKind). Test coverage in retrieve-parts.test.ts covers text/html, application/pdf, image/png, application/zip and an empty type only.
- Frequency of PDF links: no source found.

### Signals

- content-type application/pdf (reliable).
- content-type application/octet-stream or a missing type, with a .pdf address, or a file that starts with "%PDF-" (the PDF header; general knowledge, not checked against the PDF specification).
- A file over 10 MB: too large (existing).
- No text layer (a scan): pdf.js returns no text (general knowledge; not checked).
- Encrypted files: pdf.js raises a password error (general knowledge; not checked).

### Inferences

1. Treat an octet-stream or typeless response as a PDF when its bytes start with "%PDF-". This is a bug fix, not a policy choice, since many servers send PDFs as octet-stream.
2. Keep the first 15 pages, with the existing label: "Only the first pages of this PDF were read."
3. No text: "This PDF has no text LinkPeek can read. It may be a scan." Don't add OCR, which is heavy and out of scope.
4. Encrypted: "This PDF is password-protected." Never try passwords.
5. Other file types: unsupported (existing).

### Rules and law

- No cookies. PDFs are data. Nothing specific in consent law.

### Open-source tools

- pdf.js: reads the text layer. Whether it performs OCR was not checked; general knowledge says it does not.

### Gaps

- How often PDFs arrive as octet-stream.
- How this build of pdf.js handles scanned and encrypted files (not tested here).

## Pages that are not articles

### Takeaway

The classifier decides which links get an icon. The reader decides what it reads. A product, video, social, listing or front-page link should say what it is and show the page's own description, instead of reading the page as if it were a story.

### Cited findings

- The repo stores og:type but does not use it to classify pages, because it is "too vague to sort on" (facts.ts line 44). Schema.org type is used only for the article kind.
- Live check: the Hacker News thread was read as text, and the card showed its first comment. The YouTube page showed its description (docs/compat/part-04-live.md).
- Google's paywall guidance uses NewsArticle as its example (fetched). Google's full article-type list was not fetched.
- Frequency of non-article links: no source found.

### Signals

- Structured type: Article, NewsArticle, BlogPosting or Report suggest an article. Product, VideoObject, SocialMediaPosting, Event, JobPosting, ItemList or WebPage suggest something else (general knowledge; not checked against Google's list).
- og:type values such as video.other, product, profile and website (general knowledge).
- Addresses: /watch, /status/, /dp/, /listings/, /jobs/, or a bare front page.

### Inferences

- Video (YouTube, Vimeo): "This is a video page. Here is its description." Official oEmbed endpoints exist for YouTube and X (general knowledge; not checked). They return a title and author without running page scripts. Owner's decision, because they send the link to the platform.
- Social posts (X, Instagram, LinkedIn, Threads): these usually produce a login or a robot check, so use that failure when it applies. Otherwise: "This is a social post. Open it to read it." Don't scrape logged-out pages (the sites' terms were not checked).
- Listings and products: "This is a product page. Here is its description." Show the description only.
- Front pages: "This is the site's front page, not an article."
- Discussions (forums, Hacker News): "This is a discussion page. The text shown is the first comment." Part 13 of the plan covers this.
- For all of these, use the page's own description (og:description or the meta description), limited to the preview length, and label it as the page's description.

### Rules and law

- No new rules. Using official public endpoints is a decision, not a rule break.

### Open-source tools

- metascraper: extracts description, title, publisher and date. Its README lists site bundles for YouTube, X, Reddit and Amazon, and says the hosted API handles paywalls and bot detection. Whether the bundles are in the open-source package was not checked.

### Gaps

- The share of links that are not articles: not measured.
- Google's full article-type list and the schema types used for listings.

## Bot checks

### Takeaway

A bot check should end the attempt with a plain message. LinkPeek must not solve it, retry it, change its identity, or route round it. The body markers in the repo cover the main vendors. Add Cloudflare's response header as well, because it doesn't depend on reading the body.

### Cited findings

- Cloudflare (fetched): challenge responses carry "the cf-mitigated header present and set to challenge" on every challenge-page type, and their content type is text/html. The page gives no status codes. https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/
- Cloudflare docs pull request 34007 (snippet; status unclear): says browsers hide cf-mitigated from scripts on cross-origin requests unless it is exposed through Access-Control-Expose-Headers. Whether the extension's fetch can read it was not checked. https://github.com/cloudflare/cloudflare-docs/pull/34007
- DataDome (secondary, weak): an x-datadome response header and a datadome cookie; scripts and frames from captcha-delivery.com; a block page titled "You have been blocked" (GitHub issue snippet). https://github.com/omnideck-dev/omnideck/issues/240 A 403 alone is not evidence (secondary).
- PerimeterX / HUMAN (weak): _px cookies, a px-captcha element or meta tag, and "Press & Hold" text. The sources are bypass-vendor pages and a scraping wiki, not HUMAN's own documentation. https://publish.obsidian.md/twsc-public/Web+Scraping/Wiki/entities/perimeterx Header claims are contested.
- Google's "unusual traffic" robot check was reached by the live check (docs/compat/part-04-live.md).
- Repo markers (diagnose.ts): Cloudflare (cf_chl, cdn-cgi/challenge), DataDome, PerimeterX (px-captcha), Imperva (_Incapsula_Resource, incap_ses_) and Akamai (bot manager). These are not checked against the vendors' own documentation.
- Repo title patterns: "Just a moment...", "Attention Required!", "Verifying your device" (the Times, live check).
- RFC 6585 (429) and Retry-After: not checked.

### Signals

- Strong: the cf-mitigated: challenge header (Cloudflare).
- Body markers and title patterns (existing).
- Status codes: 403 and 503 are common. No source confirms the codes per vendor.
- A reCAPTCHA or hCaptcha widget on an otherwise readable page is not a block. The existing rule counts it only when the text is short.

### Inferences

1. Keep the message "The site asked for a human check." Don't retry, don't open the page in a tab to pass it, don't change the user agent or headers, don't route through other addresses, and don't use solving services. This follows the owner's rules on CAPTCHAs and stealth.
2. Add a cf-mitigated header check. It is cheap, needs no extra request, and doesn't depend on body size. Before relying on it, test whether the extension's fetch can read the header on cross-origin responses.
3. DataDome and PerimeterX: keep the body markers. Add header or cookie checks only after confirming the signals against the vendors' documentation.
4. No library helps here, and no bot-check library is appropriate for this project.

### Rules and law

- Owner rules: no CAPTCHA bypass and no stealth or bot-check evasion. Chrome's host-permission rule (fetched) lets the extension reach other servers, but it does not make a site's bot rules optional.
- Google's user-triggered fetchers ignore robots.txt (see the robots section). Robot checks are a separate matter from robots.txt.

### Open-source tools

- None suitable. Solving and evasion libraries are out of scope.

### Gaps

- DataDome, HUMAN, Akamai and Imperva signals: secondary or unverified.
- Frequency on news sites: not found.
- Whether the extension can read cf-mitigated cross-origin: not checked.
- Retry-After and 429 rules: not checked here. The existing code never retries 429.

## Login walls

### Takeaway

A login wall means the article is only for signed-in readers. LinkPeek sends no cookies, so it sees the login page. Say so and stop. The existing checks (a redirect to a login path, a password field on a short page, and a login title) fit this case.

### Cited findings

- Live check: the old Reddit site redirected to /login/ and then answered 403 (docs/compat/part-04-live.md). The code now classifies the redirect first (assess.ts lines 76 to 81).
- Repo: redirectedToLogin and looksLikeLoginWall (diagnose.ts).
- Frequency: no source found.

### Signals

- A 401 status, or a redirect to a path containing login, signin, sso or session/new.
- A password input on a page with under 150 words.
- A title containing "log in", "sign in", "sign up" or "create an account" on a page with under 60 words.
- Text such as "sign in to continue" (general knowledge).

### Inferences

- Keep the failure message "The site asks you to log in." Show no preview and no description from the login page. The code already does this.
- Don't offer sign-in, don't use saved logins, and don't send cookies to see the article.
- A login wall on a page that also looks like a paywall is treated as a login wall, following the existing order.

### Rules and law

- Owner rule: no logins, no cookies and no login details sent to sites.
- Law: nothing specific beyond the device-storage points already met by the no-cookie fetch.

### Open-source tools

- None needed. Reader libraries do not handle logins.

### Gaps

- How common login walls are on article links.
- Sites that show login walls only after a number of visits.

## Paywalls

### Takeaway

A publisher that marks an article isAccessibleForFree: false is saying it is not free. LinkPeek reads that mark and shows only the public description, even when the text is in the HTML. Keep that rule. Don't use feeds, AMP copies or archives for paywalled articles.

### Cited findings

- Google (fetched): isAccessibleForFree set to false "to specify that this section is behind a paywall". Paywalled sections are marked with WebPageElement and cssSelector. Publishers should "choose a paywall implementation that doesn't supply the paywalled content to the browser." https://developers.google.com/search/docs/appearance/structured-data/paywalled-content
- Repo: isAccessibleForFree is read from JSON-LD and nested parts (html.ts lines 290 to 296). The Times was classed as a paywall in the live check and showed only its description (docs/compat/part-04-live.md).
- Reuters Institute Digital News Report 2026 (fetched): "the percentage of people paying for news stayed roughly the same at 17% (compared to 18% in 2025)" across the 20-country pay basket. The UK figure is "10% of people say they pay for news." This measures readers who pay, not the share of articles behind a wall. https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary
- Share of articles behind paywalls per site: no source found.

### Signals

- isAccessibleForFree false (the strongest signal; existing).
- hasPart with WebPageElement and cssSelector.
- Text patterns on short pages, such as "subscribe to continue reading" or "already a subscriber" (existing PAYWALL_TEXT).
- HTTP 402 (existing).
- A paywall element on the page (existing hasPaywallElement).

### Inferences

1. Keep it as it is: the publisher's description only, when the mark is false or a short page has paywall text. The reason is the publisher's own line, and Google's guidance that paywalled content must be told apart from cloaking.
2. Keep the headline check away from paywalled body text. It should use only the title and description.
3. Feeds: use a publisher's feed for a free article when the page is free and the feed item is the same article. Never use it for a paywalled article, even when the feed carries full text.
4. AMP: the same rule as feeds.
5. Archives: no, for the owner's no-bypass rule and because they are third-party copies.
6. Free but login-required: treat as a login wall (above).

### Rules and law

- Owner rule: no paywall bypass. Google's guidance treats the paywall mark as the publisher's signal to honour.
- Law: nothing specific to paywalls in the texts checked.

### Open-source tools

- metascraper: its README says the hosted API handles paywalls. The library itself does not detect them (fetched).
- Readability: no paywall detection.
- No open-source library detects paywalls reliably. Not checked further.

### Gaps

- The share of articles behind paywalls, and the share of publishers using isAccessibleForFree.
- Google's flexible-sampling rules: linked from the page, not read.
- Whether common feeds carry full text for paywalled articles.

## Error pages, rate limits, geo-blocks and dead links

### Takeaway

Dead links are the most common failure a link reader will meet, judging by Pew's figures. LinkPeek already gives plain messages. Add a specific message for HTTP 451, detect soft 404s, keep 429 unretried, and don't use archives or proxies.

### Cited findings

- Pew Research Center, May 2024 (snippets; data to October 2023): about a quarter of pages that existed between 2013 and 2023 are no longer accessible; 38% of 2013 pages and 8% of 2023 pages; 23% of news pages contain at least one broken link. https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/
- RFC 7725 (fetched): status 451 means the server "is denying access to the resource as a consequence of a legal demand." A blocking server "SHOULD" include a Link header identifying itself. https://www.rfc-editor.org/rfc/rfc7725
- Google (snippets): a soft 404 is a non-404 response for a missing page, which Google discourages. Missing pages should return 404. https://developers.google.com/search/blog/2008/08/farewell-to-soft-404s
- Repo: 451 maps to http-4xx (diagnose.ts failureFromStatus), with the message "The site said the page isn't available." (messages.ts). 429 is never retried (D24; fetcher.ts).
- Geo-blocks: no published measure found. RFC 7725 covers legal demands only, so most geo-blocks are an ordinary 403 or a page (general knowledge).
- Retry-After (RFC 9110 and RFC 6585): not checked.

### Signals

- 404 and 410: the page is gone.
- 451, with a Link header that names the blocking entity.
- 429, with Retry-After.
- 5xx, including 503 for maintenance.
- Soft 404: a 200 response whose title or heading says the page is not found, on a short page.

### Inferences

1. 404 and 410: keep the existing message. A separate "removed" wording for 410 is optional and the owner's call.
2. Soft 404: "The site shows an error page at this address." An error page must never be summarised as an article.
3. 451: "The site says it can't show this page for legal reasons." Name the blocking host only if the Link header names it. Don't try to get round it.
4. Geo-block without 451: the generic message. Don't use a VPN or a proxy.
5. 429: the existing message, no retry. 5xx: the existing message, no retry (the code retries only network and timeout errors).
6. Archives for dead links: no automatic fallback. If the owner wants one, offer a link the user clicks, labelled as a third-party copy. Automatic use sends the link to another company, which the user did not ask for.

### Rules and law

- No cookies, no referrer, no bypass. An archive link that is fetched automatically is a third-party request.

### Open-source tools

- None relevant.

### Gaps

- The frequency of 451 and geo-blocks, and typical Retry-After values.
- How reliable soft-404 detection is (not tested).
- Google's current soft-404 page (snippets only).

## Text in iframes and web components

### Takeaway

The reader sees only the main HTML document. Text inside an iframe sits in another document, and text inside a web component that JavaScript draws is not in the HTML at all. Detect these cases and say so. Don't fetch frames under a different rule from links.

### Cited findings

- Readability README (fetched): iframes, lazy loading and shadow DOM are not addressed. Its only iframe mention is about accessing a same-origin document.
- Repo: no iframe or shadow DOM handling in the reader (grep).
- MDN (fetched): by default, credentials are sent only with same-origin requests.
- Consent banners are often iframes served by the consent vendor (general knowledge; not checked).
- Declarative shadow DOM: whether DOMParser builds it was not checked.

### Signals

- An iframe whose source is on another host, with substantial size, where the article body is empty.
- Custom elements (tag names with a hyphen) with no text, or a template with shadowrootmode.

### Inferences

1. A same-site iframe that holds the article: allowed under the same-site fetch rule, and labelled. Owner's choice; low priority.
2. A cross-site iframe: "The article is in an embedded frame from another site. LinkPeek doesn't read embedded frames." Don't fetch it without the normal access permission for that host (D24).
3. Web components drawn by script: the existing client-rendered failure.
4. Declarative shadow DOM: test before claiming support.

### Rules and law

- A fetch of a third party's frame is a request to that third party, so the permission rule for other sites applies. Frames that carry consent banners should not be fetched.

### Open-source tools

- Readability: does not traverse iframes or shadow roots (README).
- metascraper: takes an HTML string; frames are not mentioned.

### Gaps

- The share of articles with text in frames or shadow DOM: not measured.
- Declarative shadow DOM behaviour in DOMParser: not tested.

## Other failure types found

Pagination

- Many publishers split long articles across pages, and the reader reads only page 1. Likely signals are "Page 1 of 4" text, rel="next" or ?page= paths (general knowledge; not checked). Label the card: "This article has more pages. LinkPeek read the first." Following page 2 would add requests, which is the owner's choice. Not researched further.

Robots.txt

- Google says its user-triggered fetchers "generally ignore robots.txt rules" because "the fetch was requested by a user" (fetched). LinkPeek's fetch is user-triggered. The options are to ignore robots.txt, as Google's user-triggered fetchers do, or to honour Disallow rules for the path, which is more conservative and blocks some readable pages. The legal position in the UK and EU was not checked. Whichever is chosen, say so in the permission and privacy text.

Consent text inside the article

- Readability's unlikely-candidate list (fetched) includes "gdpr" and "banner" but not "cookie" or "consent". Its visibility check reads inline styles only, so a banner hidden by a stylesheet stays in the tree. A cookie notice inside the main content element could therefore be read as text and chosen as the opening sentence. This is an inference, not tested. A fixture page would settle it.

Size

- Over 3 MB of HTML is "too large" (repo; D24). Long reference pages pass. Wikipedia, at 6,624 words, was read in the live check.

Content types

- Video, audio, images and archives are unsupported (existing). Downloads with Content-Disposition: attachment were not checked.

Redirect loops

- A loop or too many redirects makes fetch fail. The code maps that to "network" (fetcher.ts catch). Acceptable, though the message is vague (general knowledge).

Age-verification walls

- Some UK and other sites require age checks under online-safety laws (general knowledge). Not researched. These will probably look like login walls, so the owner should decide the wording.

## Libraries: what each really does

| Tool | Licence (checked) | What it really does | Fit for LinkPeek |
|---|---|---|---|
| Mozilla Readability | Apache-2.0 (fetched) | Takes a DOM Document and returns article text. Removes script and noscript nodes. Does not fetch, run scripts, follow iframes or shadow roots, or handle lazy loading. Default charThreshold 500 (LinkPeek uses 400). Class-name filter includes "gdpr" and "banner", not "cookie" or "consent". Visibility check uses inline styles only. README warns that isProbablyReaderable gives false positives and negatives. | Already used. Add cookie and consent test pages. |
| metascraper | MIT (fetched) | Extracts metadata (author, date, description, image, logo, publisher, title, url, video, audio) from HTML and a URL. Does not fetch. Optional Readability and Defuddle connectors. Site bundles (YouTube, X, Reddit, Amazon and others). Paywall and bot handling are in the hosted API, per the README. The maintainers' benchmark (about 95.5%) is self-reported. | Could supply metadata. No paywall, bot or redirect logic. |
| pdf.js | Apache-2.0 (fetched LICENSE) | Reads the PDF text layer in a browser. LinkPeek turns off font loading and XFA (D25). OCR not included (general knowledge; not checked). | Already used. |
| Consent-O-Matic | MIT (fetched LICENSE) | Automates choices on more than 200 CMPs, using the choices made at install. Reports go to Aarhus University. Fallback order not confirmed. | Only relevant to option C. Reference only. |
| autoconsent (DuckDuckGo) | MPLv2 (GitHub page) | Library for extensions and headless browsers. Opt-in or opt-out per CMP, with rules bundled. Default and fallback not confirmed. | Only relevant to option C. |
| googlenewsdecoder and ports | Not checked | Make network requests to Google's batchexecute endpoint. | Not recommended. |
| ClearURLs rules | Not checked | Rule database. Facebook l.php unwrap. No visible t.co or bit.ly redirects. | Reference for a small rule of our own. |

## Decisions for the owner

1. Consent walls. Recommended: detect and disclose, and otherwise leave the banner alone (options A and B). "Reject all" (option C) only as a per-site opt-in with plain wording, and only after legal review of PECR regulation 6(2)(a) and Article 5(3). "Accept" (option D) never.
2. Shortener links (t.co, bit.ly, unknown wrappers). Recommended: say "This is a short link. Open it to see where it goes." The alternative is to follow the redirect after the user allows the shortener's host. That means changing the privacy text and counts as a click for the link owner.
3. Facebook-style wrappers. Recommended: unwrap on the device, with no request. Needs approval of the rule and a test.
4. Google News links. Recommended: a plain message, and no calls to Google's internal endpoints.
5. A link that lands on another article on the same site. Recommended: show a note, and don't run the headline check on that page.
6. Paywalled articles. Keep the rule: the publisher's description only, with no feeds, AMP or archives for them. Decide whether free articles may use the publisher's feed or AMP copy. Recommended: yes, only when the page itself is free and the content is the same article.
7. Archives (Wayback Machine, archive.today). Recommended: never automatic. A link the user clicks is your call.
8. Bot checks. Keep the plain human-check message, with no solving, retrying or identity changes. Recommended: add the cf-mitigated header check, after a test.
9. Login walls. Keep as they are.
10. Robots.txt. Decide whether LinkPeek honours it. Google's user-triggered fetchers ignore it. Either way, say so in the permission and privacy text.
11. Official oEmbed endpoints (YouTube, X) for video and social previews. Decide whether to use them, since they send the link to the platform.
12. Non-article pages. Recommended: label them and show the page's description. No scraping of logged-out social pages.
13. Rendering pages in a hidden tab or iframe. Recommended: no.
14. Wording for 451, soft 404 and 410. Your call on the text.
15. Engineering fixes (not policy): treat PDFs sent as application/octet-stream as PDFs; add a test for cookie-notice text in the opening sentence; add the same-host redirect note; add a 451 message.
16. Privacy copy: update it whenever LinkPeek contacts a host other than the article's own host.

The three most common failures, and the handling I recommend for each:
- Dead links and soft 404s: a plain message that the page isn't there, and no archive fallback. Pew's figures are the basis.
- Consent banners: read what is there, say that a consent request is showing, never click "accept", and offer "reject all" only as an opt-in after legal review. The basis is the Web Almanac figures, the Nouwens study and the EDPB guidance.
- Paywalls and login walls: publisher's description only for paid articles, a plain login message, and no feeds, AMP copies or archives for paid articles. The basis is Google's paywall markup and the Reuters figures.

## What I could not confirm

- The EU text of Article 5(3), Article 7(3), recital 32, and the Planet49 ruling (EUR-Lex and CURIA returned empty pages).
- The CNIL's own decision text (press reports only).
- Digital Omnibus status after mid-October 2026 (reports conflict).
- The default behaviour and fallback order of Consent-O-Matic and autoconsent.
- t.co and Bitly redirect behaviour.
- DataDome and PerimeterX signals (secondary or weak sources).
- How often each failure occurs on news sites, for wrappers, redirects, bot checks, login walls, per-site paywalls, 451, geo-blocks, PDFs, iframes and client-rendered text. No source found for most of these.
- Whether consent-banner text reaches the opening sentence (needs a test page).
