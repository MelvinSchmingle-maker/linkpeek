# Compatibility summary (Part 10)

Counts come from the live runs on 17 Oct 2026: the 19 pages in `docs/compat/part-04-live.md`, plus three new pages from the four extra runs (X, the Guardian's UK news page and the Standard's front page; the fourth, Wikipedia, was already in the table). That's **22 unique pages**. Fixture scenarios aren't counted here: they're tests, and they pass or fail on every run.

| Measure | Result | Notes |
|---|---|---|
| Share that came back `full` | **13 of 22 (59%)** | Full: 12 from the table, plus the Guardian UK page |
| Share that came back `partial` | 5 of 22 | YouTube, the Times, NPR, The Verge, the Standard front page |
| Share `unavailable` | 4 of 22 | Reddit (login), X (403), Daily Mail (refused the headless browser), CNN (no article text) |
| Share with the correct state | **20 of 22 (91%)** | Wrong: NPR (a free quiz labelled "behind a subscription") and the Guardian UK page (a listing read as an article). The Verge is counted as correct: its page says it isn't free, so LinkPeek follows D27. That's debatable |
| Length compliance | Every summary shown is 20 words or fewer | Checked against the summary column of the live table |
| Summaries judged accurate by reading | Most, not all | Ars's opening looks like a pull quote; arXiv's opening is the licence note. These were judged by reading only |

## The top failure reasons (22 pages)

| Reason | Count | Pages |
|---|---|---|
| Behind a subscription (`paywall`) | 3 | The Times (correct), NPR (wrong), The Verge (publisher's flag) |
| Needs a browser tab (`js-rendered-empty`) | 2 | YouTube, the Standard front page |
| Asked for a human check (`bot-challenge`) | 1 | Daily Mail (the headless browser's 403, not the page) |
| Site refused the request (`http-403`) | 1 | X |
| Couldn't find the article text (`extraction-failed`) | 1 | CNN photo gallery |
| Login page (`login-wall`) | 1 | Reddit |

The last three each have one case, so they tie. The top reason, `paywall`, has one wrong case out of three.

## What this says about readiness

- **Ready to show people, for news articles:** the full-article path works on the news articles tried, with the Mirror's opening fixed. Two problems remain that a reader would notice: listing pages read as articles, and a free page labelled as paid (NPR). Both are in `open-issues.md`.
- **Not ready, for:** YouTube (captions aren't read, and the fetch conflicts with YouTube's policies), Reddit, and X.
- **Not measured yet:** how many links on real pages get an icon. The detection rules are tested on fixtures, not on live pages.

This is a snapshot from one day, from one cloud machine, through a proxy. A home connection gets different answers from some sites, so a person's check is still the test that counts.
