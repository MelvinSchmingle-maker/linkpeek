# Privacy

## What leaves your device today

**By default, nothing goes to LinkPeek or any third party.** LinkPeek's own server is only used if you choose "LinkPeek's AI" for summaries in Settings (see below).

When you open a card for a link, LinkPeek fetches that one page from the website the link points to, the same page your browser would load if you clicked it. That website sees a request from your browser (your IP address and browser type), like a normal visit, but:

- without your cookies, logins or saved passwords, so it doesn't know who you are unless it can tell from your IP address;
- without telling it which page you were on (no referrer);
- only for the link you opened a card for. LinkPeek never fetches links in the background or ahead of time.

The page is read on your device and the result stays on your device. Nothing is sent onward.

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

The server doesn't store the text and logs only counts and timings. The install ID is 128 random bits made on your device, used only to limit how many summaries one install can ask for, replaced every 30 days and deleted when you switch AI summaries off. Paywalled and partial pages are never sent. Switching back to either free option stops all of this at once.

A link to the page you're already on is read from that page in your browser, not fetched again. That copy can include what you see while logged in. It is read on your device and goes nowhere else.

## What's stored on your device

| What | Where | Why |
|---|---|---|
| Settings (mode, demo toggle, hostnames of sites you turned off) | `chrome.storage.local` | Remember your choices. A site you turn off stays listed (hostname only, e.g. `news.example.com`) until you turn it back on, so LinkPeek stays off there. |
| "Turn on" note (hostname and time) | `chrome.storage.local` | Lets LinkPeek finish turning a site on if the popup closes while Chrome asks for access. Deleted once used, or ignored and deleted after 2 minutes. |
| Results for links you opened a card for (address, what was read, the opening sentence or preview, and the summary of 20 words or fewer) | `chrome.storage.session` | So opening the same link again doesn't fetch it again. Memory only: Chrome clears it when the browser closes. At most 60 results, each kept at most 24 hours. Not written to disk. |
| Install ID (random, only if you choose "LinkPeek's AI") | `chrome.storage.local` | Lets LinkPeek's server limit requests per install. 128 random bits, replaced every 30 days, deleted when you switch AI summaries off. |
| Feedback votes (thumbs up/down) | `chrome.storage.local` | Find out which summaries help. Keeps the website's hostname (e.g. `news.example.com`), never the full address or any article text. One vote per result, at most 500 kept. |

## Rules for every future change

- No page text is sent anywhere unless you've asked for a feature that needs it, and this file will say exactly what is sent, when, and to whom.
- No cookies, logins or session tokens are ever sent to any outside service.
- No browsing history is kept.
- Anything new stored on the device is listed in the table above.
