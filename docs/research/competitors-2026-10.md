# Competitor research, October 2026

What else helps people decide whether a link is worth opening, what those products get right and wrong, and what that means for LinkPeek's remaining parts.

Made 14 to 17 Oct 2026. Every fact below has a source link. Store figures are snapshots and change daily.

## The short version

- **No browser ships a link summary.** Chrome had an experimental "Link Preview" (the whole page in a floating window, no summary) behind a flag, off by default in its code, and deleted it in Chrome 149. Edge tested a "Preview link" menu item in Canary in 2023, and we found no sign it reached the stable version. Safari on the Mac can preview a page with Force Touch, which shows the page shrunk, not a judgement about it.
- **The products closest to LinkPeek are tiny.** Four extensions show an AI or metadata summary when you hover over or click a link: Link Summarizer AI, Smart Hover Reader, LinkLooker and Peeko. None has more than 7 users or more than 1 rating. Three have not been updated for 17 months or more.
- **Every summariser found writes more than 20 words.** That's 2 to 12 sentences, up to three bullets, or the page's own description. LinkPeek's hard 20-word limit is a real difference.
- **No product gives a tick, cross or neutral verdict on a headline against its article before the click, without a server.** DeArrow crowdsources replacement titles on YouTube. Smart Hover Reader answers the clickbait question in free text. ClickGuard, a research prototype, shows a probability from a server. This is the clearest gap.
- **The big products each do one slice, built differently.** Merlin (900,000 users) is an account-based AI assistant with no card next to each link. Norton Safe Web (4,000,000 users, rated 2.7) checks every page against Norton's server.
- **Reviews say what to avoid.** In Firefox reviews, Norton's low ratings cluster on "no way to add an exception" and false alarms. DeArrow's low ratings cluster on its optional payment, and on replacement titles that are worse than the originals.

## How this was made

1. A multi-agent research run (`deep-research`). Five search angles, 21 sources read, 98 claims pulled out. The 25 most important claims were each checked by three separate fact-checkers, and a claim was dropped if two of the three refuted it: 16 were confirmed and 9 refuted. The raw output is in `deep-research-2026-10-17.json`. Refuted claims are listed at the end so nobody reuses them.
2. Two gaps filled by hand. The first was the Chrome question, answered by reading Chromium's source code. The second was user reviews, taken from Mozilla's public Firefox Add-ons reviews API: 128 written reviews of DeArrow and 64 of Norton Safe Web, ranked with `reviews.py` from [replica-skill](https://github.com/Jakeschincariol/replica-skill), which only prints exact quotes with links. Those rankings are in `reviews/`.
3. The feature matrix is in `feature-matrix.csv`.

Limits, said plainly:
- Most product facts come from each developer's own store listing. The only product checked against its actual code is Smart Hover Reader.
- No Chrome Web Store review text was collected, only star averages.
- The review sample is Firefox users only, for two products that each cover one slice of LinkPeek.
- Annoyance and cookie-banner blockers, Brave, and Edge's current state were not covered.
- This research ran from a cloud machine that some sites block.

## Built into browsers

| Browser | What it has | Status | Source |
|---|---|---|---|
| Chrome | "Link Preview": opens the whole linked page in a small floating window. Triggered by Alt+click, right-click "Preview link" or Alt+hover. No summary. You can scroll but can't click inside. | Removed. In Chromium 148.0.7778.0 the feature is `BASE_FEATURE(kLinkPreview, base::FEATURE_DISABLED_BY_DEFAULT)` with the flag `chrome://flags/#link-preview`. In 149.0.7827.53 and in current Chromium (version 158) the feature, the flag and its code folder (`chrome/browser/preloading/preview/`) are gone. gHacks saw it switched on in Canary in 2024; we found no report of it in stable Chrome. | [Chromium 148 features.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7778.0/third_party/blink/common/features.cc), [Chromium 149 features.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/149.0.7827.53/third_party/blink/common/features.cc), [gHacks, Mar 2024](https://www.ghacks.net/2024/03/13/first-look-at-google-chromes-upcoming-link-preview-feature/), OnMSFT also reported the removal ([link](https://onmsft.com/?p=58741), which refused to open from here) |
| Edge | "Preview link" in the right-click menu, showing a small preview of the page. | Seen in Canary in December 2023. We found no source saying it reached stable Edge. Edge is built on Chromium, so it probably lost the shared code too, but that is a guess. | [TechRadar, Dec 2023](https://www.techradar.com/computing/edge/watch-out-google-chrome-microsoft-edge-gets-a-super-drag-and-drop-feature-that-actually-lives-up-to-the-name-as-an-impressive-addition-to-the-browser) |
| Safari (Mac) | Quick Look link preview with a Force Touch trackpad, plus an undocumented Control-Command-D shortcut while hovering. It shows the page scaled down. Users say it often can't be read. | Shipping for years. | [Michael Tsai, May 2024](https://mjtsai.com/blog/2024/05/20/safari-hover-link-preview-keyboard-shortcut/), [Orion feedback thread](https://orionfeedback.org/d/4610-open-different-domains-in-popup-similar-to-arcs-peek) |
| Arc | "Peek" opens some links in a popup (a link from a pinned tab to another site, or Cmd+Shift+click). | Secondary source only. | [Orion feedback thread](https://orionfeedback.org/d/4610-open-different-domains-in-popup-similar-to-arcs-peek) |
| Orion (Kagi) | Its own link preview popup, built because macOS Quick Look can't be changed. | Implemented in 2024, per the team on its forum. | [Orion feedback thread](https://orionfeedback.org/d/4610-open-different-domains-in-popup-similar-to-arcs-peek) |
| Brave | Not covered. | | |

In that Orion thread a user describes the job exactly as LinkPeek's brief does: "using preview to decide if a site is worth reading, then promoting it to a tab to be looked at now it is clear it's relevant." Browsers answer that job by showing the page. Nobody answers it by saying what's in it.

## Extensions and other products

| Product | What it does | Users | Rating | Last update | AI | Account or key | Permissions | Data | Sources |
|---|---|---|---|---|---|---|---|---|---|
| Link Summarizer AI | Hover a link, a chip appears; click it for an AI summary of 2 to 12 sentences. | 7 | 5.0 (1) | 5 May 2026 | Listing says on-device Gemini Nano. Not confirmed (refuted 0-3). | Listing says none. Not confirmed (refuted 1-2). | Not checked | Not confirmed | [Store](https://chromewebstore.google.com/detail/enlgnealkaolloegpfdmloikifmgbcab) |
| Smart Hover Reader | Hover a news link on a site you've allowed for an AI summary: one sentence for clickbait, up to three bullets otherwise. Text only, no verdict. | 6 | none | 22 May 2025 | OpenAI gpt-4o-mini, using a key built into the extension (seen in its code). | None | Optional all-sites access, asked per site. Fetches without cookies. | Up to 6,000 characters of article text go to OpenAI, although the listing says it "runs entirely in your browser". | [Store](https://chromewebstore.google.com/detail/hondicdnejefklafalckkmmnpmkgkcne), [privacy policy](https://rpavic3.github.io/smart-hover-reader/privacy.html) |
| LinkLooker | Hover and press Shift. Shows the page's title, description and cover image. AI summary only with your own paid OpenAI key. Says PDFs, anchor links and social sites may not work. | about 4 (unconfirmed); Firefox 0 daily users | 1 rating on Chrome; none on Firefox | Chrome Jul 2024, Firefox 29 Nov 2024 | Optional, OpenAI, your own key | Your own key for AI | Firefox: all sites at install | Page text to OpenAI only if you add a key | [Store](https://chromewebstore.google.com/detail/madknadnoiflomiheamlcmfbnbmlccik), [Firefox API](https://addons.mozilla.org/api/v5/addons/addon/linklooker/), [code](https://github.com/TetraTsunami/linklooker) |
| Peeko | Hover a link for an AI summary. Adjustable delay, length and theme, sites to exclude, caching. | 6 | 5.0 (1) | 23 Apr 2025 | Optional OpenAI, your own key (privacy policy) | Your own key for AI | Not checked | Not confirmed | [Store](https://chromewebstore.google.com/detail/filpmfnfnllknlgodhdmmopnfnfgbjii), [privacy policy](https://harisnazir.github.io/Peeko/PRIVACY.html) |
| Merlin AI | General AI assistant. Summarises a pasted link or the current page in a sidebar. Adds AI answers to search results. No card next to each link. | 900,000 | 4.4 (8.8K) | 5 Oct 2026 | Not confirmed (the claim of OpenAI, Anthropic and Google was refuted 0-3) | Account needed for the full feature set | Not checked | Not checked | [Store](https://chrome.google.com/webstore/detail/merlin-1-click-access-to/camppjleccjaphfdbohjdohecfnoikec?hl=en) |
| DeArrow | Replaces YouTube titles and thumbnails with ones users submit and vote on. Doesn't compare a title with the video. Without submissions, it reformats the original title and picks a random frame. | Chrome 100,000; Firefox 34,444 daily | Chrome 4.2 (318); Firefox 3.98 (396) | 14 Jul 2026 (Chrome) | None | Reviewers describe an optional payment with a free option | youtube.com and youtube-nocookie.com only | Submissions and votes go to its server | [Store](https://chromewebstore.google.com/detail/enamippconapkdmgfgjchkhakpfinmaj), [Firefox](https://addons.mozilla.org/firefox/addon/dearrow), [code](https://github.com/ajayyy/DeArrow) |
| ClickGuard | Research prototype. Coloured risk badges next to headlines before a click, a percentage score and a 1 to 2 sentence spoiler after. English only. | Not released | | Preprint, May 2026, not peer reviewed | XGBoost plus OpenAI embeddings and gpt-4o-mini, on a server | n/a | n/a | Headlines and articles go to its server | [arXiv 2607.20463](https://arxiv.org/abs/2607.20463) |
| Norton Safe Web | Checks every page you load against Norton's reputation server and blocks pages and downloads it thinks are malicious. | Chrome 4,000,000; Firefox 330,884 daily | Chrome 2.7 (339); Firefox 3.93 (378) | Chrome 20 Aug 2026; Firefox 10 Jan 2025 | Not stated | Not checked | All sites, browsing history, downloads, webRequestBlocking | Says it collects web history and user activity. Usage data goes to Google Analytics. | [Store](https://chromewebstore.google.com/detail/norton-safe-web/fnpbeacklnhmkkilekogeiekaglbmmka) |

Firefox figures were fetched from the Firefox Add-ons API on 17 Oct 2026. The rest come from the research run, 14 to 17 Oct 2026.

Where the AI provider could be confirmed, it was OpenAI every time, either with a key built into the extension or with the user's own key. A key built into an extension can be read by anyone who unpacks it. The research deliberately did not copy Smart Hover Reader's key.

## What users say

Only two of the products have enough written reviews to read. Both come from Firefox, and neither product is a direct competitor, so read this as lessons for two of LinkPeek's parts, not as a market survey. The counts are from reading every matching review. The full ranked lists are in `reviews/`.

### Norton Safe Web (64 written reviews, 34 of them one or two stars)

The most common complaint is that **you can't overrule it**: 7 reviews, 6 of them one or two stars.
- "Blocks downloads with no way to add any exceptions. I feel like I'm being treated like an idiot or a child who can't figure out things on their own." ([1 star, Oct 2022](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/1880240/))
- "Not being able to add an exclusion? Really? Norton knows best, no exceptions? Well no thanks." ([1 star, Apr 2022](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/1826945/))
- "It blocks some sites even Norton itself rates as Safe. Worse, it doesn't give you an opportunity for an exception." ([1 star, Aug 2024](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/2106444/))

Next come **false alarms on safe sites**: 6 reviews, 5 of them one or two stars.
- "Way too many false positives for "known dangerous sites"." ([1 star, Oct 2019](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/1426383/))
- "Gives false ratings on Facebook, shows some legitimate (and very safe) pages as having a suspicious link - they are safe, and have been for several years!" ([2 stars, Sep 2024](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/2119808/))

Then **missing real threats**: 3 reviews, all one or two stars.
- "Blatantly obvious malware links easily fly under Norton's radar." ([2 stars, Jun 2023](https://addons.mozilla.org/en-US/firefox/addon/norton-safe-web/reviews/1969965/))

So it blocks too much and still misses things, and the user has no say in either. Two reviews call it spyware. That's thin, but it fits a product that asks for your whole browsing history.

### DeArrow (128 written reviews, 36 of them one or two stars)

The most common subject is **its optional payment**: 38 reviews mention paying, a licence or the trial, including 17 of the 36 one- and two-star reviews. Several five-star reviewers defend it, which is the point: people argue about the payment more than the product.
- "No activation button available, only trial for 6 hours. So every 6 hours i have to reactivate it, essentially replacing one annoyance with another." ([1 star, Jul 2026](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2731220/))
- "It's not about the price, it's about the hassle." ([1 star](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2539835/))
- "Shame that so many people don't understand the soft paywall..." ([5 stars, Aug 2026](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2741165/))

**Replacements worse than the original**: 12 reviews.
- "changes titles that dont need to be changed at all, and it changes them to a longer much worse version of the same title." ([1 star](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2633227/))
- "the style that the community has decided to adopt is not *descriptive* it's *verbose*." ([1 star](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2580407/))

**Spoilers**: only 1 review, so this one is thin, but it's specific.
- "Just had today's Formula 1 race spoiled because DeArrow put the race results as the thumbnail for the race highlights vid instead of leaving the original alone." ([1 star, Sep 2024](https://addons.mozilla.org/en-US/firefox/addon/dearrow/reviews/2115738/))

Half the written reviews (64 of 128) are five stars, and 16 reviews mention clickbait by name. People want the job done; the complaints are about how.

## What it means for LinkPeek

Each point names the evidence it rests on. Where the evidence is thin, it says so.

**Part 05, summaries.** Keep the hard 20-word limit. Every summariser found writes more, so it is the plainest difference LinkPeek has. Spoilers are a real risk for a tool that tells you what's behind a link. One DeArrow review is not a trend, so this is a note for later, not a rule.

**Part 06, AI summaries.** Before building a backend, measure whether Chrome's built-in Summarizer (already planned in Part 05) is good enough: it costs nothing and sends nothing. If text ever leaves the device, the settings line must say so, and a test should check that the wording matches what the code does. The one competitor whose code was checked says "runs entirely in your browser" while sending article text to OpenAI.

**Part 07, clickbait check.** The gap is real: nobody offers a three-state verdict on a headline against its article without a server. Two lessons from DeArrow:
- Judge, don't replace. LinkPeek never rewrites the headline on the page. Any factual rewrite stays inside the expanded card, labelled as LinkPeek's.
- A rewrite must not give away an outcome the headline kept back on purpose (a score, a result, an ending) without warning.

How accurate a headline-against-article check can be is unknown. Both outside claims about AI clickbait accuracy were refuted, so our own labelled set is the only number we'll have.

**Part 08, source card.** LinkLooker's no-AI default (title, publisher description, cover image) is close to what a useful card needs. Part 04 already reads that metadata.

**Part 09, feedback.** Crowd voting like DeArrow's needs a server. Keep feedback on the device, as planned. No change.

**Part 10, real-world testing.** None of the small competitors has a single independent review. LinkLooker warns that PDFs, anchor links and social sites may not work. A published, honest test across real sites (we have one from Part 04) is cheap and none of them have it.

**Part 11, link protector.** LinkPeek only warns, it never blocks. Every warning has "Open anyway" and "Don't warn me on this site", and the list of sites you've overruled can be seen and edited in Settings. This answers Norton's most common complaint (7 of 64 reviews). Track false alarms as the plan says, because they are Norton's second most common complaint. Keep saying "No known warning", never "safe", because Norton's users also catch it missing threats.

**Part 12, annoyance filter, and Part 13, social sites.** No evidence collected. Research these at the start of those parts.

**Part 14, money.** Don't gate or nag on the core feature. DeArrow's optional payment comes up in 17 of its 36 low-star Firefox reviews. Even an optional $1 costs ratings when it feels like a hurdle. If there's ever a paid tier, the free version stays complete with no timers or reminders, and the store listing says exactly what's free. The only price point found is Merlin's, reported by third parties at about $19 to $29 a month. Merlin is a general assistant, so it says little about LinkPeek's £3 to £5 guess.

**Positioning.** Browsers show you the page. LinkPeek tells you what's in it, in 20 words, and whether the headline is honest about it. No product found does that.

## Still open

- Is Edge's "Preview link" in stable Edge today? Check Edge's release notes or a current Edge install.
- What do Chrome Web Store reviews of Merlin, DeArrow and Norton say? The store has no reviews API and its pages load reviews as you scroll.
- How do annoyance and cookie-banner blockers (Consent-O-Matic, "I still don't care about cookies", uBlock Origin's annoyance lists) handle permissions, data and ratings? Research this at the start of Part 12.
- What does Link Summarizer AI really use? Its on-device claim was refuted, so only unpacking it would tell.
- Can a headline-against-article check run on the device and be accurate enough? Part 07 measures this.

## Claims checked and refuted (don't reuse)

- That a Red Hat bug proves Chrome ships a Link Preview feature (1-2). The Chromium source answers this instead: it existed behind a flag and was removed.
- That Link Summarizer AI runs on the device with Gemini Nano (0-3), and that it collects no data and needs no key (1-2).
- LinkLooker's Chrome store figures as first extracted (0-3).
- That Peeko's privacy claims contradict its store disclosure (1-2).
- That Merlin uses OpenAI, Anthropic and Google (0-3).
- That ClickGuard's spoiler is the same idea as LinkPeek's summary (0-3).
- Two claims about AI clickbait accuracy from arXiv 2306.09597 (0-3 and 1-2).
