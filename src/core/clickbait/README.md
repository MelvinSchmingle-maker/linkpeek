# clickbait

The headline check (Part 07): tick, cross or neutral, with one reason. Pure TypeScript, no browser APIs, no AI.

| File | Job |
|---|---|
| `rules.ts` | Stage 1: patterns in the headline's wording alone, each strong, medium or weak |
| `content.ts` | Stage 2 input: the study limits an article states and its money and percentage figures, as labels and numbers |
| `check.ts` | Combines both stages into a verdict, a reason, and (only with a cross and the full article) a rewrite |

Read `docs/decisions.md` D40 to D45 for the rules and why they're the way they are. `docs/eval/part-07.md` has the measured precision and recall, with the held-out set reported separately. Tests are next to each file (`*.test.ts`).
