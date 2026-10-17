# LinkPeek to-do

Last updated 17 Oct 2026, after Part 08. Newest problems are at the top. Each item says what "done" looks like. Read `handoff.md` first for the context behind these.

## 1. Problems the owner reported (17 Oct 2026)

- [ ] **Too many permission prompts.** Chrome asks once per website, so every new site brings a prompt. The owner wants one grant after install, and never asked again. Today's model is in `docs/permissions.md`.
  - Decision needed first (see `handoff.md`, "Open decisions"). Options: one all-sites grant at install, or keep per-site prompts and make them clearer.
  - Done when: a new site opens a card with no prompt after the one grant, and the choice is written into `docs/permissions.md` and `docs/decisions.md`.
- [ ] **Most links fail.** The owner tried four links on a Facebook post. The talkSPORT one showed "Couldn't open this article. The page needs to run in a browser tab to show its text." The other three gave nothing.
  - Get: the full talkSPORT link (the screenshot cuts it short) and the other three links, with what each card said.
  - Done when: each link either shows text, or shows a message that says what's actually wrong.
- [ ] **JavaScript-built pages show nothing.** LinkPeek reads pages without running their scripts, so a page that builds its text in the browser comes back nearly empty. That's the case behind the "browser tab" message.
  - Options: show the page's own description when there's no article text (the card already does this for some failures); or read the page in a hidden tab (needs a new permission, so a decision).
  - Done when: a known JavaScript-built news page shows its description, and the message says why the text is missing.
- [ ] **The "browser tab" rule may fire too often.** It's `looksJsRendered` in `src/core/retrieve/diagnose.ts`. It fires when the article text is under 50 words and either the page's `<noscript>` asks for JavaScript, or the page has scripts and either an empty app container or under 30 words of body text. Not yet checked on pages that work.
  - Done when: the rule has been checked on at least ten real news pages, with the results written to `docs/compat/`.
- [ ] **The card looks amateurish.** The owner said this can wait until the links work.
  - Done when: a design pass has been agreed with the owner, and the card is reviewed on five real sites.

## 2. Checks the owner still needs to do

- [ ] **Part 07 check:** read the crosses that went wrong in `docs/eval/part-07.md`. Would any publisher have a fair complaint?
- [ ] **Part 08 check:** open "About this source" on five sites you know well. Is anything wrong or misleading? Wrong facts hurt more than missing ones.
- [ ] **Anthropic spend limit:** check the monthly spend limit in the Anthropic Console is set. `docs/progress.md` says it was set by hand, and I can't see it from here. A separate workspace with its own limit for LinkPeek's key was recommended and not set.

## 3. Decisions for the owner

- [ ] Permission model (item 1 above).
- [ ] Whether the headline check should use AI for its second stage. It isn't built. The owner said "ok" to leaving it for later.
- [ ] Whether a neutral headline result shows "No headline verdict" on every article. `docs/decisions.md` D45 says yes. Changing it is a small edit.
- [ ] Hosting for money. `docs/progress.md` says Vercel's Hobby plan is for personal, non-commercial use, so a paid plan is needed before LinkPeek earns anything.

## 4. Known limits, not blocking

- [ ] Headline check, measured in `docs/eval/part-07.md`: the tuned set catches 92% of crosses and 69% of ticks with no false crosses. The held-out set catches 90% and 67%, also with no false crosses. The tuned numbers are the optimistic ones. Misses include "one weird trick" wording (held-out h02) and withheld results with no listed pattern ("What the minister said next", "She opened the box", labelled c09 and c10). Ticks miss when the headline has no figure to match.
- [ ] Source card: article type and primary-source counts use rough rules. Ownership and independent coverage are not built (D46).
- [ ] Card at 200% zoom: the default card fits above its link with about 3 pixels to spare. A longer reason on a cross card could push it off screen, and that case isn't tested.
- [ ] One browser test (the infinite-feed test) failed once in a full run from a scroll race in its test page. It passes alone. Not fixed.

## 5. Build plan, still to do

The full plan is in `build-plan/`. Each part has a "Done when" and a "Your check".

- [ ] **Part 09, feedback** (`build-plan/09-feedback.md`): basic votes are already stored on the device (D12, `src/core/feedback`). The rest of the part isn't built.
- [ ] **Part 10, real-world testing** (`build-plan/10-real-world-testing.md`): the compatibility matrix, filled in with real results. `docs/compat/part-04-live.md` is the only one so far.
- [ ] **Part 11, link protector** (`build-plan/11-link-protector.md`): stage 1 is free and on-device. Stage 2, the threat lookup, needs the owner's decision, as the plan says.
- [ ] **Part 12, annoyance filter and reading mode** (`build-plan/12-annoyance-filter.md`): each item is a separate toggle, with cookie and consent banners covered.
- [ ] **Part 13, social adapters** (`build-plan/13-social-adapters.md`): one platform per session. The plan lists Reddit, YouTube and X, and says to check each platform's rules before writing code.
- [ ] **Part 14, measurement and money** (`build-plan/14-measurement-and-money.md`): only after real users. Sections 14a to 14d, each decided on its own.
