# YouTube adapter: research (not built)

Checked on 17 Oct 2026 against https://developers.google.com/youtube/terms/developer-policies (last updated 15 Oct 2026, per the page).

## What the rules say

- **Scraping is prohibited.** Section III.E.6: no one may "scrape YouTube Applications or Google Applications, or obtain scraped YouTube data or content." The only exception is public search engines, and only within YouTube's robots.txt.
- **No other route to the data.** Section III.I.14: "use any technology other than YouTube API Services to access or retrieve API Data". Section III.D.7: "You must not use undocumented APIs without express permission."
- **Caching is limited.** Section III.E.1.a: no one may "download, import, backup, cache, or store copies of YouTube audiovisual content without YouTube's prior written approval". Other data may be kept for no more than 30 days, or only temporarily.
- **Transcripts** aren't covered on the page read. Captions are only reachable through the API, for the owner of the video.

## What that means for LinkPeek

- **The current behaviour conflicts with the rules.** For a YouTube link, LinkPeek's background reader fetches the watch page and reads its description. That's scraping under section III.E.6. The live check (`docs/compat/part-04-live.md`) shows this happening.
- **The plan's design can't be built as written.** A "description-based partial preview" needs the page's description. The only ways to get it are to scrape the page or to use the API. The API route needs a Google project and a quota, and it still doesn't allow transcripts for third parties.
- **Recommendation (owner decision):** stop fetching youtube.com pages in the background. Show "LinkPeek doesn't read YouTube pages from outside the page" for links to YouTube, and for the page the user has open, read only what's on it. No transcript is ever invented. A "No transcript available" note is shown when the page has no captions in view.
- **Caching:** if the description is shown at all, don't keep it past the 24-hour cache, and never keep audiovisual content.

## Not built

Nothing in the code is changed by this file. The background fetch of YouTube pages is still in place, and that's the decision for the owner.
