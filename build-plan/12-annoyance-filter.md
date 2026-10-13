# Part 12. Annoyance filter and reading mode

## Goal
Optional, user-controlled tools that cut page interruptions. All off by default. This is not an ad blocker, and it never claims to remove all ads.

## Build (each one a separate toggle, in this order)
1. **Reading mode**: show the Readability-extracted article in a clean overlay from the card ("Read here"). Easiest and most reliable, so start here. It only shows content the page already gave us, so no paywall bypass.
2. **Newsletter and sign-up overlays**: detect fixed or modal elements covering most of the screen that contain an email field and sign-up wording, and hide them only if the page can still scroll and work. Never hide login forms or consent banners required by law (handled separately below).
3. **Floating video boxes**: detect sticky or fixed `video` or `iframe` players not in the main content and offer to close them.
4. **Large sticky bars**: fixed headers or footers over a size threshold, collapsible by the user.
5. **Fake urgency markers** (label only, never hide): countdown timers and "Only 2 left!" style text, with a small "Urgency claim" note. Wording must say we can't verify it, not that it's false.
6. **Autoplay**: pause autoplaying media with sound where the page allows it.

## Controls
- Popup: per-site on/off for each filter, plus "Undo on this page" to restore anything hidden.
- Options page: global defaults and a site list.
- Every hidden element can be restored with one click. Nothing is removed permanently from the page.

## Cookie and consent banners
Don't auto-click or auto-hide consent banners in this part. They can have legal consequences and site breakage. Record it in `docs/decisions.md` as a possible later feature.

## Don't
- No hiding of paywalls, login prompts or subscription messages.
- No affiliate links or paid placements anywhere near these tools.

## Done when
- Fixture pages for each annoyance type, with Playwright tests for hide and undo.
- Test on 10 real sites. Record breakage in `docs/compat/annoyance.md`. Anything that breaks a site's main function is turned off by default for that pattern.

## Your check
Turn everything on and browse normally for a day. Did anything you needed disappear? That's the bug list.
