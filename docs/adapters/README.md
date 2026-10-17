# Social adapters (Part 13): research and decisions

Before any platform adapter is written, its rules are checked. Each platform has its own file here, with the same questions answered: is there an official API and what does it cost; what works without one; does it need a login; what the store and the platform's terms say; and a recommendation. The plan says a "skip" is a valid result.

## Status

| Platform | Recommendation | Built? | Why |
|---|---|---|---|
| Reddit | Skip for now. Revisit once the owner has read the terms. | No | The terms page couldn't be read from here, so no permission can be assumed. |
| YouTube | Stop fetching youtube.com pages, and read only the page the user has open. Owner decision. | No | YouTube's developer policies prohibit scraping. LinkPeek currently fetches YouTube pages in the background, which is a conflict (see youtube.md). |
| X | Skip. | No | Reading posts needs a paid API or a login, and the API's pricing page returned an error when read. |
| Facebook | Skip. | No | The content sits behind a login. Read from the page the user has open, if ever. |
| Instagram | Skip. | No | The content sits behind a login. Same as Facebook. |

## The shared hook

`src/adapters/index.ts` defines the `Adapter` interface and the registry the service worker asks before the general reader. With no adapters registered, the general reader runs for every link, as before. Nothing in the registry is a platform yet.

## What's not verified

- Reddit's terms and any API prices: not read.
- X's terms and prices: the pricing page returned an error. The statement that X is paid is based on the API's known public tiers, not on a page read today.
- Facebook and Instagram terms: not read in full. Both require login for the content the plan asks for, which is enough to skip them.
