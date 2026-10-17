# Part 14. Measurement and money (only after real users)

## Before you start
Only paste this once LinkPeek has real users beyond you and Part 10's results look good. Everything here is a hypothesis to test, not a plan to roll out. Each section below can be its own session.

## 14a. Opt-in usage measurement
- A clear opt-in at first run or in settings: "Share anonymous usage counts to help improve LinkPeek." Off unless the user agrees.
- Events (counts only): summary shown (with evidence level and provider), feedback given, outbound click from the card, failure reason codes. Hostname at most, never full URLs, never article text.
- A random install ID that rotates monthly. No accounts.
- Backend aggregates daily and deletes raw events after 30 days (or less). Document retention in `docs/privacy.md` and in a plain-English privacy page.
- Bot and duplicate filtering, plus a per-install rate limit.
- A simple internal report: summaries per active user, share of `full` results, length compliance, feedback rate and top reasons, repeat use after 7 and 30 days, cost per summary.

## 14b. "Readers opened this" count (optional, decide after 14a)
- Only from opt-in outbound clicks, deduplicated per install per article per period.
- Shown only above a minimum (for example 50) and rounded.
- Wording: "About 250 LinkPeek users opened this in the last 30 days." Never "trusted", "recommended" or "endorsed".
- Shown apart from clickbait and source info, and never feeds into them.

## 14c. Referral measurement for partner publishers (only with a signed partner)
- Standard UTM parameters, added only to links to participating publishers, only on clicks from the card, and disclosed in the privacy page.
- No link rewriting elsewhere, no affiliate IDs on arbitrary links, the real destination always visible.
- Report only what we measure (clicks). Conversions come only from the publisher's own reporting, labelled as theirs.
- No publisher dashboard until at least one publisher asks for it. A spreadsheet export is enough at first.

## 14d. Premium tier test
- Before building billing, test demand: a "LinkPeek Plus (coming soon)" note in the options page with a "Tell me when it's ready" signup, plus asking 10 to 20 regular users directly.
- Candidate features: higher limits, long-thread and video summaries, multi-source comparison, translation, saved collections.
- Price to test: £3 to £5 a month. It's a hypothesis.
- Only then pick a billing provider and build it, in its own session.

## From the competitor research
DeArrow's optional payment (a small fee, a short trial, and a free option some reviewers couldn't find) comes up in 17 of its 36 one- and two-star Firefox reviews. Even when it's optional, a payment step that feels like a hurdle costs ratings. So:
- The core features stay free and complete: no trial timers, no reminders, no "activate" step.
- A paid tier only adds extras, and the store listing says exactly what's free.

## Rules that don't bend
- Nobody can pay for a better rating, a hidden warning, a nicer summary, removed feedback or a bigger popularity number. Add a test asserting that partner status isn't an input to clickbait, source or security modules.
- Sponsored content, if any, is labelled and visually separate from results.
- No selling of browsing data. No points or cash for voting or clicking.
- Never invent traction, partner or revenue figures, including in pitch documents.

## Done when (per section)
- Privacy docs updated before release.
- Opt-out fully stops sending (tested).
- Report numbers come from real data, labelled observed, estimate or hypothesis.
