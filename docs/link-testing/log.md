# Link test log

The team's record of link test runs. Each run from the tester adds an entry
here by hand: copy the entry from `results/log.md` in the tester's folder, and
add what you saw and what you think caused it. Newest at the bottom.

How to read an entry: see `what-to-look-for.md` in this folder.

---

## 17 Oct 2026, smoke test (Claude, cloud machine, bundled Chromium)

Purpose: check that the tester runs, and that the wrapper branch works. Not a
measure of real-world success: the sample list is ten hand-picked addresses.

Sample list (`tools/link-tester/links.txt`), 11 addresses, 7 read in full.

| Link | Outcome | Reason | Notes |
|---|---|---|---|
| BBC News, Russell Brand trial | works | | 927 words, opening is the first sentence |
| Guardian, feature | works | | Summary repeats the opening (short article) |
| GOV.UK press release | works | | Publisher "GOV.UK", type press-release |
| Wikipedia, Dachshund | works | | 6,624 words |
| GitHub blog | works | | |
| arXiv PDF, Attention Is All You Need | works | | **Opening is the licence note** ("Provided proper attribution is provided, Google hereby grants permission..."), not the abstract. Known bug. |
| The Times | partial | paywall | Opening is the teaser, shown to everyone. Expected. |
| old.reddit.com, r/UKPersonalFinance | fails | login-wall | Redirected to old.reddit.com/login. Expected. |
| YouTube, dQw4w9WgXcQ | fails | bot-challenge | **New.** The Part 04 live check read this page as a preview on 17 Oct. From this cloud address, YouTube sent the browser to google.com/sorry. Likely the cloud IP, not the page. |
| Mirror, Bedford train crash | works | | Opening is "Seconds after a terrifying train crash...", so the timestamp fix (D29) still holds. |
| The Verge, JPMorgan AI agents | partial | paywall | Known false flag (todo section 3). The page is free. Its structured data says it's paid, so LinkPeek shows only the teaser. |

Wrapper branch, one probe: `l.facebook.com/l.php?u=...` with a made-up `h`
token. LinkPeek was sent to `facebook.com/login` (a login wall). The address
inside `u` (BBC) read in full. **Caveat:** the `h` token was invented, so
this doesn't prove what a real post link does. It supports the idea that
social wrappers send LinkPeek to a login or interstitial page, and the
decoded column shows the difference. The first real post links will test it.

Next steps:
- Run the tester on real links from the Facebook post, the Instagram, Reddit
  and X posts where the trouble started, with `--headed`, on the owner's own
  machine.
- Fill in `your check` for each link.
- Record whether the wrapper, the decoded address, or both are the failure.
