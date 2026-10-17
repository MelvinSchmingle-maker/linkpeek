# Part 04 live check

Made by `node scripts/build.mjs --live && node scripts/live-check.mjs`, which
runs LinkPeek's real reading code on real pages and rewrites the table below.

This is a snapshot, not a test. Websites change, and the run came from a cloud
machine (a data-centre address, through a proxy), which some sites treat with
more suspicion than a home connection.

<!-- live-check:start -->
Run on 2026-10-17. **7 of 10** pages came back `full`.

| Page | Expected | Evidence | Reason | Read by | Words | Opening or preview | Summary (words) | Publisher | Published | Article type | Author | Primary-source links | Time |
|---|---|---|---|---|---|---|---|---|
| [BBC News article](https://www.bbc.co.uk/news/articles/c3qjn45pepx1o) | full | full |  | readability | 927 | Russell Brand was described as "ruthless" and a "sexual predator" by the prosecution at the start of his trial for rape and sexual assault o | The 51-year-old actor and comedian faces three counts of rape, three charges of sexual assault and one of indecent assault. (20) | BBC News | 2026-10-14T13:42:43.163Z | news | Helena Wilkinson, Sima Kotecha | gov 0, court 0, research 0, PDF 0 | 0.5s |
| [Guardian feature](https://www.theguardian.com/lifeandstyle/2026/oct/14/a-moment-that-changed-me-i-learned-to-read-at-42) | full | full |  | readability | 886 | In 2021, at 42 years old, I had the reading age of a four-year-old. | In 2021, at 42 years old, I had the reading age of a four-year-old. (14) | the Guardian | 2026-10-14T05:30:45.000Z | news | Ammar Kalia | gov 0, court 0, research 0, PDF 0 | 0.4s |
| [GOV.UK press release](https://www.gov.uk/government/news/new-action-to-crackdown-on-bogus-self-employment-loopholes) | full | full |  | readability | 411 | Over 900,000 people could benefit from new plans which include measures to crack down on bogus self-employment. | Over 900,000 people could benefit from new plans which include measures to crack down on bogus self-employment. (17) | GOV.UK | 2026-10-14T14:49:19+01:00 | press-release | Department for Business, Innovation, Science and Trade | gov 1, court 0, research 0, PDF 1 | 0.2s |
| [Wikipedia article](https://en.wikipedia.org/wiki/Dachshund) | full | full |  | readability | 6624 | The Dachshund, also known as the Dackel or Teckel, is a German breed of short-legged, long-bodied dog of hound type. | The Dachshund, also known as the Dackel or Teckel, is a German breed of short-legged, long-bodied dog of hound type. (20) | Wikimedia Foundation, Inc. | 2001-10-07T03:50:54Z | other | Contributors to Wikimedia projects | gov 18, court 0, research 12, PDF 8 | 0.6s |
| [GitHub blog post](https://github.blog/ai-and-ml/generative-ai/how-ai-code-generation-works/) | full | full |  | readability | 2540 | Generative AI coding tools are changing software production for enterprises. | Generative AI coding tools are changing software production for enterprises. (10) | The GitHub Blog | 2024-02-22T18:32:28+00:00 | other | Jeimy Ruiz | gov 0, court 0, research 0, PDF 0 | 0.5s |
| [arXiv paper (PDF)](https://arxiv.org/pdf/1706.03762) | full or first pages | full |  | pdf | 6472 | Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper solely for use in | Our model achieves 28.4 BLEU on the WMT 2014 English- to-German translation task, improving over the existing best results. (19) | arxiv.org |  |  |  |  | 1.2s |
| [Hacker News thread](https://news.ycombinator.com/item?id=50087328) | discussion, not an article | full |  | readability | 5975 | There's been a lot of recent swiss efforts to curtail advertising. |  | news.ycombinator.com |  |  |  | gov 0, court 0, research 0, PDF 0 | 0.8s |
| [YouTube video](https://www.youtube.com/watch?v=dQw4w9WgXcQ) | preview (needs Part 06) | partial | js-rendered-empty |  |  | The official video for “Never Gonna Give You Up” by Rick Astley. Never: The Autobiography 📚 OUT NOW! Follow this link to get your copy and  | The official video for “Never Gonna Give You Up” by Rick Astley. (12) | YouTube |  |  |  |  | 0.7s |
| [Reddit (old)](https://old.reddit.com/r/UKPersonalFinance/) | login wall | unavailable | login-wall |  |  |  |  |  |  |  |  |  | 0.5s |
| [The Times (paywall)](https://www.thetimes.com/business/companies-markets/article/arrests-fca-nca-insider-trading-nbff2hm2x) | paywall, description only | partial | paywall |  |  | Nikhil Rathi, the head of the City regulator, said the investigation came amid a rise in financial crime that was getting increasingly sophi | Nikhil Rathi, the head of the City regulator, said the investigation came amid a rise in financial crime. (18) | The Times | 2026-10-13T16:20:00.000Z | news | Ben Martin, Financial Editor |  | 1.2s |

"Opening or preview" is the first sentence of the article for a `full`
result, or the page's own description for a preview. "Summary" is what the
card shows (Part 05, extractive), with its word count. Text in this table
comes from the websites; LinkPeek only chose and cut it.

Redirects: Reddit (old) ended on https://old.reddit.com/login/.
<!-- live-check:end -->

## What the runs taught us

The first run, earlier the same day, also got 7 of 10, but three of those seven
showed the wrong opening sentence:

- BBC News splits a story into several identical text blocks with videos
  between them. Readability kept only the biggest block, so the card opened
  part-way in, on a barrister's quote. LinkPeek now looks for earlier
  paragraphs laid out exactly like the one Readability started from, inside
  the same `<article>`, and starts from the first of them
  (`findLead` in `src/core/extract/html.ts`).
- Wikipedia's infobox table came first, so the "sentence" was table cells run
  together ("DachshundOriginGermanyTraits..."). Paragraphs inside tables,
  figures, captions, asides and hidden labels no longer count, and footnote
  markers like "[note 1]" are dropped.
- GOV.UK's "Press release" label was glued to the front of the first sentence.
  The opening is now taken paragraph by paragraph, and a paragraph under six
  words is skipped.

Each one has a small fictional copy in `test-pages/articles/` (`split-blocks`,
`infobox`, `labelled`), and a fourth (`standfirst`) checks that a Guardian
style standfirst isn't mistaken for the opening.

Reddit sends this machine to a login page, which then answers 403. The first
run reported "the site refused the request". Being sent to a login page now
counts as a login wall whatever status the login page answers with.

YouTube answered normally on the first run (description shown, page needs
JavaScript). By the second run Google was sending this machine to its
"unusual traffic" robot check, after a handful of requests from the same
address. LinkPeek reported that correctly and did not try again. A person on a
home connection is unlikely to see this.

Still wrong, and left for later parts:

- The Hacker News thread comes back `full` because the comments are long
  text, so the card shows the first comment. The card's label was changed
  from "The article begins" to "The text begins", which is at least true.
  Discussion pages get their own handling in Part 13 (social adapters).
- The arXiv PDF really does open with a licence note from Google, so that is
  what the card shows. A summary (Parts 05 and 06) will need to look past it.

## 17 Oct 2026 run (with Part 05 summaries)

The table above is now from this run, with a summary column. Every summary is 20 words or fewer and is a whole sentence from the page.
- BBC News: the opening sentence ("described as "ruthless" and a "sexual predator"...") is 26 words and can't be cut without splitting "ruthless and a sexual predator". So the summary is the second paragraph, which states the charges.
- arXiv PDF: the summary is the paper's result ("Our model achieves 28.4 BLEU..."), not the licence note it opens with. It keeps a line-break hyphen ("English- to-German"), a PDF text artefact.
- Hacker News: no sentence passed, so the card shows where the text begins. Discussion pages are still Part 13.

The Times now sends this machine a 1.3 KB "Verifying Device" page from a bot-protection service instead of the article. The first run of the day reported it as "needs JavaScript", because that title wasn't on the robot-check list. It is now, together with the wording "Verifying your device", and the page is reported as a robot check. A test covers it in `src/core/retrieve/retrieve-parts.test.ts`.
