# LinkPeek summary backend

One endpoint, `POST /api/summarise`, that writes a summary of 20 words or fewer with Claude. It's used only when someone chooses "LinkPeek's AI" in the extension's Settings. Part 06 of the build plan.

The Anthropic API key lives here, in an environment variable, and never in the extension: anyone can unpack an extension and read it.

## What it does and doesn't do

- **Accepts:** the article text (up to 12,000 characters; the extension sends 6,000), the link text, the evidence level, the page language and a random install ID. Anything else is a 400. It never receives the page's address.
- **Doesn't fetch URLs.** There's no server-side fetching, so there's no SSRF risk yet.
- **Doesn't store article text.** It logs one line per request: status, error code, timing and token counts. No text, no headline, no install ID.
- **Rate limits** per install ID and per IP address (`src/ratelimit.ts`). If the rule isn't set up, it refuses requests rather than run unguarded. Nothing caps everyone together: that's the Anthropic Console spend limit.
- **Article text is untrusted.** It's wrapped in tags, our own tags are stripped from it, and the instructions say nothing inside it is an instruction (`src/prompt.ts`). The extension checks every summary again before showing it.
- **Model:** `claude-opus-5-5` by default, at effort "low", with a cached system prompt and `fallbacks: "default"` so a declined request is retried on Anthropic's recommended fallback model (not on Haiku, which has none). See `docs/cost/part-06-estimate.md` before choosing.

## Run the tests

```
cd server
npm install
npm test
```

No key is needed and nothing calls Claude: the tests use a stand-in. From the project root, `npm run check` runs them too.

To try the real model on the evaluation set (costs money, about 25 requests), from the project root:

```
ANTHROPIC_API_KEY=... npm run eval:ai
```

It writes `docs/eval/part-06.md`.

In a Claude Code cloud environment, add the key under the environment's **Environment variables** as one line, `LINKPEEK_ANTHROPIC_API_KEY=` followed straight away by the key (no quotes, no spaces). The eval script reads that name too. A different name keeps Claude Code itself from picking the key up.

## Deploy on Vercel

1. In Vercel, create a new project from this repository and set its **Root Directory** to `server`.
2. Under **Settings > Environment Variables**, add:
   - `ANTHROPIC_API_KEY` (required, from https://console.anthropic.com)
   - `SUMMARY_MODEL` (optional: `claude-opus-5-5` by default, or `claude-sonnet-5-5` / `claude-haiku-5-5`)
   - `SUMMARIES_ENABLED` (optional: set to `false` to switch summaries off)
3. Under **Firewall**, add one rate-limit rule. If: `@vercel/firewall`, Rate limit ID `summarise`. Then: Rate Limit, Fixed Window, for example 30 requests per 600 seconds (10 minutes is the most the Hobby plan allows), default 429 action. Publish it.

   The code checks that rule twice per request, once keyed by install ID and once by IP address, so each install and each address gets its own bucket of that size. One rule because the Hobby plan allows one rate-limit rule per project. Without it every request gets `500 misconfigured`. That's on purpose. The backend only trusts the rule on Vercel: run anywhere else and it refuses every request, unless you set `RATE_LIMITER=memory` for a local test.
4. In the **Anthropic Console**, set a monthly spend limit. It's the real ceiling on cost.
5. Deploy. The endpoint is `https://<your-project>.vercel.app/api/summarise`.
6. Build the extension pointing at it:

   ```
   LINKPEEK_API_URL=https://<your-project>.vercel.app/api/summarise npm run build
   ```

   Without `LINKPEEK_API_URL`, the "LinkPeek's AI" option in Settings is shown greyed out ("Not set up in this version of LinkPeek").

## Files

- `api/summarise.ts`: the Vercel entry point.
- `src/handler.ts`: the request handling (CORS, size, validation, switch, rate limits, model).
- `src/contract.ts`: what may be sent, and what comes back.
- `src/prompt.ts`: the instructions and how the article is wrapped.
- `src/anthropic.ts`: the Claude call.
- `src/ratelimit.ts`: Vercel Firewall limits, plus an in-memory version for local runs and tests.
