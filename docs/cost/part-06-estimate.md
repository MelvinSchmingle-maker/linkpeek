# Part 06 cost estimate: AI summaries

An estimate, made before any real request. The measured figure comes from `npm run eval:ai` (`docs/eval/part-06.md`) once it has been run with a real API key. Prices are Anthropic's first-party list prices, checked 17 Oct 2026.

## What one summary uses

| Part | Tokens | Notes |
|---|---|---|
| Fixed instructions (system prompt) | about 725 | The same for every request, so it's cached: after the first request in any 5-minute stretch it's billed at the cache-read price. |
| The article | about 1,500 to 2,000 | The extension sends the first 6,000 characters. Claude's newer tokenizer can use up to about a third more tokens than the old rule of thumb of 4 characters a token. |
| The reply | about 50 to 300 | A 20-word sentence is about 30 tokens. Claude also thinks briefly before answering, and that's billed as output. Effort is set to "low" to keep it short, but how much it thinks varies. |

About one request in ten is expected to need a second, much smaller request (asking for a shorter sentence or a rewrite). That adds a few percent and is left out below.

## Cost by model

The code defaults to **Claude Opus 5.5**, Anthropic's current default model. Choosing a cheaper one is your decision: set `SUMMARY_MODEL` on the backend. No code change is needed.

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
