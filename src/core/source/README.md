# source

The source card's facts (Part 08): what a page says about itself, with where each fact came from. "Not stated" for what's missing; no score.

| File | Job |
|---|---|
| `facts.ts` | Builds the source facts from what the reader found (publisher, dates, author, type, primary sources) |
| `article-type.ts` | News, opinion, analysis, sponsored, press release or other, from labels, structured data or address, only when clear |
| `primary.ts` | Counts links to government sites, courts, research papers and PDFs. A count, not a judgement |
| `corrections.ts` | Looks for a corrections page at usual addresses, when the user asks |

Read `docs/decisions.md` D46 to D51 for the rules. The reader side is `src/core/extract/html.ts`; the card is `src/content/card.ts`.
