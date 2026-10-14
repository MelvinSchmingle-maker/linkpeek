# Privacy

## What leaves your device today

**Nothing.** LinkPeek makes no network requests to any LinkPeek server or third party. There is no LinkPeek server.

## What's stored on your device

| What | Where | Why |
|---|---|---|
| Settings (mode, demo toggle, hostnames of sites you turned off) | `chrome.storage.local` | Remember your choices. A site you turn off stays listed (hostname only, e.g. `news.example.com`) until you turn it back on, so LinkPeek stays off there. |
| Feedback votes (thumbs up/down) | `chrome.storage.local` | Find out which summaries help. Keeps the website's hostname (e.g. `news.example.com`), never the full address or any article text. One vote per result, at most 500 kept. |

## Rules for every future change

- No page text is sent anywhere unless you've asked for a feature that needs it, and this file will say exactly what is sent, when, and to whom.
- No cookies, logins or session tokens are ever sent to any outside service.
- No browsing history is kept.
- Anything new stored on the device is listed in the table above.
