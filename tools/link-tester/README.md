# LinkPeek link tester

This tool checks whether LinkPeek can read the articles behind a list of links,
and writes down why when it can't. It runs each link through LinkPeek's own
reading code in a test browser.

## What's in this folder

- `link-test.mjs`: the test script.
- `links.txt`: the links to test. Replace the sample list with your own.
- `extension/`: LinkPeek's test build. Use it only with this tool. It allows
  every website and never asks for permission, so don't use it as your normal
  LinkPeek.
- `WHAT-TO-LOOK-FOR.md`: what each result means and what counts as a problem.
- `results/`: created on the first run. One CSV file per run, plus `log.md`,
  which gets one entry per run.

## Setup (once)

1. Install Node.js 20 or newer from nodejs.org (choose the LTS version).
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npx playwright install chromium`. This downloads the test browser,
   which is about 150 MB.

## Run it

Say where the run happened, so the report can tell the runs apart:

    node link-test.mjs links.txt --source own-computer

`--source` is `own-computer`, `cloud` or `fixture`. To see everything you have run, use:

    node link-test.mjs --report

This writes `results/report.md`, grouped by source, with counts by outcome, by stage and by platform.

By default the tester stores no article text, and no full addresses: each address is kept as scheme, host and path, without its query string. Add `--with-text` to also store the opening sentence and the summary. Only do that when you want to check the wording.



1. Put one link per line in `links.txt`. Copy each link exactly as the post
   gives it, before you open it.
2. Run `node link-test.mjs links.txt --source own-computer`.
   Add `--headed` to watch the browser window. This helps when a site shows a
   robot check, because you can see what it shows.
3. Open the newest CSV in `results/` in Excel or Google Sheets.

## Reading the results

Each link gets one outcome:

- **works**: LinkPeek read the article in full.
- **partial**: LinkPeek read some of the article.
- **description only**: LinkPeek showed the page's own description, not the text.
- **fails**: LinkPeek could not read the page. The `reason` column says why.
- **error**: the test itself went wrong. Send us the message.
- **not a web address**: the line isn't a web link.

For a link that goes through a wrapper (Facebook, Instagram, Reddit, X, Google
News), the `wrapper` column names the site, and the `decoded` columns show how
the address inside it did, where the tester can find that address.

The `your check` column is empty on purpose. Open the same link in your own
browser, with LinkPeek installed the normal way, and type what the card showed
you. The difference between the two is what we most need to hear about.

## What to send back

Send the newest CSV, and for each failure, write what your own card showed.
That's all we need to start on fixes.

## Limits

- The test browser is Chromium, not your own Chrome profile. Sites can behave
  differently for different browsers and different home networks.
- Results are a snapshot. Websites change daily.
- A site that shows a robot check here may not show one on your computer, and
  the other way round. Both results are useful.
