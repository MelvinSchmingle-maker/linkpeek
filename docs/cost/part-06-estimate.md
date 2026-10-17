# Part 06 cost estimate: AI summaries

Prices are Anthropic's first-party list prices, checked 17 Oct 2026.

## Measured (17 Oct 2026)

`npm run eval:ai` on Claude Opus 5.5: **$0.0041 a summary** on average over the 20 evaluation articles, including the 3 that needed a second request to shorten them. That's 0.41 cents, under the estimate below. The catch: the evaluation articles are short (a few hundred words each), so they send far fewer tokens than a real 6,000-character article. Two real-sized requests to the deployed backend fit the estimate better:

- a 700-character article, first request in a while: 298 input tokens, 945 instruction tokens written to the cache, 39 reply tokens, about 0.7 cents
- a 380-character article with the instructions already cached: 187 input tokens, 945 cached, 351 reply tokens (most of it thinking), about 0.8 cents

So the reply length, mostly thinking, varies more than the article does. Expect 0.4 to 1.5 cents a summary on Opus 5.5 until there are real usage numbers. The fixed instructions measured 945 tokens, not the 725 guessed below.

## Which model: measured on the 20 evaluation articles (17 Oct 2026)

Same articles, same prompt, effort low, through the real extension-to-backend path. Reports: `docs/eval/part-06*.md`. Time runs from the extension asking to Claude's answer, including any second request, from a cloud machine in the US.

| Setup | Per summary | At 1,000 a day | Time, median (slowest) | Needed a second request | Notes |
|---|---|---|---|---|---|
| Opus 5.5, thinking on | $0.0043 | about $129 a month | 1.7 s (10.3 s) | 2 of 20 | Most specific details. Dropped "may" from the science story. |
| Sonnet 5.5, thinking off | $0.0021 | about $63 a month | 2.5 s (5.8 s) | 14 of 20 | Slower and no better than Haiku here. |
| **Haiku 5.5, thinking on (low effort)** | **$0.0001** | **about $3 a month** | **1.5 s (1.9 s)** | 13 of 20 | Close to Opus. Kept "may" and "small study" on the science story. |
| Haiku 5.5, thinking off | $0.0001 | about $3 a month | 1.5 s (2.5 s) | 12 of 20 | Two weak sentences, e.g. the A&E story became "the four-hour target was missed", losing that waits improved. |

The evaluation articles are short. A real 6,000-character article sends more text, so expect roughly two to three times these per-summary figures on every model; the ranking doesn't change. On Haiku 5.5 that's still around $0.25 per 1,000 summaries.

Haiku's second requests are the extension asking it to shorten a first try of 21 to 25 words. They cost almost nothing and the median time already includes them. A prompt that asks Haiku for a shorter first sentence could cut them; that needs its own evaluation.

What else was considered:
- **Sending less article text** (3,000 characters instead of 6,000) roughly halves the input cost. Untested for quality.
- **A shared cache on the server**, so a popular link is summarised once for everyone, is the biggest saving at scale. It means the server would have to know which link was summarised, which it deliberately doesn't today (D36). Not now.
- **The Batch API** halves the price but answers in minutes to hours, so it's no use for a card on hover. **Fast mode** on Opus doubles the price.
- **Other companies' models** weren't tested. At Haiku 5.5's price the model bill is no longer the main cost: even a free model would save at most about $3 to $8 a month at 1,000 summaries a day, against a new integration, new privacy wording and a new evaluation. The free options in the extension (the article's own sentence, and Chrome's on-device AI) cost nothing already.

## The estimate (made before any real request)

## What one summary uses

| Part | Tokens | Notes |
|---|---|---|
| Fixed instructions (system prompt) | about 725 | The same for every request, so it's cached: after the first request in any 5-minute stretch it's billed at the cache-read price. |
| The article | about 1,500 to 2,000 | The extension sends the first 6,000 characters. Claude's newer tokenizer can use up to about a third more tokens than the old rule of thumb of 4 characters a token. |
| The reply | about 50 to 300 | A 20-word sentence is about 30 tokens. Claude also thinks briefly before answering, and that's billed as output. Effort is set to "low" to keep it short, but how much it thinks varies. |

About one request in ten is expected to need a second, much smaller request (asking for a shorter sentence or a rewrite). That adds a few percent and is left out below.

## Cost by model

The backend defaults to **Claude Haiku 5.5**, the owner's choice after the measured comparison below (17 Oct 2026). To change it, set `SUMMARY_MODEL` on the backend. No code change is needed.

| Model | Price per million tokens (in / out) | Per summary | 100 a day | 1,000 a day | 10,000 a day |
|---|---|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | about 0.9 to 1.4 cents | about $26 to $41 a month | about $260 to $410 a month | about $2,600 to $4,100 a month |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | about 0.4 to 0.7 cents | about $13 to $20 a month | about $130 to $205 a month | about $1,300 to $2,050 a month |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10 / $0.50 | about 0.02 to 0.03 cents | about $0.65 to $1 a month | about $6.50 to $10 a month | about $65 to $100 a month |

Months are 30 days. The ranges come from the reply length, which is the least predictable part.

How it's worked out, for Opus 5.5 at the top of the range: 1,850 article tokens at $4 per million is $0.0074; 725 cached instruction tokens at $0.20 per million is $0.00015; 300 reply tokens at $20 per million is $0.006. Total: about $0.0136 a summary.

Things that would change the numbers:
- **Traffic in bursts** means more cache misses: the instructions are billed at the cache-write price (1.25 times input) after a quiet 5 minutes. On Opus 5.5 that's about a third of a cent extra per miss.
- **Sending less article text** cuts cost almost proportionally. The first 3,000 characters may well be enough for a 20-word sentence; the evaluation can show that.
- **Haiku 5.5 has no server-side refusal fallback**, so a declined request just gets the free summary. That matters little here.

## Other costs

- **Hosting.** A Vercel function on the Hobby plan, which includes one rate-limit rule per project and 1,000,000 rate-limit checks. Each summary uses two checks. The Hobby plan is meant for personal, non-commercial projects, so a LinkPeek that earns money would need a paid plan.
- **Nothing else.** No database and no other paid services.

## Keeping it in hand

- Set a **monthly spend limit in the Anthropic Console** before going live. It's the only hard ceiling.
- The backend's rate limit caps each install and each IP address, not everyone together. At 30 requests per 10 minutes, one address can make at most 4,320 a day: about $65 a day on Opus 5.5 at the top of the range, or about $1.30 on Haiku 5.5. Several addresses multiply that, which is why the Console limit matters.
- `SUMMARIES_ENABLED=false` on the backend switches AI summaries off at once. The extension then uses its free summary.
- AI summaries are off by default in the extension. Each person chooses them in Settings.
