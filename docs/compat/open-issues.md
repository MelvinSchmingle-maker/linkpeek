# Open issues (Part 10)

Found by the matrix runs (`docs/compat/matrix.md`) and the work in this part. Each one says whether it's a bug to fix, or a decision for the owner. Bugs inside Parts 01 to 09 that are small get a fix and a test; the rest is listed here, as the plan asks.

## Bugs (not yet fixed)

1. **Listing pages are read as articles.** The Guardian's UK news page (headline page) comes back `full`, with a tweet as its opening. Recognising a listing needs a change in extraction, which is bigger than a small fix. Matrix row 2.
2. **Ars's opening looks like a pull quote, and arXiv's opening is the licence note.** The opening rule (D29) skips some lines but not these. Matrix rows 1 and 5.
3. **No "No transcript available" message on YouTube.** The plan asks for it. Not built, and the YouTube question below comes first. Matrix row 11.
4. **The 200%-zoom layout.** The new link-check line and the "Read here" button are tested on demo cards, which keep the card within the test's height. Real cards with long reasons or summaries haven't been tested at 200%. Found while building Part 11.
5. **A start-up race in the test helper.** One browser test (`on-demand.spec.ts`) and the live check failed, once each, with `chrome.storage` undefined when a helper talked to the service worker. Both passed on re-run. The cause isn't found.

## Decisions for the owner

6. **YouTube.** LinkPeek fetches YouTube pages in the background for a link's card. YouTube's developer policies prohibit scraping (`docs/adapters/youtube.md`, section III.E.6), so this conflicts with the rules. Proposed: stop fetching youtube.com, and read only the page the user has open.
7. **NPR is shown as behind a subscription.** `[id*="piano"]` matches NPR's own Piano script and empty slots, on every page. A narrower match would also change how real paywalls are found. Options are in `todo.md`, section 3.
8. **The Verge.** Its page says `isAccessibleForFree: false` but reads freely in a normal browser. LinkPeek follows the publisher's flag (D27). Should a flag count on a page that reads freely?
9. **robots.txt.** LinkPeek doesn't read robots.txt. talkSPORT disallows all agents not listed. Owner decision: honour it for each user-triggered read, or not.
10. **Threat lookup (Part 11, stage 2).** Not built. The comparison is in `docs/security-services.md`. Google Safe Browsing isn't allowed for commercial use without an agreement; Web Risk's prices weren't verified; URLhaus is free for non-commercial use. A choice and a budget are needed.
11. **Reddit and X.** Not built. The terms couldn't be read for Reddit, and X's API page returned an error. Both need the owner's go-ahead after the terms are read (`docs/adapters/`).
12. **Redirect checks can't show each hop.** Chrome doesn't show an extension each redirect, and Chrome sets its own limit on redirects. The plan asked for both. The card says only the final address is known (D54).

## Limits of the checks, not bugs

- The live check runs headless Chromium, which some sites refuse (Daily Mail, CNN). Those results are this machine's, not necessarily a reader's.
- Judgements of summary accuracy were made by reading the output. A person who knows each story should check them.
- The labelled sets for the headline check and the link check were written by the same people as the rules. They're a first check, not proof.
