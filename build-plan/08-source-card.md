# Part 08. Source card

## Goal
A small "About this source" section in the expanded card. It shows facts we can actually point to, and says plainly what we don't know. No trust score.

## Build
- `src/core/source/` collects, from the page and metadata already retrieved in Part 04:
  - publisher name (`og:site_name`, JSON-LD `publisher`, or hostname)
  - published date and last updated date
  - article type: news, opinion, analysis, sponsored, press release, other (from JSON-LD `@type`, URL paths like `/opinion/`, "Sponsored" or "Paid content" labels). Unknown if unclear.
  - author, if stated
  - whether the article links to primary sources (links to `.gov`, court documents, journal DOIs, PDFs of reports) with a count
  - whether the site has a findable corrections or ethics page (check common paths only on user request, cached per domain)
- Each field carries its evidence: where it came from ("from the page's structured data", "from the URL"). Unknown is shown as "Not stated", never as a negative.
- Show it in the card behind "About this source". Collapsed by default. One line per field.
- A visible note: "This shows what the page discloses. It isn't a rating of accuracy."
- Leave clearly marked stubs (hidden from users) for later fields: ownership, independent coverage of the same claim.

## Don't
- No trust or credibility score.
- Never infer dishonesty from missing information.
- Never let partner or payment status touch these fields.

## Done when
- Unit tests for each field across fixture pages with and without metadata.
- Sponsored and opinion detection tested on fixtures.
- The live script from Part 04 is extended to record source fields for its 10 URLs.

## Your check
Open the source card on five sites you know well. Is anything wrong or misleading? Wrong facts here hurt trust more than missing ones.
