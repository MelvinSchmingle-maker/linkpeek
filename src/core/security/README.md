# security

The link check (Part 11). Stage 1 is built: checks on the address and text, on this computer, with no lookup. It warns, never blocks, and never says a link is safe.

- `assess.ts`: the rules, and `assessLink()`, which gives the outcome and one reason.
- `lists.ts`: the brands, shorteners, risky file types, and words the rules use. Each list is a guess at what's common; the tests in `eval/urls.json` say what they must catch and what they must leave alone.
- `punycode.ts`: decodes internationalised hostnames, so a lookalike shows its real letters.

Stage 2 (a threat lookup) isn't built. The options are compared in `docs/security-services.md`.

The redirect check ("Check where this link goes") lives in `src/background/redirects.ts`, and is asked only when the user presses the card's button.

Decisions: `docs/decisions.md` D54. What is sent: `docs/privacy.md`, "The link check".
