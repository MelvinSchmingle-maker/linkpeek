# Server-side and hosted rendering for LinkPeek

Facet: getting the rendered text of JavaScript-built pages through a server LinkPeek controls, or through a hosted service. Written 21 Oct 2026.

Method: vendor pages, terms pages and standards read with WebFetch on 21 Oct 2026. Dates in brackets are the "last updated" text the page showed. Search snippets are marked "(snippet)" and were not fetched. Nothing was cloned, installed or run. No GitHub search tool was used. The LinkPeek repo was read locally (files, plus `git show e604861`). /home/user/reports and /home/user/research_notes were not read. About 60 tool calls were made, more than the roughly 15 in the researcher guide, because the brief asked for the terms page of every named vendor.

## Project facts that frame the options

Local repo, commit f6c99c8 and later e604861:
- The backend never receives a page's address. server/README.md says it "never receives the page's address". docs/privacy.md lists "the page's address" under "LinkPeek never sends". D36 in docs/decisions.md gives the same reason.
- The rendering packages are already in the backend's package.json: @sparticuz/chromium ^153.0.0 and puppeteer-core ^25.15.0, added in commit e604861 (21 Oct 2026). No file under server/ imports them. The commit message says rendering "sends article addresses to the backend, so it stays off until the owner decides."
- The summary function sets maxDuration = 30 (server/api/summarise.ts).
- Seven of ten live test pages gave full text without running JavaScript (docs/progress.md, Part 04). Pages that fail are the minority.
- Project rules: no paywall, login or CAPTCHA bypass (handoff.md). A robot check, 403 or 429 is never retried (D24). The extension holds no API keys.

## 1. Headless Chromium on Vercel

### Takeaway

Chromium's size and memory fit Vercel's limits. The package's own README is written for AWS Lambda, and Vercel documents no Chromium support. At Vercel Pro list prices my arithmetic gives about $0.14 to $0.37 per 1,000 renders, but the CPU time per page is an assumption, not a measurement. Hobby is for personal, non-commercial use only, so it cannot carry a LinkPeek that takes money. Vercel's acceptable use policy names scraping and proxying as prohibited, which is a policy question that cost does not settle.

### Cited Findings

- Package. @sparticuz/chromium is MIT. It is "Chromium for Serverless Platforms" and is "designed to be run on a vanilla Lambda instance". Vercel is not mentioned in the README. The npm package includes only x64 binaries; arm64 needs the -min variant and a layer. [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md); [Sparticuz repo](https://github.com/Sparticuz/chromium)
- Versions. The package "does NOT follow semantic versioning" and "Breaking changes may occur at the 'patch' level." Versions track Chromium's major and minor numbers, so ^153.0.0 should track Chromium 153 (my reading of that rule). [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Size. Uncompressed Chromium is 136,964,856 bytes (130.62 MiB). The brotli file at level 11 is 34,820,408 bytes (33.21 MiB). The same README also says the brotli file is "over 50 MB", so the README contradicts itself. [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Memory. "You should allocate at least 512 MB of RAM to your instance; however, 1600 MB (or more) is recommended." [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Sandbox. The README gives no guidance on sandboxing or --no-sandbox. [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Operating notes from the same README: "Always await browser.close()"; /tmp fills on warm instances unless each run uses its own user-data directory. [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Vercel function limits with Fluid compute. Hobby: max memory 2 GB / 1 vCPU; max duration 300 s default and max. Pro: default 2 GB / 1 vCPU, max 4 GB / 2 vCPU; duration 300 s default, 800 s max, 1,800 s in beta. Uncompressed bundle limit 250 MB including layers. [Vercel Functions limits](https://vercel.com/docs/functions/limitations) [2026-08-24]; [Vercel limits](https://vercel.com/docs/limits) [2026-09-16]
- Vercel billing. Active CPU is billed only while code runs: "Waiting for I/O (e.g. calling AI models, database queries) does not count towards active CPU time." Provisioned memory is billed for the whole instance lifetime until the last in-flight request finishes. [Vercel usage and pricing](https://vercel.com/docs/functions/usage-and-pricing) [2026-06-16]
- Vercel allowances and rates. Hobby includes 4 Active CPU hours, 360 GB-hours of provisioned memory and 1 million invocations a month; the pricing page describes Hobby as "for personal, non-commercial use", and it has no paid usage beyond those caps. Pro has a $20 monthly platform fee that includes $20 of usage credit and one deploying seat. Beyond the credit: Active CPU from $0.128 per hour, provisioned memory from $0.0106 per GB-hour, $0.60 per million invocations. By region (CPU per hour / memory per GB-hour): Washington DC (iad1) $0.128 / $0.0106; Dublin (dub1) $0.168 / $0.0139; London (lhr1) $0.177 / $0.0146. [Vercel pricing](https://vercel.com/pricing); [Pro plan](https://vercel.com/docs/plans/pro-plan) [2026-09-15]; [Fair use](https://vercel.com/docs/limits/fair-use-guidelines) [2026-09-14]
- Hobby is non-commercial. "Hobby teams are restricted to non-commercial personal use only." Commercial use includes "Receiving payment to create, update, or host the site" and "Any method of requesting or processing payment from visitors of the site". "Asking for Donations does not fall under commercial usage." [Fair use](https://vercel.com/docs/limits/fair-use-guidelines)
- Spend alerts. New customers get spend notifications at $200 per billing cycle by default. The page says alerts and automatic actions at a spend threshold have to be set up separately. [Pro plan](https://vercel.com/docs/plans/pro-plan)
- puppeteer-core is Apache-2.0 and is meant to be installed "without downloading Chrome". [puppeteer repo](https://github.com/puppeteer/puppeteer)
- Playwright is Apache-2.0. Its docs list a "npx playwright install" step. [Playwright repo](https://github.com/microsoft/playwright)
- Community reports (snippet, not fetched): the default Puppeteer setup tries to download Chromium at run time, which fails on Vercel's read-only filesystem. A March 2026 Next.js discussion reports "Failed to download Chromium" 500 errors. [GitHub discussion](https://github.com/vercel/next.js/discussions/91204) (snippet)

Cost arithmetic. These are my estimates. Per-render CPU seconds and wall time are assumed. Pro rates for Washington DC: $0.00003556 per CPU second; $0.00000294 per GB-second of memory.
- Light render: 3 s active CPU, 2 GB for 5 s of instance life. About $0.00014 per render, or $0.14 per 1,000.
- Heavy render: 8 s active CPU, 2 GB for 15 s. About $0.00037 per render, or $0.37 per 1,000.
- Hobby allowances: 4 CPU hours cover about 1,800 heavy or 4,800 light renders a month. The 360 GB-hour memory allowance covers about 43,000 heavy renders. CPU runs out first.

### Inferences

- Size is not the blocker. 130.6 MiB leaves about 119 MB under the 250 MB limit. Inference: the renderer should be a separate function with no Anthropic key in its environment, so a browser compromise cannot reach the summariser's secret.
- Region changes cost. London's CPU rate is about 38% above Washington DC's. Latency and data location also depend on region.
- Vercel is a policy question first. The acceptable use policy (section 4) needs a written answer before any build.
- The main unknown is CPU per page on real news sites. Measure ten pages before choosing a host.

### Gaps

- Nothing was run. There are no measured CPU, memory or cold-start figures.
- No official Vercel page on Chromium or Puppeteer was found. The Vercel pages cover limits and billing only.
- Not checked: whether @sparticuz/chromium ^153 works with puppeteer-core ^25. The README links to Puppeteer's Chromium support page, which was not fetched.
- The npm page for @sparticuz/chromium was not fetched.
- The "one rate-limit rule on Hobby" figure is from the project's own notes (D39). It was not re-checked on Vercel's pages.

## 2. Rendering off Vercel

### Takeaway

AWS Lambda is the most direct home for @sparticuz/chromium, which is written for it. It has the lowest list price per GB-second among these options and a free tier. Cloudflare Browser Run bills per browser hour, with a $5 minimum on the Paid plan, but its docs say nothing about what it stores. A container host was not researched.

### Cited Findings

#### AWS Lambda with @sparticuz/chromium

- What it is: serverless functions. The Sparticuz README says the package "works with all currently supported AWS Lambda Node.js runtimes out of the box". [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Cost. x86 duration is $0.0000166667 per GB-second, and requests are $0.20 per million. Free tier: 1 million requests and 400,000 GB-seconds a month. The page does not say whether the free tier is permanent. Arm duration rates were not captured. [Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- Limits. Timeout 900 s. Memory 128 MB to 10,240 MB. /tmp 512 MB to 10,240 MB. Deployment package 250 MB unzipped. Default concurrency 1,000. New accounts start with reduced concurrency and memory quotas. [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- Cost arithmetic (same assumptions as section 1). 2 GB for 5 s is about $0.00017 per render. 2 GB for 15 s is about $0.0005 per render, or $0.50 per 1,000. The free tier covers about 13,300 heavy renders a month.
- Receives and keeps. The function receives the URL. AWS data-processing terms and log retention were not checked.
- Legal. The AWS Acceptable Use Policy does not name scraping, crawling or proxying. Its general clauses cover "to violate the rights of others" and "for any illegal or fraudulent activity", and AWS "may investigate any suspected violation of this Policy". The policy text says it was last updated 1 July 2021. [AWS AUP](https://aws.amazon.com/aup/)
- Licence. @sparticuz/chromium is MIT. puppeteer-core is Apache-2.0.

#### Cloudflare Browser Run (formerly Browser Rendering)

- What it is: Cloudflare's hosted headless browser. It has REST Quick Actions (for example /content, /pdf, /crawl) and Browser Sessions (Puppeteer, Playwright, CDP). The docs have moved to developers.cloudflare.com/browser-run/. Sessions run on Cloudflare's network. [Pricing](https://developers.cloudflare.com/browser-rendering/pricing/) [2026-04-21]; [Robots reference](https://developers.cloudflare.com/browser-run/reference/robots-txt/) [2026-06-16]
- Cost. Workers Paid has a $5 monthly minimum. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) [2026-10-02]. That page does not mention Browser Run, so the billing link is not confirmed. Browser hours: Free 10 minutes a day; Paid 10 hours a month included, then $0.09 an hour. Concurrent browsers: Free 3; Paid 10 included, then $2 each, per the pricing page. [Pricing](https://developers.cloudflare.com/browser-rendering/pricing/)
- Limits. The limits page gives Paid concurrency as "200 per account (default, raisable on request)" for Browser Sessions, which conflicts with the pricing page's 10 included. Other limits: new browser startups Free 1 per 20 s, Paid 3 per second; inactivity timeout 60 s, extendable with keep_alive to 20 minutes; Quick Actions Free 1 request per 10 s, Paid 30 per second; /crawl Free 5 jobs a day and 100 pages per crawl. [Limits](https://developers.cloudflare.com/browser-rendering/limits/)
- Billing unit: browser time, not request count. The pricing page says Quick Actions are "charged for browser hours only". [Pricing](https://developers.cloudflare.com/browser-rendering/pricing/)
- Cost arithmetic. A 15 s session costs about $0.00038 beyond the included hours. The 10 included hours cover about 2,400 such sessions a month.
- Receives and keeps. The docs read do not say what Browser Run stores, for how long, or where. They do not say whether content is used for training. No DPA page was found. Cloudflare's DPA and subprocessor list were not checked. [Limits](https://developers.cloudflare.com/browser-rendering/limits/)
- Robots and user agent. /crawl identifies as CloudflareBrowserRenderingCrawler/1.0, and the robots examples use that token. Quick Actions use "a different User-Agent" that is not named. The page says "robots.txt is advisory, not enforceable" and recommends Web Bot Auth signatures. It does not say whether single-page, user-requested fetches honour robots.txt. [Robots reference](https://developers.cloudflare.com/browser-run/reference/robots-txt/)
- Conflict (snippet, not fetched): a search summary of Cloudflare's changelog says /crawl honours robots.txt by default. A third-party site says the Browser Run user agent is not stable. These conflict. (snippet)
- Security. The docs read do not say whether Browser Run blocks requests to private or internal addresses. This is the most important missing fact for this option.
- Licence. Hosted service; not applicable.

#### Container host (Cloud Run, Fly.io, Render or similar)

Not researched in this pass. No pricing or terms were read.

### Inferences

Cross-option list-price comparison, per 1,000 renders, using the assumptions above (15 s heavy render unless stated). Figures are list prices, arithmetic only.

| Option | Approx. cost per 1,000 | What it bills | Note |
|---|---|---|---|
| Vercel Pro, Washington DC | $0.37 | CPU time and memory | Assumes 8 s CPU |
| AWS Lambda, 2 GB | $0.50 | Duration | Free tier covers about 13,300 heavy renders a month |
| Cloudflare Browser Run, Paid | $0.38 beyond 10 hours | Browser time | Plus the $5 minimum |
| Firecrawl, Hobby | $3.20 | One credit per basic page | JS-render cost not stated |
| Browserless, Prototyping | $1.25 | One unit per up to 30 s | Proxies and CAPTCHA solving cost extra |
| Diffbot, Startup | $1.20 | One credit per Extract page | JS render not stated |
| ScrapingBee, Hobby | $0.25 | One credit per basic request | JS-render cost not captured |
| Apify, compute only | $1.67 | 2 GB for 15 s at $0.20 per CU | Plus any actor's own fee |
| Jina Reader | Not computable | Per-token price not captured | Free tier and key details in section 3 |

- Vendors that do not state a JavaScript-render surcharge are not like-for-like with raw compute. A fair comparison needs a measured render on each option.
- Self-hosted compute is cheapest per page at these assumptions, but it carries the security and patching work in section 5.
- Cloudflare's figure is browser time, so a slow page costs more there than a CPU-only bill would show.

### Gaps

- Container host not researched.
- Cloudflare's DPA, subprocessor list and data retention were not found.
- AWS data terms and log retention were not checked. Lambda free-tier permanence is not confirmed.
- Whether Browser Run blocks private addresses is not stated in the pages read.
- Lambda arm64 pricing was not captured.
- The Cloudflare concurrency conflict (10 included versus 200 default) is unresolved.

## 3. Hosted rendering and extraction APIs

### Takeaway

Each hosted service would receive the article address and hold it under its own terms. None of the six fits a per-page, user-requested call without the owner accepting those terms. Apify's general terms are the clearest written data terms. Jina has the clearest no-training sentence, but its own page says the terms may be out of date. Firecrawl, ScrapingBee and Diffbot each reserve broad rights in submitted content or in usage data. Browserless's own terms prohibit scraping, and its licence is source-available, not permissive.

### Cited Findings

#### Jina Reader

- What it is: a URL-to-text service. You call https://r.jina.ai/ followed by the target URL. It runs the page in a headless browser by default, so client-side JavaScript executes. Setting the X-Engine header to "direct" gives a plain HTTP fetch. [Jina Reader](https://jina.ai/reader)
- Cost. Without a key: free, with a limit of 20 requests a minute per IP. With a key: 10 million free tokens for each new key, then billing on output tokens. Failed requests are not charged. The per-token price table was not in the extracted text. [Jina Reader](https://jina.ai/reader)
- Limits. The Reader table gives 500 requests a minute for a free key, 500 for paid, 5,000 for premium. The FAQ gives 100 a minute for free. The page does not resolve this. IP-based cap: 10,000 requests per 60 seconds. Average latency of 7.9 s is shown, undated. [Jina Reader](https://jina.ai/reader)
- Receives. The target URL, in the request path, and any body or headers sent.
- Keeps (terms, last modified 4 May 2026). "Jina AI will only store Input or Output on its servers to the extent required to provide the Services" (Section 4.6). "Jina AI does not use Customer request data, inputs, prompts, or uploaded content to train its models" (Section 10.4). The terms say they "may no longer reflect the current data processing practices" after Elastic's acquisition. They do not mention Reader or URLs. Website server logs are kept up to seven days (privacy text, which covers the website, not Reader). Subcontractors are allowed (Section 13.3). The business seat is in Berlin, and the website server is in the USA. [Jina legal](https://jina.ai/legal)
- DPA. The terms name the DPA inconsistently: "Elastic Data Processing Addendum" (Section 11.2) in one place and "Elastic Customer DPA" in the top notice. [Jina legal](https://jina.ai/legal)
- Legal. Section 4.4 makes the customer responsible for material submitted for processing being lawfully accessible. [Jina legal](https://jina.ai/legal)
- Security. Page scripts run on Jina's side, so the page-script risk moves to them. Their handling of private addresses is not documented in the pages read.
- Licence. Hosted. The open-source status of Reader was not checked.
- Reliability. Rate-limit figures conflict. Not measured.
- Not verified: per-token price; Reader-specific retention; whether the Section 10.4 sentence covers Reader outputs.

#### Firecrawl

- What it is: a hosted scraping API (/scrape, /crawl, /map, /search, /agent, /interact). The core is open source and self-hostable. [Firecrawl repo](https://github.com/mendableai/firecrawl)
- Cost. Free: 1,000 credits a month, 2 concurrent requests, 10 requests a minute on /scrape. Hobby: $16 a month billed annually ($19 monthly), 5,000 credits, 5 concurrent browsers, 100 a minute on /scrape. Standard $83 (100,000 credits); Growth $333 (500,000); Scale $599 (1,000,000). One credit is one page on a basic scrape. A page returning 403 or 404 still costs a credit. JSON, question or highlight formats add 4 credits per page. The page does not say whether JS rendering, stealth or proxies cost extra. [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- Receives. The URL and any content submitted.
- Keeps (terms, last revision 7 Oct 2026). Customers grant "a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, modify, publish", which is sublicensable and survives termination (Section 8.d). "After termination, we retain all rights to content as specified in this Agreement" (Section 8.f). The terms say nothing about robots.txt, paywalls, logins or AI training. [Firecrawl terms](https://www.firecrawl.dev/terms-of-service)
- Keeps (privacy, dated 26 Dec 2024). "We will retain your personally identifiable information until you request in writing that we delete." Scraped content, job logs and cached results are not addressed. Named providers: Stripe, PostHog, Crisp, Vercel Analytics. Data is transferred to the USA. No DPA or transfer mechanism is mentioned. [Firecrawl privacy](https://www.firecrawl.dev/privacy-policy)
- Legal. Terms Section 5.d.1 bars use "for any commercial purposes except as expressly authorized by Firecrawl". Governing law is California; venue is San Francisco; there is a class-action waiver and a 30-day pre-suit period (Section 11). [Firecrawl terms](https://www.firecrawl.dev/terms-of-service)
- Licence. Core is AGPL-3.0; SDKs and some UI components are MIT. Running a modified core means AGPL obligations. Flagged. [Firecrawl repo](https://github.com/mendableai/firecrawl)
- Security. Not documented in the pages read.
- Note: the pricing, terms and privacy pages each contained text addressed to AI agents (see section 6).
- Not verified: JS-render and stealth costs; retention of scraped content; AI training use.

#### Diffbot

- What it is: a web extraction API and knowledge graph. [Diffbot pricing](https://www.diffbot.com/pricing/)
- Cost. Free: 10,000 credits a month on the plan card, 9,500 on the calculator, 5 requests a minute, no overage (429 when used up). Startup: $299 a month, 250,000 credits, $0.001 per extra credit, 5 requests a second. Plus: $899, 1,000,000 credits, 25 requests a second. Extract costs 1 credit per page; the datacenter proxy doubles it to 2. JS rendering is not mentioned. [Diffbot pricing](https://www.diffbot.com/pricing/)
- Receives. The URL and any submitted content.
- Keeps (terms, undated; footer shows only "© 2026"). "This Agreement does not grant the Company any ownership rights. You grant permission to the Company to use the Materials and Data only as necessary to provide the Subscription Service." But the customer grants "an irrevocable, perpetual, nonexclusive, royalty-free and fully paid, worldwide license to 'process'" the "user-submitted queries or data enhance requests", where "process" includes reproduce, distribute, prepare derivative works and disclose. The terms do not mention AI training either way. [Diffbot terms](https://www.diffbot.com/company/terms)
- Keeps (privacy, last updated 29 Aug 2025). During use Diffbot collects "API calls" and "query history" and "associate[s] it with your API key". No retention period is given for API data. "Subscriber tracking is used to improve the Services and Site." Named providers include Plausible, Amplitude, AWS, Intercom, Slack, Stripe and others, all said to be in the USA. [Diffbot privacy](https://www.diffbot.com/company/privacy)
- Inference: because query history is kept against the API key, a submitted URL is probably stored. The policy does not say so directly.
- DPA. The privacy policy refers to DPAs with service providers only. A search snippet says Diffbot offers a DPA on request at privacy@diffbot.com. Not confirmed on a fetched page. (snippet)
- Legal. Governing law is federal US law and California law; disputes go to AAA consumer arbitration in Palo Alto. The terms' crawling ban covers Diffbot's own site, not third-party sites. [Diffbot terms](https://www.diffbot.com/company/terms)
- Licence. Hosted.
- Not verified: API input retention; training use; JS-render cost; DPA availability.

#### Browserless

- What it is: hosted headless Chrome. There is also a self-hostable Docker image (ghcr.io/browserless/chromium). [Browserless GitHub](https://github.com/browserless/browserless)
- Cost. Free: $0, 1,000 units a month, 2 concurrent browsers, 2-minute sessions. Prototyping: $25 a month, 20,000 units, $0.0020 per extra unit, 10 concurrent, 15-minute sessions. Starter: $140, 180,000 units, $0.0017. Scale: $350, 500,000 units, $0.0015. One unit covers up to 30 seconds of browser time per connection; a reconnect counts again. Residential proxy: 6 units per MB; datacenter proxy: 2 units per MB. Automatic CAPTCHA solving: 10 units per solve, listed on the Free plan. Rate limits are not stated. Stealth is not mentioned. [Browserless pricing](https://www.browserless.io/pricing)
- Receives. The URL, and any page content returned.
- Keeps (privacy policy). The policy covers website visitors and subscribers. It does not address URLs or page content sent through the API. It says "Browserless does not monitor, store, retain, or resell the content of the pages you visit", but does not say whether this covers API calls. Session metrics are "not retained long-term", with no period given. Named processors: Stripe, SendGrid, DigitalOcean, Fathom. No DPA is mentioned. Data location is not stated. [Browserless privacy](https://www.browserless.io/privacy-policy)
- Legal (terms, undated). Section 11 lists as prohibited "to spam, phish, pharm, pretext, spider, crawl, or scrape". Section 11(k) bars "to interfere with or circumvent the security features of the Service". The site's navigation labels its scraping offer "Extract data without getting blocked", which the terms do not reconcile. Governing law is a Battle Ground, Washington address. [Browserless terms](https://www.browserless.io/terms-of-service)
- Licence. "SPDX-License-Identifier: SSPL-1.0 OR Browserless Commercial License". Free for non-commercial use; commercial or closed-source CI needs a commercial licence. SSPL is source-available, not one of the permissive licences the project prefers. Flagged. [Browserless GitHub](https://github.com/browserless/browserless)
- Security. CAPTCHA solving and residential proxies are features the project's no-evasion rule excludes. They must stay off.
- Not verified: rate limits; stealth features; DPA; retention of API inputs.

#### ScrapingBee

- What it is: a hosted scraping API with JS rendering and proxy rotation. The company is named as VostokInc in its terms and privacy policy. [ScrapingBee pricing](https://www.scrapingbee.com/pricing/)
- Cost. A trial gives 1,000 credits with no ongoing free plan. Hobby: $19 a month, 75,000 credits, 25 concurrent requests. Freelance $49 (250,000); Startup $99 (1,000,000); Business $249 (3,000,000); higher tiers to 120,000,000. The credit cost of JS rendering and premium proxies is not in the extracted text. The page says "ScrapingBee API handles headless browsers and rotates proxies for you" and describes an "Auto-mode" that "picks the configuration that successfully scrapes your page". A fallback of that kind is what the no-evasion rule excludes. [ScrapingBee pricing](https://www.scrapingbee.com/pricing/)
- Receives. The URL and any returned content.
- Keeps (terms, last updated 15 July 2024). The customer "owns all rights, title, and interest" in its User Data. The provider may use User Data "for purposes of operating, analyzing, improving, or marketing the Services and any related services" (Section 16). It may create derivative works of anonymised, aggregated data "during and after the term". The terms do not mention AI training. [ScrapingBee terms](https://www.scrapingbee.com/terms-and-conditions/)
- Keeps (privacy, effective 15 July 2024). "VostokInc archives and logs all actions performed on the API by the User's employees" (Section 6). No retention period for API logs. Scraped content is not addressed. No subprocessors are named. Hosting is said to be "in the United States, the European Union" and in France (Section 10). The DPA page is linked but was not read. [ScrapingBee privacy](https://www.scrapingbee.com/privacy-policy/)
- Legal. "Websites may expressly prohibit scraping." Customers must check each target site and must get authorisation when unsure (Section 6). Section 12 requires scraping to be "duly authorized by the applicable terms and conditions of the targeted databases, websites, or other sources". The site-terms question therefore sits with LinkPeek. [ScrapingBee terms](https://www.scrapingbee.com/terms-and-conditions/)
- Snippet, not verified: a GDPR notice says logs go to Datadog and are removed after fourteen days. (snippet)
- Licence. Hosted.
- Not verified: JS and premium-proxy costs; DPA terms; log retention on the policy page.

#### Apify

- What it is: a hosted platform that runs "Actors", which are scrapers written by Apify or by third parties. Each actor has its own terms and price. [Apify pricing](https://apify.com/pricing)
- Cost. Free: $5 of platform credit a month, up to 16 GB RAM and 5 concurrent runs. Access is blocked until the next cycle once prepaid usage runs out. Starter: $19 a month including $19 of usage, $0.20 per compute unit (CU). Scale: $199 ($0.16 per CU). Business: $999 ($0.13 per CU). One CU is 1 GB of RAM for one hour. Actor prices are set by the actor's author, either per event or per usage. [Apify pricing](https://apify.com/pricing)
- Receives. The URL goes to the actor as input. If the actor is a third party's, its author may see it.
- Keeps (General Terms, effective 9 July 2026). The customer keeps "all right, title, and interest" in Customer Data (Section 5.8). Apify holds "a limited, non-exclusive, revocable, worldwide, royalty-free right to transmit" Customer Data "to enable us to provide and improve Services during the Agreement term" (5.8). "Your inputs and the resulting outputs are not used to train any foundation model" (5.10). Apify may delete Customer Data under its retention policies (15.6). Usage Data belongs to Apify (5.9). [Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions)
- Snippets, not fetched: Apify keeps the ten most recent runs indefinitely and deletes older runs with their storage. Depending on the permission granted, Apify may pass account information and Customer Data to an actor's Creator, and Creators are not Apify subprocessors. (snippets from Apify's legal pages)
- Legal. The customer must process only data it is authorised to access (6.2). Third-party services are subject to their own terms (5.4). The customer must follow the Acceptable Use Policy (6.1), which was not read here. [Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions)
- Licence. Depends on each actor. Check each one.
- Security. A community actor is third-party code that receives the URL. Apify disclaims liability for access by an actor or Creator that the customer permitted.
- Not verified: run retention on the fetched pages; the Actor Terms and AUP scraping clauses; which actors (if any) render pages well.

### Inferences

- Per-page prices in the section 2 table are the only cross-vendor comparison available. They are not like-for-like, because several vendors do not price JS rendering.
- For data terms, Apify is the clearest on ownership, no-training and deletion. Jina is the clearest on training, but flags its own terms as possibly stale. ScrapingBee and Firecrawl reserve the widest rights in submitted content.
- If an actor or any other third party sits between LinkPeek and the page, that party sees the URL too. Treat each as a processor.
- Vendors push the site-terms duty back to the customer (ScrapingBee Sections 6 and 12; Apify Sections 5.4 and 6.2; Browserless Section 7). LinkPeek would carry that duty.

### Gaps

- Not verified for any vendor: whether a URL is logged in its request logs. Only the policies were read, not the systems.
- Jina per-token price; Firecrawl JS and stealth costs; ScrapingBee JS and premium-proxy costs.
- Diffbot API-input retention and DPA availability.
- Browserless rate limits and whether stealth features exist.
- Apify retention of runs (snippet only) and actor-level terms.
- Whether any of these services blocks private or internal addresses. None of the pages read says so.

## 4. Legal and site-level rules

### Takeaway

The legal questions are mostly about data and host policy, not about rendering. Four points stand out. First, the project's own privacy promise ("never the page's address") would change. Second, the Chrome Web Store Limited Use rule restricts sending web browsing activity off the device unless it is a prominently disclosed user-facing feature. Third, Vercel's acceptable use policy bans customers from scraping and proxying. Fourth, robots.txt is not access control, and vendors disagree on whether user-initiated fetches have to honour it. I could not read talkSPORT's site rules, and I could not settle site-by-site terms in general.

### Cited Findings

- robots.txt is not access control. RFC 9309 says: "These rules are not a form of access authorization." Its scope is "crawlers" and "services that provide resources that clients can access through URIs". It does not address user-triggered clients. [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)
- OpenAI, ChatGPT-User. "Because these actions are initiated by a user, robots.txt rules may not apply." The page is undated. It was reached by redirect from platform.openai.com/docs/bots. [OpenAI bots](https://developers.openai.com/api/docs/bots)
- Google. The overview says Google's common crawlers "always respect robots.txt rules for automatic crawls". Its only user-triggered example is Google Site Verifier, which "acts on the request of a user". The page does not say whether user-triggered fetchers follow robots.txt. [Google crawlers](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers) [2026-06-12]. Google's robots.txt intro page has no statement on user-triggered fetchers. [Google robots intro](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- Cloudflare. "robots.txt is advisory, not enforceable." It recommends WAF rules or Web Bot Auth for enforcement. [Cloudflare robots reference](https://developers.cloudflare.com/browser-run/reference/robots-txt/) [2026-06-16]
- Chrome Web Store, Limited Use. "Collection and use of web browsing activity is prohibited, except to the extent required for a user-facing feature" that is "described prominently in the Product's Chrome Web Store page and in the Product's user interface." Transfers to third parties are allowed only "If necessary to providing or improving your single purpose", to comply with law, or to protect against "malware, spam, phishing, or other fraud or abuse". The rules cover derived and anonymised data too. An affirmative statement of compliance must be on the extension's website. Page last updated 1 Nov 2022. [Chrome Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- Vercel acceptable use policy (last updated 21 Apr 2026), Section 2. Customers "may not, and must not allow their users or third parties, to": "Scrape, proxy, act as a VPN, or host media for hot-linking"; "Create an undue burden on Vercel's or third party's websites, infrastructure, services or networks"; and "Circumvent Vercel's Fair Use Guidelines, rate limits, or security measures". [Vercel AUP](https://vercel.com/legal/acceptable-use-policy). The fair-use page says "Circumventing or otherwise misusing Vercel's limits or usage guidelines is a violation of our fair use guidelines." [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)
- AWS Acceptable Use Policy. No scraping or proxy clause. General clauses cover violating "the rights of others", "illegal or fraudulent activity", and "the security, integrity, or availability" of others' systems. [AWS AUP](https://aws.amazon.com/aup/)
- Vendor terms put site-terms duties on the customer. ScrapingBee: "Websites may expressly prohibit scraping" (Section 6). Browserless: "Please review carefully the third-party's policies and practices" (Section 7). Apify: "Any use of Third-Party Services is subject solely to the terms and conditions of the applicable third party" (5.4). [ScrapingBee terms](https://www.scrapingbee.com/terms-and-conditions/); [Browserless terms](https://www.browserless.io/terms-of-service); [Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions)
- Project rule. "A refusal (403), a rate limit (429) or a robot check is never retried. Asking again is how a scraper behaves." (docs/decisions.md, D24). The privacy file says LinkPeek "never tries to get round a paywall, login or robot check" (docs/decisions.md, D27).
- talkSPORT. The robots.txt fetch failed with "Claude Code is unable to fetch from talksport.com". Its terms were not found. Not confirmed.

### Inferences

- For a single fetch that the user asked for, the strongest published vendor position (OpenAI) is that robots.txt "may not apply". Google's public text is silent on this. The project's own stop rules are the safer design: stop at any refusal, obey 429 and Retry-After, and never retry a robot check. Whether an explicit robots.txt Disallow for LinkPeek's user agent should stop a fetch is a decision for the owner.
- A server render that sends a URL off the device changes LinkPeek's Chrome Web Store position. Whether "peek at this link" is a user-facing feature that justifies the transfer is a judgement. I did not settle it. If yes, the store listing and the privacy page must say so first.
- Vercel's policy text names "scrape" and "proxy" directly. A user-triggered fetch could be argued either way. Treat Vercel as a policy risk until Vercel answers in writing.
- Headless browsers meet bot checks more often than an ordinary browser does. The stop rules then mean more "couldn't read" results, not fewer. Inference, not measured.
- Processor contracts. I did not check UK GDPR text, ICO guidance, or UK case law on automated access. The owner needs advice before adding a processor that receives URLs.

### Gaps

- talkSPORT robots.txt and terms: not reachable.
- Site-level terms for the other three links were not checked.
- Google's position on user-triggered fetchers and robots.txt: no explicit text found.
- Cloudflare's rules for single-page, user-requested fetches are not stated.
- Vercel's reading of the AUP for user-triggered fetches: not answered in any page read.
- Chrome Web Store User Data FAQ and any newer Limited Use text were not checked.
- UK law and ICO guidance: not checked.

## 5. Security for a server that fetches arbitrary URLs

### Takeaway

A rendering server runs untrusted JavaScript and makes requests from inside a browser, to any address the server can reach. The check on the first URL is not enough. The guard has to sit wherever each request is made: the first URL, every redirect, every subresource, every WebSocket. OWASP's core list applies: resolve and check every address, connect to the checked address, block private, loopback, link-local and metadata ranges, and re-check redirects.

### Cited Findings

- DNS rebinding. "Domain allowlisting alone does not prevent DNS rebinding." Check every A and AAAA result, and "ensure the HTTP client connects only to validated addresses." "A second, unchecked DNS lookup between validation and connection can bypass these checks." [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Minimum block list (OWASP): cloud metadata 169.254.169.254 and metadata hostnames; loopback 127.0.0.0/8, 0.0.0.0/8, ::1/128; private 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16; IPv6 unique-local fc00::/7 and link-local fe80::/10; multicast 224.0.0.0/4 and ff00::/8. [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Lists. "Deny-lists are bypass-prone. Prefer allow-lists." For open-ended destinations, the sheet says allow-lists "cannot be used here". [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Input. Accept only HTTP and HTTPS. "Do not accept complete URLs from the user." "Reject a URL whose host is not read identically by every parser in play." [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Redirects. The sheet says to disable redirect following in the client. It does not describe re-validating each hop. Port restrictions and response-size limits are not covered in depth. [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Network. Segment the service's network and filter outbound flows at the network level. [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Metadata on AWS: "migrate to IMDSv2 and disable old IMDSv1." [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Sparticuz operating notes: close browsers even when a script errors; use a unique user-data directory per run. The README says nothing on sandboxing. [Sparticuz README](https://raw.githubusercontent.com/Sparticuz/chromium/master/README.md)
- Current in-browser fetch limits (D24, D25): 8 s timeout, 3 MB of HTML, no cookies, no referrer, one retry only after a dropped connection or timeout. Those limits apply to the extension's own fetch, not to any server.
- Vercel's default spend setting is a notification at $200 per billing cycle. Automatic actions at a threshold must be set up separately (Pro plan page).

### Inferences

- Chromium resolves names itself, follows its own redirects and loads subresources. A check in Node on the first URL does not cover any of that. Each request must be checked where Chromium makes it (request interception), or sent through an egress proxy that enforces the same rules. This is an engineering inference from how browsers work. I did not read the Puppeteer or Playwright interception API.
- Put the renderer in its own function with no secrets in its environment, separate from the summariser.
- Limit what the browser can do: service workers off, downloads off, file: and other non-HTTP schemes refused, popups refused, a fresh profile for each request, a memory cap, a hard time limit that kills the process, and caps on subrequests and bytes.
- Page scripts can use CPU and memory for free. On per-CPU-second billing that is a cost risk. Set a per-request time limit and a platform spend cap, not only a notification.
- Chromium must track current releases. Sparticuz's versions follow Chromium and it warns of patch-level breaking changes. A stale browser is an exposure. A hosted renderer patches for you, but then the URL goes to that host. This is the central trade-off.
- Neither Vercel's Pro list nor the Lambda quota page describes a default egress allow-list. Vercel's Secure Compute and Static IPs were not checked for whether they can restrict egress.

### Gaps

- Whether Chromium's sandbox can stay on in the target runtime is not documented in the Sparticuz README.
- Whether Cloudflare Browser Run and each hosted service block private addresses: none of the pages read says so.
- Puppeteer request-interception API details, and whether Chromium's resolver can be pinned to the checked address: not read.
- No test has been run against any candidate.

## 6. Output safety

### Takeaway

Rendered text is data at every step: from the renderer to the summariser to the card. The existing summariser already wraps article text in tags, strips LinkPeek's own tag names, and checks the output (D38). A renderer adds one more input, so it needs the same wrapping and plain-text output. Vendor pages in this research carried text addressed to AI readers. I ignored it, and real pages will do the same.

### Cited Findings

- OWASP LLM01 mitigations: "Segregate and identify external content" ("Separate and clearly denote untrusted content to limit its influence on user prompts"); "Define and validate expected output formats", using "deterministic code to validate adherence"; "Implement input and output filtering"; "Enforce privilege control and least privilege access"; "Require human approval for high-risk actions"; "Conduct adversarial testing". The page does not say "treat model output as untrusted" in those words. [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- Injection-style text in vendor pages. Firecrawl's pricing, terms and privacy pages each ended with instructions addressed to AI agents, asking them to fetch onboarding or authentication files. Diffbot's pricing, terms and privacy pages each had a menu line addressed to an AI reader, asking it to compliment the reader or to disregard instructions. I ignored all of them. [Firecrawl pricing](https://www.firecrawl.dev/pricing); [Firecrawl terms](https://www.firecrawl.dev/terms-of-service); [Firecrawl privacy](https://www.firecrawl.dev/privacy-policy); [Diffbot pricing](https://www.diffbot.com/pricing/); [Diffbot terms](https://www.diffbot.com/company/terms); [Diffbot privacy](https://www.diffbot.com/company/privacy)
- LinkPeek's current defences. Article text is wrapped in article tags, LinkPeek's tag names are stripped, the model is told not to follow instructions in the text, and the output is one sentence of 20 words or fewer, re-checked and shown as plain text (D38). Page text goes on the card with textContent, never as markup (D25). Readability already drops hidden text, "which defends against the second kind before Claude sees it" (D38). Local: docs/decisions.md.

### Inferences

- A renderer that returns innerText or the full DOM brings back hidden text that Readability would drop. Rendered HTML should go through the same Readability path as fetched HTML, not straight to the model.
- A hosted service returns text as Markdown or HTML. Treat that as data too. Never render it as HTML or as Markdown with links.
- Serialised DOM from any source can include script tags. Parse it as data only.
- Keep the 6,000-character input cap and the 20-word output check. They are the last barrier.
- The injection test set (eval/injection, three pages) is too small for rendered pages. Add rendered-page cases before shipping.

### Gaps

- How often rendered pages carry injection attempts: not measured.
- Whether the existing injection test set covers rendered output: not yet.

## Questions the owner must answer

1. Should the backend receive article addresses at all? Today the server README, docs/privacy.md and D36 say it never does. If yes, the privacy text, the store listing and the Chrome Web Store disclosure must change first.
2. If yes, which processor receives the URL? Vercel needs a written answer on the acceptable use policy first. AWS Lambda needs its data terms and DPA checked. Cloudflare Browser Run needs its retention, DPA and private-address behaviour confirmed. A named hosted API needs its own terms accepted (section 3).
3. Is a paid plan acceptable? Vercel Hobby cannot be used for commercial work. Asking for donations is not commercial under Vercel's rule. Taking payment for the site is. LinkPeek earns nothing today.
4. Confirm the no-evasion rule in writing: rendering stops at a robot check, login or paywall, with no stealth, CAPTCHA solving or proxy rotation. That rules out Browserless's residential proxies and CAPTCHA solving, and ScrapingBee's Auto-mode, unless those are switched off.
5. Should a robots.txt Disallow for LinkPeek's user agent stop a user-requested fetch? Vendors differ. OpenAI says robots.txt "may not apply" to user-initiated actions. Google's public text is silent on user-triggered fetchers. RFC 9309 addresses crawlers.
6. Is "peek at this link" a user-facing feature that justifies sending the URL under the Chrome Web Store Limited Use rule? If yes, what does the store listing and the privacy page say?
7. Who signs the processor contracts (DPAs), and who answers requests about data? This needs a lawyer's view under UK data-protection law, which I did not check.
8. Should the unused @sparticuz/chromium and puppeteer-core lines in server/package.json (added in e604861, 21 Oct 2026) stay or go until a decision is made?
9. Should written questions go to vendors? Suggested: Vercel (is a user-triggered fetch "scrape" or "proxy" under AUP Section 2?); Cloudflare (Browser Run retention, DPA, private-address blocking, and the concurrency figures); Jina (is the Section 10.4 no-training clause current, and does it cover Reader?); Diffbot (API-input retention and training use); ScrapingBee (what "improving or marketing" covers); Apify (run retention and Creator access).
10. Should rendering be opt-in in Settings, off by default, like "LinkPeek's AI" (D35)?
11. Should the team run a measurement first? Ten JavaScript-built pages, including the talkSPORT article, would show how many failing links need JavaScript, how long a render takes and how much CPU it uses. The test sends real article URLs to whichever host is used, so it needs the owner's approval.
