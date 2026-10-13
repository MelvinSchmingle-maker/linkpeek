# Part 05. The 20-word summary engine (no AI yet)

## Goal
Everything around the summary that doesn't need an AI model: the word-count rule, the hard 20-word limit, a pluggable provider slot, and a non-AI fallback so the extension works with zero running costs.

## Build
- **Word counter** in `src/core/summary/wordcount.ts`. Define the rule and write it in the file header:
  - Words are split on whitespace.
  - Hyphenated words count as one ("energy-support").
  - Numbers count as one ("£3.5bn", "2026", "12%").
  - Abbreviations count as one ("U.K.", "NHS").
  - Punctuation on its own isn't a word.
  Test every rule.
- **Limit enforcer** `enforceLimit(text, max = 20)`:
  - Under the limit: pass.
  - Over: ask the provider once to shorten it. If it's still over, trim at the last clause boundary (comma, semicolon, "and", "but") that leaves a complete sentence. Never cut mid-phrase and never add "...".
  - If neither works, return a failure. The card then shows the extract or "Summary unavailable", never an over-length summary.
- **Quality filters**: reject or rewrite summaries that start with filler ("This article discusses", "In this article", "The author explores"), or that just repeat the headline word for word.
- **Provider interface** `SummaryProvider { summarise(input): Promise<SummaryResult> }` where input carries text, headline, evidence level and URL, and output carries summary, evidence level, provider name and flags. Implementations:
  - `ExtractiveProvider` (default, free, on-device): picks the most informative sentence from the article (lead sentence plus simple scoring), then runs it through the limit enforcer. If the article is `partial`, it uses the description and the label says "Preview". If `headline-only`, it gives no summary.
  - `ChromeBuiltInProvider`: check current Chrome docs for the built-in Summarizer API (status, which Chrome versions and devices). If it's available, add it behind a feature check with fallback to extractive. If not, leave a stub with a note on why.
  - `RemoteProvider`: an interface stub only. Built in Part 06.
- The card now shows real summaries with the right evidence label.
- **Evaluation set**: `eval/articles/` with 20 saved article fixtures (licence-safe: public-domain or self-written text) and a hand-written expected summary for each. A script scores length compliance, filler phrases, and overlap with the expected summary. Results go to `docs/eval/part-05.md`.

## Don't
- No server, no paid API.
- A summary must never come from headline text alone and be labelled as an article summary.

## Done when
- Word count and enforcer tests pass, including edge cases (exactly 20, 21, all numbers, long hyphenated words, non-English text).
- 100% of eval outputs are 20 words or fewer. That is a hard test failure if not.
- End to end on the test pages: click, summary appears, correct label.

## Your check
Use it on 10 real articles for a day. Is the free extractive summary good enough? That decides how urgently Part 06 (paid AI) is needed.
