# Privacy

## What leaves your device today

**By default, nothing goes to LinkPeek or any third party.** LinkPeek's own server is only used if you choose "LinkPeek's AI" for summaries in Settings, or when you run a Story Search (both below).

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

### If you run a Story Search

Only when you right-click a link and choose **LinkPeek – Story Search**. The first time, the card shows exactly what will be sent, each item with where it came from, and nothing is sent until you press **Search**. After that, searches start straight away; Settings can make it ask again.

LinkPeek reads what the page says about that one link, on your computer, and sends LinkPeek's server:
- the link's address, without anything after "?" or "#" (those parts can carry tokens)
- the link's headline and any other wording of it found nearby (the article card's heading, the page's structured data about that link)
- the article card's short description, and up to 600 characters of text around the link
- the words in the link's address, and a date, publisher, author, section and keywords if the page gave them
- text you had selected when you right-clicked, if you had
- the page's language
- a random install ID, used only for rate limits

Email addresses and phone numbers are removed from all of that first. LinkPeek never sends:
- the address of the page you're on
- your cookies, logins or browsing history
- anything you've typed into the page, form fields or editable areas, or hidden text
- the whole page

LinkPeek's server turns these into search queries and sends the queries to a web search service (Exa, or Tavily when Exa can't answer), which sees the queries but not you. It then sends what was sent plus the search results to Anthropic, whose Claude model compares them and writes the report, under Anthropic's API terms. The link itself is never opened, by your browser or by the server.

The server doesn't log what you searched for: one line per request with the outcome, timings, counts and estimated cost. It keeps the finished report (not your request, and not the search service's raw results) in its own memory for 10 minutes to 6 hours, so someone else asking about the same link gets it without a second search. Vercel sees your IP address, as for summaries, and it's used only for the rate limit. The Story Search install ID is separate from the summaries one: 128 random bits, replaced every 30 days, deleted when you switch Story Search off in Settings.

A link to the page you're already on is read from that page in your browser, not fetched again. That copy can include what you see while logged in. It is read on your device and goes nowhere else.

## What's stored on your device

| What | Where | Why |
|---|---|---|
| Settings (mode, demo toggle, hostnames of sites you turned off) | `chrome.storage.local` | Remember your choices. A site you turn off stays listed (hostname only, e.g. `news.example.com`) until you turn it back on, so LinkPeek stays off there. |
| "Turn on" note (hostname and time) | `chrome.storage.local` | Lets LinkPeek finish turning a site on if the popup closes while Chrome asks for access. Deleted once used, or ignored and deleted after 2 minutes. |
| Results for links you opened a card for (address, what was read, the opening sentence or preview, the summary of 20 words or fewer, and a few facts for the headline check: which study limits the article states, and its money and percentage figures; never its words) | `chrome.storage.session` | So opening the same link again doesn't fetch it again. Memory only: Chrome clears it when the browser closes. At most 60 results, each kept at most 24 hours. Not written to disk. |
| Install ID (random, only if you choose "LinkPeek's AI") | `chrome.storage.local` | Lets LinkPeek's server limit requests per install. 128 random bits, replaced every 30 days, deleted when you switch AI summaries off. |
| Corrections-page results (the site's address and whether a page was found, only for sites you asked about) | `chrome.storage.session` | So asking about the same site again doesn't repeat the requests. Memory only, kept at most 24 hours. Not written to disk. |
| Story Search reports (the report, its sources' titles and addresses; the key is a hash, not the address) | `chrome.storage.session` | So asking about the same link again soon doesn't search again. Memory only, cleared when Chrome closes. At most 20, each kept 30 minutes. A report the AI couldn't write isn't kept. Deleted when you switch Story Search off. |
| Story Search install ID (random) | `chrome.storage.local` | Lets LinkPeek's server limit Story Searches per install. 128 random bits, made on the first search, replaced every 30 days, deleted when you switch Story Search off. |
| "You've seen what Story Search sends" (yes or no) | `chrome.storage.local` | So the confirmation shows only until you've agreed once. Settings can reset it. |
| Feedback votes (thumbs up/down) | `chrome.storage.local` | Find out which summaries help. Keeps the website's hostname (e.g. `news.example.com`), never the full address or any article text. One vote per result, at most 500 kept. |

## Rules for every future change

- No page text is sent anywhere unless you've asked for a feature that needs it, and this file will say exactly what is sent, when, and to whom.
- No cookies, logins or session tokens are ever sent to any outside service.
- No browsing history is kept.
- Anything new stored on the device is listed in the table above.
