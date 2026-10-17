# Privacy

## What leaves your device today

**By default, nothing goes to LinkPeek or any third party.** LinkPeek's own server is only used if you choose "LinkPeek's AI" for summaries in Settings (see below).

When you open a card for a link, LinkPeek fetches that one page from the website the link points to, the same page your browser would load if you clicked it. That website sees a request from your browser (your IP address and browser type), like a normal visit, but:

- without your cookies, logins or saved passwords, so it doesn't know who you are unless it can tell from your IP address;
- without telling it which page you were on (no referrer);
- only for the link you opened a card for. LinkPeek never fetches links in the background or ahead of time.

The page is read on your device and the result stays on your device. Nothing is sent onward.

If you press **Look for a corrections page** in a card's "About this source", LinkPeek asks that site for up to six usual addresses, such as `/corrections` and `/editorial-standards`. It does this only when you press the button, only where LinkPeek already has access to the site, and with the same rules as above: no cookies, no referrer. The result for each site is remembered for 24 hours in session storage, which Chrome clears when it closes.

Summaries are made on your computer. By default LinkPeek picks a sentence from the article itself. If you switch on "Let Chrome's built-in AI write summaries" in Settings, Chrome's own on-device model writes them instead: the article text goes to that model on your computer and nowhere else. Chrome downloads the model from Google once, when you press the download button; that download is between Chrome and Google, and LinkPeek sends nothing with it.

### If you choose "LinkPeek's AI" for summaries

Then, for each card on a full article, LinkPeek sends LinkPeek's server:
- the article's text (the first 6,000 characters)
- the link's text
- how much of the article was read ("full")
- the page's language
- a random install ID

The server passes the text to Anthropic, whose Claude model writes the summary, under Anthropic's API terms. LinkPeek never sends:
- the page's address
- your cookies, logins or browsing history
- anything about you

The server doesn't store the text and logs only counts and timings. The server's host, Vercel, also sees your IP address, as any website you visit does. LinkPeek uses it only to count requests for the rate limit (a count lasts 10 minutes at most) and doesn't log it. The install ID is 128 random bits made on your device, used only to limit how many summaries one install can ask for, replaced every 30 days and deleted when you switch AI summaries off. Paywalled and partial pages are never sent. Switching back to either free option stops all of this at once.

A link to the page you're already on is read from that page in your browser, not fetched again. That copy can include what you see while logged in. It is read on your device and goes nowhere else.

## What's stored on your device

| What | Where | Why |
|---|---|---|
| Settings (mode, demo toggle, hostnames of sites you turned off) | `chrome.storage.local` | Remember your choices. A site you turn off stays listed (hostname only, e.g. `news.example.com`) until you turn it back on, so LinkPeek stays off there. |
| "Turn on" note (hostname and time) | `chrome.storage.local` | Lets LinkPeek finish turning a site on if the popup closes while Chrome asks for access. Deleted once used, or ignored and deleted after 2 minutes. |
| Results for links you opened a card for (address, what was read, the opening sentence or preview, the summary of 20 words or fewer, and a few facts for the headline check: which study limits the article states, and its money and percentage figures; never its words) | `chrome.storage.session` | So opening the same link again doesn't fetch it again. Memory only: Chrome clears it when the browser closes. At most 60 results, each kept at most 24 hours. Not written to disk. |
| Install ID (random, only if you choose "LinkPeek's AI") | `chrome.storage.local` | Lets LinkPeek's server limit requests per install. 128 random bits, replaced every 30 days, deleted when you switch AI summaries off. |
| Annoyance tool choices (per tool, global and per site; no URLs) | `chrome.storage.local` | Remember the switches for the annoyance tools. Nothing sent. |
| Sites where a warning was turned off ("Don't warn me on this site"; a hostname, e.g. `paypa1.com`) | `chrome.storage.local` | So the warning for that site stays off. Remove it in Settings. |
| Corrections-page results (the site's address and whether a page was found, only for sites you asked about) | `chrome.storage.session` | So asking about the same site again doesn't repeat the requests. Memory only, kept at most 24 hours. Not written to disk. |
| Feedback votes: thumbs up/down on summaries (with an optional reason for a thumbs-down), and "Disagree with this rating?" on headline checks | `chrome.storage.local` | Find out which summaries help and which headline checks are wrong. Keeps the website's hostname (e.g. `news.example.com`), never the full address, the result's id or any article text. One vote per result and kind, at most 500 kept. Delete all removes them. |

## Rules for every future change

- No page text is sent anywhere unless you've asked for a feature that needs it, and this file will say exactly what is sent, when, and to whom.
- No cookies, logins or session tokens are ever sent to any outside service.
- No browsing history is kept.
- Anything new stored on the device is listed in the table above.

## Sending feedback to a server: not built

Nothing sends feedback anywhere. A setting (`shareFeedback`) exists in the code so the switch has somewhere to live, but it is off, not shown on the options page, and does nothing yet (`src/core/feedback/upload.ts`). Part 14 decides whether feedback is ever sent.

If it were ever turned on, the data sent would be each vote's hostname, the kind of vote (summary thumbs, headline "disagree"), the reason given, the evidence level, the summary provider, the word count, the headline verdict the user disagreed with, the demo flag and the time. It would not include the page's full address, the result's id, the summary text, the article text or anything from the user's cookies or logins. Nothing would be linked to an account, because there isn't one. Each install would have the random install ID described above, and only if the user had chosen to share.

## Exports

"Export feedback as a file" in the options page saves the same fields, as a JSON file, to a place you choose. It leaves out the result id. The file is yours; LinkPeek never uploads it.

## The link check

Stage 1 of the link check (Part 11) works only from the link's address and its text, on this computer. It sends nothing anywhere, and it needs no access to the site.

**"Check where this link goes"** is the one thing in the link check that makes a request, and only when you press the button on a card. LinkPeek then asks the link's own site where the address ends up:

- Only for a site you have already given LinkPeek access to. Without that access the request isn't sent, and the card says LinkPeek needs your permission.
- It's a normal page request, made without cookies, without a referrer, with the body not read. The site you asked about, and any sites it redirects to, see that request, the same as if you had opened the link.
- Nothing about it goes to LinkPeek's own server, or to anyone else.
- Chrome doesn't show an extension each redirect along the way, so only the final address comes back.

**Stage 2** (a threat lookup) isn't built, and sends nothing. Its options are compared in `docs/security-services.md`.

## Reading mode and the annoyance tools

- **Annoyance tools:** every change they make happens on the page, in the browser. Nothing is sent. Their switches are kept on the device, as the table above says.
- **Reading mode ("Read here"):** pressing it reads the article again, from the site, the same way opening a card does, without cookies. The article's paragraphs go to LinkPeek's own panel on the page and nowhere else. They aren't kept: the cache has no article text, and closing the panel forgets it.
- **Nothing is sent** to LinkPeek's server or anyone else for any of these.

