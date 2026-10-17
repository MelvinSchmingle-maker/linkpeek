# Link protector, stage 2: threat lookup (comparison, not built)

Part 11 stage 2 asks a threat-intelligence service whether a link's address is
known to be bad. It is **not integrated**. Nothing in the extension or the
backend calls any of these services. The plan says: research first, then
approval before any integration. This file is that research.

Stage 1 (on-device checks, `src/core/security/`) is built and tested. Its
outcomes can't say "Known threat detected", because that needs a threat list.
That outcome stays in the card's wording, and only a service below could feed it.

## What was checked, and when

Checked on 17 Oct 2026 from the official pages. Where a page couldn't be read
in full, that is marked, and the figure is not given.

| Service | Source checked | Result |
|---|---|---|
| Google Safe Browsing | https://developers.google.com/safe-browsing/v4/terms (page says "Last modified: Jul 24, 2019") | Read in full |
| Google Web Risk | https://cloud.google.com/security/products/web-risk and /web-risk/pricing | **Pages came back truncated. Prices not verified.** |
| URLhaus (abuse.ch) | https://urlhaus.abuse.ch/api/ | Read |
| VirusTotal | https://docs.virustotal.com/reference/public-vs-premium-api | Read |
| PhishTank | https://phishtank.org/api_info.php | Read; the page doesn't say whether new keys are issued |

## The comparison

### Google Safe Browsing (Lookup API v4)

- **Cost:** free of charge.
- **Commercial use: not allowed without a separate agreement.** The terms say:
  "Unless you have a separate agreement with Google, you may not use the Safe
  Browsing API for commercial purposes."
- **If it is used**, the product must show attribution and a notice before first
  use and with each warning: "the reliability and accuracy of the service cannot
  be guaranteed". Google's name can't appear on warnings about sites that aren't
  on Google's list.
- **Freshness:** a listed URL may only be flagged if the app received updated data
  from Google in the past 30 minutes.
- **Data sent:** not confirmed from the terms page. Check the API reference before
  deciding.

**Verdict for LinkPeek:** not usable for a product that earns money. Possibly
usable for a free, non-commercial version, but only with the attribution and
notice above. Ask Google before relying on it.

### Google Web Risk (paid API)

- **Cost:** the search summary said the Lookup API has a free monthly allowance and
  then a per-1,000-call price. **That was not confirmed from the page.** Look at
  https://cloud.google.com/web-risk/pricing before relying on any number.
- **Commercial use:** Web Risk is Google Cloud's API for products like this and
  is the usual route when Safe Browsing's terms rule out commercial use. Its own
  terms were not read here.
- **Data sent:** not confirmed here. It needs a Google Cloud account and a billing
  account, both of which are accounts and money decisions for the owner.

**Verdict for LinkPeek:** the likely candidate for a paid product, once the price
and terms are read on the official pages. Needs the owner's decision (accounts and
money, per the ground rules).

### URLhaus (abuse.ch)

- **Cost:** free. A free Auth-Key is needed, from the abuse.ch Authentication
  Portal (auth.abuse.ch). The key goes in the request.
- **Terms:** "This API is available free of charge under the fair use principles."
  Commercial or for-profit use "may require a paid subscription for the enhanced
  abuse.ch commercial API."
- **Rate limits:** no numeric request quota is given. For the database dumps the
  page asks for no more than one fetch every five minutes.
- **Data sent:** a lookup sends the address to abuse.ch. The page doesn't say more.
  The data licence isn't stated on the visible page.

**Verdict for LinkPeek:** a free candidate for a non-commercial trial. Commercial
use would need the paid abuse.ch subscription, which the owner would need to
approve and price.

### VirusTotal (public API)

- **Cost:** free key.
- **Commercial use: forbidden on the public API.** "The Public API must not be
  used in commercial products or services." It also can't be used in business
  workflows that do not contribute new files.
- **Limits:** "limited to 500 requests per day and a rate of 4 requests per
  minute."
- **Premium:** paid, and the page doesn't restrict commercial use the same way. Its
  price and terms were not read here.

**Verdict for LinkPeek:** not usable on the public API for a product. Premium is a
paid decision for the owner, with its terms read first.

### PhishTank

- **Cost:** free, but a key is recommended. Without a key the rate is much more
  limited, and "you will get a higher limit by using a valid API key".
- **Registration:** the page doesn't say whether new keys are being issued. Other
  sources say new-user registration was switched off in 2020 and is being rebuilt.
  Not confirmed here.
- **Commercial use:** the API page contains no commercial-use wording and no data
  licence. Its Terms of Use weren't in the content read.
- **Other conditions:** a descriptive User Agent is required; over the limit the
  service returns HTTP 509.

**Verdict for LinkPeek:** not a dependable option until the registration status
and terms are confirmed directly with PhishTank.

## Recommendation

1. **Do not integrate any of them yet.** Each one either forbids commercial use on
   the free tier, has unclear terms, or isn't confirmed.
2. **If the owner wants a lookup for a free, non-commercial test:** URLhaus, with a
   free key and fair use. It's the cleanest of the free options read here.
3. **If the owner wants a product that can earn money:** the owner should choose
   between paid Google Web Risk (after reading its price and terms on the official
   pages) and a paid abuse.ch subscription. Both need an account and a budget, so
   both wait for the owner.

## Privacy, whichever service is chosen

A lookup sends each address that the user asks about to a third party. That's
different from stage 1, which never sends anything. If stage 2 is built:

- It must be opt-in and off by default, with the setting described in
  `docs/privacy.md` before it ships.
- Any key lives on the backend, never in the extension (ground rules).
- The extension must not send cookies or logins to the service.

## Other notes

- **Redirect checks** (part of stage 1, `src/background/redirects.ts`) don't use any
  of these services. They ask the link's own site, when the user presses the
  button. Chrome doesn't show an extension each redirect along the way, so only the
  final address is known. Chrome decides how many redirects to follow, so
  LinkPeek can't enforce its own limit of five. The plan asked for both; neither is
  possible in the extension, and that's recorded in `docs/decisions.md` (D54).
- **Backend URL fetching:** none. If it's ever moved to the backend, the plan's
  SSRF protection is required first.
