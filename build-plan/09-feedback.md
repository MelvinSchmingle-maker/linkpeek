# Part 09. Feedback buttons

## Goal
One-tap "Was this useful?" feedback that helps us find failures, stored on the device first.

## Build
- Under the expanded summary: "Was this useful?" with thumbs up and thumbs down.
- Thumbs down opens an optional one-tap reason list: Missed the main point, Factually inaccurate, Too vague, Didn't match the article, Article inaccessible, Other. Skippable.
- A separate small control on the clickbait verdict: "Disagree with this rating?". It is a separate signal, never mixed with summary usefulness.
- Store feedback locally in `src/core/feedback/` with: signal type (`summary-usefulness`, `summary-accuracy`, `clickbait`, `security`), value, reason, evidence level, provider, word count, hostname only (not full URL), timestamp. No article text, no full URL.
- One vote per result per signal (changing your mind replaces the old vote). Ignore repeated events from the same click.
- Options page: "Your feedback" summary with counts by reason and a "Delete all feedback" button.
- An export button that downloads the local feedback as JSON, so you can share it with me while testing.
- Sending feedback to a server is a stub behind a setting that is off and hidden until Part 14. Write down in `docs/privacy.md` exactly what would be sent if it's ever turned on.

## Don't
- No points or rewards for voting.
- Never use feedback to change clickbait or source results automatically.

## Done when
- Tests for storage, one-vote rule, deletion and export.
- Playwright: thumbs down, then reason, then shown as received.
- Keyboard-accessible.

## Your check
Use LinkPeek for a few days, export your feedback, and paste it into the next session. Its most common reason is your next fix.
