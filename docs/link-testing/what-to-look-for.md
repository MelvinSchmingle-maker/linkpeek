# What to look for in link tests

This guide is for whoever runs the link tester (`tools/link-tester/`), and for
anyone reading its results. It says what LinkPeek should do with a link, what
each result means, and what counts as a problem. It was written before the
first real run, from the code and the research in `docs/research/`, so it
will change once the results show what matters.

## 1. The link itself

Before reading any result, check what the link is.

- **Is it a wrapper?** Links copied from social posts often go through a
  redirect address on the way to the article. The tester flags these in the
  `wrapper` column.
  - Facebook: `l.facebook.com/l.php?u=...`. The real address is in `u`,
    percent-encoded. The tester reads it and reports it as the decoded address.
  - Instagram: `l.instagram.com/?u=...`. Same shape as Facebook.
  - Reddit: `out.reddit.com/...`. The address is not in the link, so the
    tester can only follow it.
  - X: `t.co/...`. Always used for links posted on X. The tester can only
    follow it.
  - Google News: `news.google.com/rss/articles/...`. The address is encoded in
    the link itself, and the decoding isn't documented, so the tester can only
    follow it.
- **Did it land somewhere else?** Compare the link's site with the `final address`
  column. A link that ends on a consent page, a login page or a robot check is
  a result to note, even if the tester read something.

**Why it matters:** if LinkPeek reads the wrapper page, and not the article
behind it, every link from that site fails in the same way. The decoded column
tells us which of the two is the cause.

## 2. The outcome

| Outcome | Meaning | Good or a problem |
|---|---|---|
| works | Read in full. | Good, if the opening and summary are right (see section 3). |
| partial | Some of the article was read. With the reason `paywall`, the text is the teaser that a paywalled page shows to everyone. | Worth checking: is the missing part a big part of the article? For a paywall, check the teaser is a real sentence from the article. |
| description only | Shown the page's own description, labelled as a preview. | Expected for paywalls, sign-in pages and pages built in the browser. A problem if the page is free and reads normally in a browser. |
| fails | Nothing usable. The reason says why. | A problem, unless the reason is an honest one such as a paywall or a login. |
| error | The test went wrong, not LinkPeek. | Report it. |
| not a web address | The line isn't a web link. | Fix links.txt. |

## 3. The reason

Each failure gives one code. This is what each code means, and what to check.

| Reason | What it means | What to check |
|---|---|---|
| bot-challenge | The site showed a robot check (for example "Verifying" or "Just a moment"). | Does the same link open in your browser without one? If not, note the site. |
| js-rendered-empty | The page builds its text in the browser, and the text wasn't there when we read it. | Does the card show the description and say so? That's the designed behaviour. |
| paywall | The page says it's for subscribers. | Does the page really need a subscription? A free page flagged as a paywall is a bug (see section 5). |
| login-wall | The page needs a sign-in. | Expected for many social sites. Note which sites show it. |
| http-403 | The site refused the request. | Often a robot block. Note it. |
| http-429 | The site asked us to slow down. | Test again later. Repeated 429s from one site are worth noting. |
| http-4xx, http-5xx | Other server errors. | Open the link in a browser. If it works there, note it. |
| timeout | The page took too long. | Note the seconds. Anything over about 15 seconds is slow. |
| network | The page couldn't be reached at all. | Check the link opens in your browser. |
| extraction-failed | The page loaded, but no article text could be found. | Often a listing page (a front page, a topic page, a search page). Check the page is an article. |
| unsupported-type | The address points to a file type LinkPeek doesn't read. | Expected for video files and images. |
| too-large | The page is bigger than LinkPeek reads. | Note the site. |
| summary-failed | A summary couldn't be written. | Note it. |
| permission-denied | The test build should never show this. | Report it. |

## 4. The text LinkPeek shows

For every `works` or `partial` result, read the `opening`, `summary` and
`words` columns. Check the first ten or so results by hand, and any that look
odd.

Things that count as a problem:

- **Not the article.** The opening is a timestamp, a date line, a caption, a
  byline, an "Advertisement" label or a menu item. (A Mirror article once opened on
  "20:13, 17 Oct 2026Updated 21:01". That's this kind of bug.)
- **A pull quote or a caption instead of the lead.** Some sites put a quote
  in a box at the top.
- **A licence or notice instead of the abstract.** Academic papers sometimes
  open on the licence.
- **Cookie or consent text.** "Before you continue", "Accept all", "We use
  cookies".
- **Cut off mid-sentence**, or a summary that repeats the headline and nothing
  else.
- **Too short for the article.** Look at `words` against the length of the
  article in your browser. A 1,500-word article read as 80 words is a problem.
- **Mixed-up pages.** The text belongs to a different article from the one
  you opened.

## 5. The source facts

The `publisher`, `published` and `article type` columns are rough rules, not
checked facts. Check them against the page.

- **Publisher:** the name of the outlet, correctly spelled. A wrong name is a
  problem.
- **Published:** the date of the article, not the date of the last update, and
  not today's date.
- **Article type:** a news report should say news. A listing page should not say
  article. Anything that looks invented is a problem.

## 6. Speed and repeat runs

- Note any link over 15 seconds.
- Run the same list again on another day, or on another network. A link that
  fails once and works the next time is a flaky result. Note it, and don't
  count it as fixed.
- A link read twice in one run comes back from LinkPeek's cache, in about
  0.0 seconds. That's expected. A decoded address that is also in the list
  shows this.

## 7. What a good run looks like

It's realistic to expect:

- news articles from the big UK and US outlets read in full, most of the time;
- Wikipedia, government and most blog articles read in full;
- paywalled and login-only pages showing a description and an honest reason;
- social sites (Reddit, X, Facebook, Instagram) showing a clear reason, not
  an empty card or a wrong opening.

A run is only useful if the `your check` column is filled in, because the
difference between your browser and the tester is the thing to study.

## 8. The log

Every run adds an entry to `results/log.md` in the tester's folder. The team
keeps the same record in `docs/link-testing/log.md` in the repository. Add
a note under each run about what you saw, and what you think caused it.
