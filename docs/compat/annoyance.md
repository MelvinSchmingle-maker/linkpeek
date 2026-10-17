# Annoyance tools: real-site check (Part 12)

Run on 2026-10-17, with every tool on, from a cloud machine through its proxy. Made by `node scripts/build.mjs --live && node scripts/annoyance-live.mjs`.

This is an automated measure, not a test, and not a judgement of whether a site still works. A site can lose something that matters and still show these numbers. A person needs to browse each site with the tools on before any tool is recommended for everyone.

| Page | What changed | Labels added | Visible text kept | Still scrolls | Elements hidden | Login or consent hidden |
|---|---|---|---|---|---|---|
| [BBC News article](https://www.bbc.co.uk/news/articles/c3qjn45pepx1o) | page script didn't start | – | – | – | – | not measured |
| [Guardian news (US)](https://www.theguardian.com/us-news/2026/oct/17/alligator-attack-florida-fisher-killed) | stickyBars 1 | 0 | 100% | yes | 1 | none |
| [Mirror news](https://www.mirror.co.uk/news/uk-news/bedford-train-crash-hero-eli-37775689) | stickyBars 3 | 0 | 100% | yes | 3 | none |
| [Al Jazeera news](https://www.aljazeera.com/news/2026/10/17/france-wave-of-nationwide-protests) | nothing | 0 | 100% | yes | 0 | none |
| [Ars Technica news](https://arstechnica.com/ai/2026/10/youtube-music-begins-labeling-ai-songs/) | nothing | 0 | 100% | yes | 0 | none |
| [The Verge news](https://www.theverge.com/ai-artificial-intelligence/1010962/jpmorgan-chase-is-keeping-ai-agents-out) | nothing | 0 | 100% | yes | 0 | none |
| [NPR news quiz](https://www.npr.org/2026/10/16/g-s1-148041/pope-leo-musk-mamdani-trump-guilfoyle-news-quiz) | nothing | 0 | 204% | yes | 0 | none |
| [GOV.UK press release](https://www.gov.uk/government/news/new-action-to-crackdown-on-bogus-self-employment-loopholes) | nothing | 0 | 100% | yes | 0 | none |
| [Wikipedia article](https://en.wikipedia.org/wiki/Dachshund) | nothing | 0 | 100% | yes | 0 | none |
| [CNN photo gallery](https://www.cnn.com/2026/10/08/world/gallery/photos-this-week-october-1-october-8) | page script didn't start | – | – | – | – | not measured |

What the columns mean:

- **Visible text kept** is the page's visible text after the tools ran, as a share of the text before. Under 100% means something was hidden or removed from view. A drop on a news page is worth looking at, because it may be an overlay that covered the article rather than an ad.
- A figure **over 100%** means the page loaded more text between the two readings (lazy loading, or a feed), not that LinkPeek added any.
- **Still scrolls** is whether the page can still be scrolled after the tools ran.
- **Login or consent hidden** must read "none". The tools are built never to hide a password form or a cookie notice, so any row that says otherwise is a bug, not a result.

Reading mode is in the table as a setting, but it isn't measured here: it works in LinkPeek's own panel, and the panel only opens when someone presses "Read here".

## Breakage

Not measured here: whether a site still works for a reader. Until someone has browsed these ten sites with the tools on, the notes above are the only breakage record.

What was hidden, from the samples the run recorded (a person still needs to look):

- **Mirror:** three elements. Two are named like ad gutters on either side of the article (going by their class names, not by looking). The third is a sticky element that hasn't been identified.
- **Guardian (US):** one element (`dcr-1acu569`), a sticky block. Not identified: it may be the site's header, which would matter.
- **BBC and CNN:** the page script didn't start within 12 seconds, so nothing was measured there. Not a clean result.
