# Permissions

LinkPeek asks for as little as possible. This file lists every permission, why it's needed, and what Chrome shows the user.

## Current (Part 03)

| Permission | Why | Warning shown at install? |
|---|---|---|
| `storage` | Save your settings (mode, sites turned off, demo toggle) and feedback votes in your browser. | No |
| `activeTab` | When you click the toolbar button, choose "Peek at this link" from the right-click menu, or press the shortcut, LinkPeek can work on that one tab until you leave the page. No standing access to any site. | No |
| `scripting` | Lets LinkPeek put its icon and card into a page, only on pages it already has access to. Also used to register "run on the sites I turned on". | No |
| `contextMenus` | Adds "Peek at this link with LinkPeek" to the right-click menu on links. | No |
| `optional_host_permissions` (`https://*/*`, `http://*/*`) | Not granted at install. When you press "Turn on" for a site in the popup, Chrome asks you to allow that one site. "Turn on for all websites" in Settings asks for all sites at once. | Not at install. Chrome shows its own prompt when you turn a site on. |

The keyboard shortcut (`commands` in the manifest, Alt+Shift+P by default) is not a permission and shows no warning. Chrome may leave it unassigned if another extension already uses that key. You can set it at `chrome://extensions/shortcuts`.

**After installing, LinkPeek has access to no websites at all.** It only works on a page when you click it, right-click a link, use the shortcut, or turn it on for that site.

### How "turn on for this site" works
1. Popup > This site > **Turn on**. Chrome asks: allow LinkPeek to read and change data on this site?
2. If you allow it, the service worker registers LinkPeek's script for exactly the sites you've allowed (one registered script, its list of sites kept in step with what Chrome has granted). It starts straight away on open tabs of that site.
3. **Turn off** gives the access back to Chrome (and stops LinkPeek on the open page at once). If the access came from "all websites", LinkPeek can't give back one site, so it remembers the site as "turned off" and doesn't run there.

## Test build only

`npm run test:e2e` builds a separate test version (`dist-e2e/`, named "LinkPeek (test build)") with access to `http://127.0.0.1` only, so automated tests can run on the local test pages without a permission prompt nobody can click. It is never the version you install or publish.

## Still to decide (Part 04)

Reading articles on other sites: an extension can only fetch a page from a site it has access to. A news front page links to many different sites, so per-site access won't cover most links. Options, to decide in Part 04 with real numbers: ask for all-site access the first time you use summaries (with a plain explanation), or fetch through a LinkPeek server (costs money, and the server would see which links you preview).
