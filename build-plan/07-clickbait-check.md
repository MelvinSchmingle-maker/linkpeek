# Part 07. Clickbait tick, cross or neutral

## Goal
A headline-quality check with three outcomes, each with a defined meaning and a one-line reason.

## Definitions (write these into the code and the options page)
- **Tick:** the headline states its main point, and where we have the article, the article backs up what it says.
- **Cross:** a specific clickbait or misleading pattern was found with enough evidence. The reason names the pattern.
- **Neutral:** not enough evidence, or no clear verdict. This is the default.

A cross means "this headline is written to bait a click or overstates the article". It does NOT mean the story is false. A tick does NOT mean the story is true. Say this in the expanded card.

## Build
- **Stage 1, headline-only rules** (free, on-device) in `src/core/clickbait/rules.ts`:
  - withheld main fact ("You won't believe what...", "This one thing...", "What happened next...")
  - forward references with no subject ("This is why...", "Here's how...")
  - question headlines whose answer is held back
  - artificial suspense and countdown framing
  - unsupported superlatives ("best ever", "most shocking")
  - number-bait listicles ("17 reasons...") as a weak signal only
  Each rule returns a pattern name and a confidence. Emotion or controversy alone never triggers a cross.
- **Stage 2, headline vs article** (only when evidence is `full`):
  - Does the article contain the headline's main claim?
  - Does the headline state a stronger result than the article (for example "cures" vs "may help in mice")?
  - Is the article date much older than the page presents it?
  Do this with the AI backend if Part 06 is on, otherwise with simple checks (key terms present, hedging words in the article but missing from the headline, dates).
- **Combining**: headline-only rules can give a cross only for strong withheld-fact patterns. A content mismatch cross needs `full` evidence. With no article, the most we say is "The headline appears vague. The article could not be retrieved, so the content comparison is unavailable."
- **Factual rewrite**: only when evidence is `full`. One plain headline from the article's content, 15 words max, run through the same word counter. With no article, no rewrite.
- Expanded card shows: status, one-line reason, rewrite if available, and "What does this mean?" linking to the definitions.
- **Test set** `eval/headlines.json`: at least 80 headlines labelled tick, cross or neutral, including tricky ones (emotional but honest, plain but misleading, questions that are fine). Report precision and recall for crosses. A false cross is worse than a missed one, so tune for precision.

## From the competitor research
- No product found gives a three-state verdict on a headline against its article without a server. This is the gap LinkPeek fills.
- Judge, don't replace. Never change the headline on the page. The factual rewrite stays inside the expanded card, labelled as LinkPeek's. DeArrow, which replaces titles, gets one-star reviews for replacements that are "longer" and "much worse", and one for a spoiled race result.
- A rewrite must not reveal an outcome the headline held back on purpose (a score, a result, an ending) without saying it does.
- No outside accuracy figure for this kind of check survived fact-checking, so the labelled test set is the only number we have. Report it honestly.

## Don't
- Never use popularity, publisher or partner status as an input.
- Never produce a rewrite from the headline alone.

## Done when
- Rule tests and the labelled set pass, with cross precision of at least 90% (or the real number reported honestly if not reached, with examples of the failures).
- A test proves an inaccessible article can't get a content-mismatch cross.
- A test proves rewrites never appear without `full` evidence.

## Your check
Read the false crosses in the report. Would those publishers have a fair complaint? If yes, the rules are too aggressive.
