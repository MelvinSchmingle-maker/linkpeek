# Initial audit (13 Oct 2026)

**Starting point:** an empty folder. LinkPeek was briefly drafted inside an unrelated project (the Sausage Dog website), then moved out on request so the two stay separate. Nothing from that project is reused.

**What exists:** the build plan in `build-plan/` (the master brief split into 14 parts).

**What works:** nothing yet. There is no earlier code to reuse.

**What's missing:** everything in the plan.

**What looks hard, in order of risk:**
1. Reading the article at all. Many sites block automated requests, need a login, or build the page with JavaScript. A Chrome extension can fetch other sites only with host permission for them, and a news front page links to many different sites. This is the biggest question for the product and Part 04 measures it.
2. Getting permissions right. Asking for "all websites" up front is simplest but scares users and gets extra Chrome Web Store review. Asking per site is friendlier but adds steps. See `docs/permissions.md`.
3. Accurate summaries in 20 words without making things up. Mitigated by enforcing the limit in code and labelling how much was read.
4. Clickbait judgments that are fair to publishers. A false "cross" does real damage, so the detector is tuned to say "not sure" often.
5. Social platforms. Each has its own rules and access limits. Some may not be possible.

**Sequence:** follow `build-plan/` in order. Parts 01 to 05 need no money or accounts.
