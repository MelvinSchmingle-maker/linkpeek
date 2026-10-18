# Permissions

LinkPeek asks for as little as possible. This file lists every permission, why it's needed, and what Chrome shows the user.

## Current (Part 04)

| Permission | Why | Warning shown at install? |
|---|---|---|
| `storage` | Save your settings (mode, sites turned off, demo toggle) and feedback votes in your browser. | No |
| `activeTab` | When you click the toolbar button, choose "Peek at this link" from the right-click menu, or press the shortcut, LinkPeek can work on that one tab until you leave the page. No standing access to any site. | No |
| `scripting` | Lets LinkPeek put its icon and card into a page, only on pages it already has access to. Also used to register "run on the sites I turned on". | No |
| `offscreen` | A hidden page where LinkPeek reads fetched articles and PDFs (service workers can't parse HTML). It shows nothing and closes after 2 minutes without work. | No |
| `contextMenus` | Adds "Peek at this link with LinkPeek" to the right-click menu on links. | No |
| `optional_host_permissions` (`https://*/*`, `http://*/*`) | Not granted at install. When you press "Turn on" for a site in the popup, or "Allow access…" on a card for a link to another site, Chrome asks you to allow that one site. For an X post's card, the same prompt also covers X's link shortener, t.co. "Turn on for all websites" in Settings, or "Allow all websites" in the access window, asks for all sites at once. | Not at install. Chrome shows its own prompt when you turn a site on. |
| `declarativeNetRequest` | Lets LinkPeek refuse its own requests to this computer and the local network, including the hops of a redirect, before they are made. It applies to LinkPeek's requests only: ordinary web pages are not affected. Code: `src/background/local-rule.ts`. Not in the test builds. | Yes. Chrome shows a warning for this permission when LinkPeek is installed. We have not yet captured the exact wording from a packed build (unpacked extensions show no warning), so the store text should quote it once it's checked. |

The keyboard shortcut (`commands` in the manifest, Alt+Shift+P by default) is not a permission and shows no warning. Chrome may leave it unassigned if another extension already uses that key. You can set it at `chrome://extensions/shortcuts`.

Limits worth knowing: Chrome never lets extensions run on its own pages or the Chrome Web Store, even with access to all sites, and the popup says so there. Right-click peeks and the shortcut work in frames from the same site; a link inside a frame from another site can't be reached with one-tab access (`activeTab` covers the tab's own site); LinkPeek shows a "?" on its toolbar button for a few seconds when a peek can't work.

**After installing, LinkPeek has access to no websites at all.** It only works on a page when you click it, right-click a link, use the shortcut, or turn it on for that site.

### How "turn on for this site" works
1. Popup > This site > **Turn on**. Chrome asks: allow LinkPeek to read and change data on this site?
2. If you allow it, the service worker registers LinkPeek's script for exactly the sites you've allowed (one registered script, its list of sites kept in step with what Chrome has granted). It starts straight away on open tabs of that site.
3. **Turn off** gives the access back to Chrome (and stops LinkPeek on the open page at once). If the access came from "all websites", LinkPeek can't give back one site, so it remembers the site as "turned off" and doesn't run there.

## Test build only

`npm run test:e2e` builds a separate test version (`dist-e2e/`, named "LinkPeek (test build)") with access to `http://127.0.0.1` only, so automated tests can run on the local test pages without a permission prompt nobody can click. It is never the version you install or publish.

## AI summaries (Part 06)

No new permission. LinkPeek's server allows requests from any origin without cookies (CORS), so the extension can call it without site access, and Chrome shows no new warning. Like everything else, the request goes out without cookies or a referrer.

## Reading articles (decided in Part 04)

Reading an article means fetching it, and an extension can only fetch from sites it has access to. See `docs/decisions.md` D24 for the full reasoning. In short:

- A link to the same site as the page you're on: fetched by LinkPeek's script in that page. No extra permission.
- A link to another site: the card says "LinkPeek needs your permission to read pages on example.com" and offers **Allow access…**. That opens a small LinkPeek window, then Chrome's own prompt. Allowing a site also turns LinkPeek on there.
- An X post's link card: the card names the site its link goes to. One prompt asks for that site and for t.co, X's link shortener, which LinkPeek opens only for that card. Any other site reached on the way gets no request (D66).
- No LinkPeek server is involved. The article's own website sees the request, from your browser, without your cookies or login.

The live-check build (`dist-live/`, made by `node scripts/build.mjs --live`) has access to all sites so `scripts/live-check.mjs` can read real pages without a prompt. Like the test builds, it is never the version you install or publish.

## The network-rule permission, in plain words (18 Oct 2026)

LinkPeek asks Chrome for one extra permission: `declarativeNetRequest`. It has one job. It stops LinkPeek itself from requesting addresses on your own computer or your local network, including through a redirect. It doesn't change how other websites behave, and it doesn't give LinkPeek access to any website. Chrome shows a warning for it when you install LinkPeek. Text for the store listing and the options page should say what that warning means in these words, and should quote Chrome's exact wording once it's been checked on a packed build.

Why it's needed: a public link can redirect to an address on your computer or network. Without the rule, LinkPeek would send that request before it could check where it ended up. The alternative, refusing every redirect, would stop many ordinary links (including social-media links) from working.

