# LinkPeek to-do

Last updated 17 Oct 2026, after Part 08 and a follow-up check of the browser-tab rule on real news pages. Newest problems are at the top. Each item says what "done" looks like. Read `handoff.md` first for the context behind these.

## 1. Problems the owner reported (17 Oct 2026)

- [ ] **Too many permission prompts.** Chrome asks once per website, so every new site brings a prompt. The owner wants one grant after install, and never asked again. Today's model is in `docs/permissions.md`.
  - Decision needed first (see `handoff.md`, "Open decisions"). Options: one all-sites grant at install, or keep per-site prompts and make them clearer.
  - Done when: a new site opens a card with no prompt after the one grant, and the choice is written into `docs/permissions.md` and `docs/decisions.md`.
- [ ] **Most links fail.** The owner tried four links on a Facebook post. The talkSPORT one showed "Couldn't open this article. The page needs to run in a browser tab to show its text." The other three gave nothing.
  - Get: the full talkSPORT link (the screenshot cuts it short) and the other three links, with what each card said. From this machine every talkSPORT path returns a "Verifying Device" robot check, so the owner's own machine is the only place to reproduce it.
  - Done when: each link either shows text, or shows a message that says what's actually wrong.
  - 17 Oct check (`docs/compat/part-04-live.md`): 7 of 12 news pages read in full. The failures found: NPR shows a false paywall on free pages and The Verge's structured data flags it as paid (both in section 3). Mirror's opening was a timestamp, now fixed (item below).
- [x] **Mirror opening is a timestamp.** On Mirror articles the opening sentence and the summary came out as "20:13, 17 Oct 2026Updated 21:01, 17 Oct 2026", and then as a headline above the story. The opening rule (D29) took the first paragraph of six words or more, and neither line is a sentence.
  - Done 17 Oct 2026 (D29): date-and-time lines are skipped, and so are short lines with no closing punctuation. The Mirror article now opens on "Seconds after a terrifying train crash...". Test page `test-pages/articles/timestamp.html`, in `assess.test.ts`. Checked on 16 saved pages: only the Mirror opening changed.
- [ ] **JavaScript-built pages show nothing.** LinkPeek reads pages without running their scripts, so a page that builds its text in the browser comes back nearly empty. That's the case behind the "browser tab" message.
  - Decided (D52): show the page's own description, labelled "Preview only", with the browser-tab reason. No hidden tab, because that needs a new permission (section 3). This is already built.
  - Still open for "done": the Standard's news front page is a JavaScript-built example, and it shows its description when read from saved HTML. Confirm it in a live run on a Standard article. The URL needs finding first, since the front page has no article links in its raw HTML.
- [x] **The "browser tab" rule may fire too often.** It's `looksJsRendered` in `src/core/retrieve/diagnose.ts`. It fires when the article text is under 50 words and either the page's `<noscript>` asks for JavaScript, or the page has scripts and either an empty app container or under 30 words of body text.
  - Checked 17 Oct 2026 on 12 real news pages, with the results in `docs/compat/part-04-live.md`. It fired on none of them. The one page it fired on was YouTube, which is built in the browser. The rule can't fire on a page with 50 or more article words, so the remaining risk is a short page with a `<noscript>` JavaScript message. None of the 12 showed that.
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
- [ ] **Paywall flag on a free page** (The Verge, 17 Oct). Its structured data says `isAccessibleForFree: false`, so LinkPeek shows only the description (D27). The page reads freely in a normal browser. Keep trusting the flag, or only trust it when the body is also hidden? Keeping it is the current behaviour.
- [ ] **False paywall on NPR.** `[id*="piano"]` in `src/core/extract/html.ts` matches NPR's Piano script and empty Piano slots, which every NPR page has. So a short NPR item reads as "behind a subscription". Options: (a) leave it; (b) narrow the selector to exclude NPR's slots by name, which is quick but tied to NPR's markup; (c) count only Piano elements that hold text. (c) would stop empty slots counting, but a wall filled in by script on a short page would then show its teaser text instead of the description. That goes against "never show body text from such a page" (D27), so it needs a yes. Recommended: (b), with a test.
- [ ] **robots.txt.** LinkPeek doesn't read `robots.txt`, and nothing in the docs says it should or shouldn't. talkSPORT's file says `User-agent: *` / `Disallow: /`, with a note that its content isn't licensed for large language models. Options: (a) honour `robots.txt` for each user-triggered read, and show "the site's robots.txt asks automated tools to stay out" on a card; (b) keep reading as the user's own browser does, and write that choice down in `docs/permissions.md` and a new decision. Either way the owner should decide, and this is worth a look with whoever handles the project's legal questions.

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
