# Measurement and money (Part 14): status

The plan says each section below is its own decision, and that most of it waits for real users. Here is what's built, what isn't, and what each part is waiting for.

## 14a. Opt-in usage counts: schema only

- **Built:** `src/core/measure/events.ts`, the list of events an opt-in count could record, and a guard that refuses anything with a full address, a path, a query, article text or an unknown field. Tests in `events.test.ts`.
- **Not built:** the opt-in switch, the sending, the backend that would collect the counts, the daily aggregation and the 30-day deletion. The plan says to build these "only after real users". LinkPeek has none yet.
- **Needs:** a decision on where the counts are stored (a database is a paid account), the owner's go-ahead, and the privacy page updated before any switch appears.

## 14b. "Readers opened this": not built

Depends on 14a's counts, so it waits for them. Not built.

## 14c. Partner referrals: not built

Needs a signed publisher partner. None exists, so nothing is built and no referral parameter is added to any link.

## 14d. Premium tier: not built

A "coming soon" page and a sign-up would collect email addresses, and billing needs a provider. Both need the owner's decision and a budget, so neither is built or shown. The plan says to test demand first, with direct questions to 10 to 20 users.

## Rules that already hold

- No share of traction, revenue or partner figures appears anywhere in the code, the docs or the store copy.
- The modules that judge a result (clickbait, source, security and extraction) can't read settings or storage. `src/core/measure/independence.test.ts` reads their source and fails if an import of storage or settings appears there. The warnings list ("Don't warn me") is read by the page, not by these modules.
- Feedback (Part 09) is stored on the device and never sent. The upload setting is off, hidden, and does nothing (`src/core/feedback/upload.ts`).
