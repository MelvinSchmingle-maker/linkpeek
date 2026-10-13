# Part 13. Social adapters (one platform per session)

## Goal
Platform-specific support, added one platform at a time, each tested and documented separately. Paste this part once per platform, naming the platform.

> Build the **[PLATFORM]** adapter from Part 13.

Suggested order: Reddit, then YouTube, then X, then others. Facebook and Instagram last, and only if research shows it's allowed and practical.

## For every platform, before writing code
Write `docs/adapters/[platform].md` covering:
- official API: does one exist, cost, limits, terms on summarising and caching content
- what works without an API (content already visible on the page the user has open)
- login needs and whether we'd be reading content behind a login
- Chrome Web Store policy issues
- recommendation: build, build a limited version, or skip, and why

If the answer is "skip", stop there and report. That's a valid result.

## Build (per platform)
- Adapter in `src/adapters/[platform]/` implementing a shared `Adapter` interface: `matches(url)`, `extract(context)`, returning the same result shape and evidence levels as the general engine.
- The general engine stays the fallback when an adapter fails.

### Reddit
- Post title, body and top comments. From the open page when the user is on it, or from the public JSON endpoint if current terms allow (check them).
- The summary keeps "the poster says" apart from "replies say". Optional expanded view: main point, main disagreement, notable counterpoint.
- Never present the most upvoted view as the correct one.

### YouTube
- Use captions only when the video has them and they're accessible. No captions means "No transcript available" and a description-based `partial` preview, clearly labelled. Never invent a transcript.

### X
- Only content visible on the page the user has open, unless the official API is affordable and its terms allow this use. Record the access situation honestly.

## Expanded summary (shared across platforms)
Default stays one sentence. An optional "More" shows up to three key points, each with the same no-invention rules.

## Done when (per platform)
- Fixture tests for the adapter, including a failure case.
- Live check on at least 5 real items, results added to `docs/compat/matrix.md`.
- Limitations listed in the adapter doc.

## Your check
For each platform, read the adapter doc's recommendation before approving the build. Some platforms aren't worth the policy risk.
