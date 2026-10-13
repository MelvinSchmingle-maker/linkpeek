# LinkPeek build plan

The full LinkPeek brief, cut into 14 small parts. Each part is a separate prompt you can paste into a fresh Claude Code session. Each one is sized to finish (built and tested) in one sitting.

## How to use it

1. Start a session in the LinkPeek project folder.
2. Paste this, changing the part number:

   > Read `build-plan/00-ground-rules.md` and `build-plan/03-link-detection-and-modes.md`. Build that part. Follow the ground rules. Stop when the "Done when" list passes and report back using the "Report back" section.

3. Before moving on, read the report and do the "Your check" step at the bottom of that part.
4. Only go to the next part when the current one works.

`00-ground-rules.md` goes with every part. It holds the rules that apply everywhere: no fake features, the 20-word limit, privacy, security and commercial independence. That way each part prompt stays short and nothing important gets lost.

## The parts

| # | Part | What you get at the end | Needs money or accounts? |
|---|------|------------------------|-------------------------|
| 00 | Ground rules | Not a build step. Attach it to every part. | No |
| 01 | Project setup | An empty extension that loads in Chrome, with tests and a build that pass | No |
| 02 | Inline button and card (fake data) | The tiny icon and summary card working on a test page, every state visible | No |
| 03 | Link detection and modes | The icon appears on the right links only, with Smart, Scan and Manual modes | No |
| 04 | Fetching and reading articles | Real article text pulled from real pages, with honest failure messages | No |
| 05 | The 20-word summary engine | Word counting, the hard limit and a summary that works with no AI at all | No |
| 06 | Real AI summaries | A small backend that calls an AI model safely | Yes: AI API key and hosting |
| 07 | Clickbait tick, cross or neutral | Headline checks with short explanations | No (AI optional) |
| 08 | Source card | Publisher, dates, article type, with the evidence for each | No |
| 09 | Feedback buttons | Thumbs up/down with reasons, kept on the device | No |
| 10 | Real-world testing | The 20-scenario test matrix, filled in with real results | No |
| 11 | Link protector | Lookalike domains, mismatched links, redirects | Maybe: threat-check service |
| 12 | Annoyance filter and reading mode | Optional pop-up and sticky-box hiding, per-site controls | No |
| 13 | Social adapters | Reddit first, then YouTube captions, then others one at a time | Maybe: API access |
| 14 | Measurement and money | Opt-in analytics, referral tracking, pricing tests | Yes, later |

## Order and stopping points

Parts 01 to 05 are the core. Once they're done you have a working extension that summarises real articles with no AI bill. That is the first good place to stop and try it yourself for a week.

Part 06 is the first one that costs money. Read its "Before you start" section before pasting it.

Parts 07 to 10 make it worth showing to other people. Part 10 matters most because it is where you find out what actually works.

Parts 11 to 14 are optional extras. Build them only once people are using the core and asking for more.

## Why this order

- The interface comes first, on fake data, so you can see and judge it early. Changing a design is cheap before real data is wired in.
- Retrieval (part 04) comes before AI (part 06). An AI summary of the wrong text is worse than no summary. Most of the risk is in "can we read the article at all", not in the AI.
- Clickbait checks come after retrieval because the most useful check ("does the article back up the headline?") needs the article text.
- Money comes last on purpose. The brief says LinkPeek has to earn trust before it earns revenue.
