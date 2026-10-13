# Permissions

LinkPeek asks for as little as possible. This file lists every permission, why it's needed, and what Chrome shows the user.

## Current (Part 01)

| Permission | Why | Warning shown at install? |
|---|---|---|
| `storage` | Save your settings (mode, on/off) in your browser. | No |
| `activeTab` | When you click the LinkPeek toolbar button, LinkPeek can work on the tab you're looking at, for that tab only, until you leave the page. No standing access to any site. | No |
| `scripting` | Lets LinkPeek put its small icon and card into a page, but only on pages it already has access to (via `activeTab` or a site you've allowed). | No |

LinkPeek has **no access to any website** after installation. It can't read pages you visit unless you click it.

## Test build only

`npm run test:e2e` builds a separate test version (`dist-e2e/`, named "LinkPeek (test build)") with access to `http://127.0.0.1` only, so automated tests can run on the local test pages without a permission prompt nobody can click. It is never the version you install or publish.

## Plan for later parts

- **Smart mode on a site** (Part 03): you click "Turn on for this site" in the popup. Chrome asks you to allow that one site. Uses `optional_host_permissions`, so nothing is requested at install time.
- **Turn on everywhere** (Part 03): an optional, clearly explained request for all sites, for people who want icons everywhere without allowing sites one by one.
- **Reading articles on other sites** (Part 04): an extension can only fetch a page from a site it has permission for. A news front page links to many sites, so per-site permission won't cover most links. Options, to be decided in Part 04 with real numbers: ask for all-site access when you first use summaries (with a plain explanation), or fetch through a LinkPeek server (costs money and means the server sees which links you preview).
