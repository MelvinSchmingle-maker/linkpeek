# summary

Part 05: summaries of 20 words or fewer.

- `wordcount.ts`: the one word-count rule (decisions D30).
- `enforce.ts`: the 20-word limit and clause-boundary trimming (D31).
- `quality.ts`: rejects filler openers, the headline repeated back, questions and fragments.
- `provider.ts`: the `SummaryProvider` slot.
- `extractive.ts`: the free default, the article's most informative sentence (D32).
- `chrome-builtin.ts`: Chrome's on-device Summarizer API, opt-in (D34).
- `remote.ts`: stub for Part 06.
- `engine.ts`: tries the chosen provider, falls back to extractive, and re-checks whatever comes back.
- `input.ts`: what may be summarised. A partial or paywalled page gives only its public preview, never body text.

Runs in the offscreen document (`src/offscreen/offscreen.ts`), straight after an article is read.
