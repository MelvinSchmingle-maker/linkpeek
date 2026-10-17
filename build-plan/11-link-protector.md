# Part 11. Link protector

## Goal
Warn about links that look dangerous or misleading. Never claim a link is safe.

## The five outcomes (exact wording in the UI)
- **Known threat detected** (only from a real threat-intelligence source)
- **Suspicious destination**
- **Goes somewhere different from what it shows**
- **No known warning** (with a small note: "This isn't a guarantee of safety.")
- **Not checked**

## From the competitor research
Norton Safe Web (4 million users, rated 2.7) checks every page against a server and blocks. Its most common complaint in Firefox reviews is that you can't overrule it (7 of 64 written reviews), then false alarms on safe sites (6), then missing real threats (3). So:
- LinkPeek warns. It never blocks a page or a download.
- Every warning has "Open anyway" and "Don't warn me on this site". Sites you've overruled are listed in Settings, where you can remove them.
- Keep "No known warning", never "safe": even a big reputation service misses things.

## Build, stage 1: free, on-device
In `src/core/security/`:
- **Text vs destination**: link text that looks like a URL or brand ("paypal.com", "Your bank") but points to a different registrable domain. Use the Public Suffix List to get registrable domains right (`bbc.co.uk`, not `co.uk`).
- **Lookalikes**: punycode or mixed-script hostnames, edit distance to a list of commonly impersonated domains (banks, mail, big shops, government), brand names in subdomains (`paypal.com.secure-login.xyz`).
- **Risky patterns**: raw IP addresses, `@` in URLs, very long hostnames, known URL shorteners (flag as "destination hidden").
- **Downloads**: links to executable or archive files.
- **Login and payment imitation**: destination path looks like a login or payment page on an unrelated domain.
- **Redirects**: when the user asks to check, follow redirects with HEAD or GET, no cookies, bounded hops (max 5), and report each hop and any domain change.

## Build, stage 2: threat lookup (needs a decision from you)
Research current options and write a comparison in `docs/security-services.md`: Google Safe Browsing (check whether its current terms allow commercial use, or whether the paid Web Risk API is required), and alternatives. For each: cost, commercial terms, what URL data is sent, privacy impact. Recommend one. Don't integrate until I approve. Any key goes on the backend, never in the extension.

## Backend URL fetching, if used
If redirect checks or any URL fetching move to the backend, implement SSRF protection first, with tests:
- http and https only
- resolve DNS and block private, loopback, link-local, metadata and reserved IP ranges (IPv4 and IPv6)
- re-check every redirect hop
- size and time limits; no cookies or auth headers forwarded
- tests for malformed URLs, `localhost` tricks, decimal or hex IPs, DNS rebinding, and redirects to internal addresses

## Done when
- Unit tests with at least 50 labelled URLs (lookalike, mismatch, clean, shortener, IP, punycode).
- Clean, popular domains don't get flagged (track the false positive rate).
- No result anywhere says "safe".
- "Open anyway" and "Don't warn me on this site" work on every warning (Playwright test), and the overruled sites can be removed in Settings.

## Your check
Try it on a few phishing examples from public training sites (for example, the phishing quiz pages run by security companies). Then try it on 20 links you trust. Any false alarm there is a bug.
