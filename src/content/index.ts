/**
 * Content script entry. Runs inside web pages, in Chrome's isolated world,
 * so the page can't see or call our code.
 *
 * It arrives on a page in one of three ways: on a site you turned on (Chrome
 * runs it there by itself), when you press "Scan this page", or when you
 * right-click a link / use the shortcut. The guard below stops it running
 * twice in the same page.
 */
import { getSettings, onSettingsChanged } from '../core/storage/settings';
import { PageController } from './controller';
import { isContentMessage, type ContentResponse } from './messages';

declare global {
  interface Window {
    __linkpeekLoaded?: unknown;
  }
}

// Compare with `true`, and check it's our own property: a page element with
// id="__linkpeekLoaded" also shows up as window.__linkpeekLoaded, and must not
// be able to stop LinkPeek from starting.
const alreadyRunning =
  Object.prototype.hasOwnProperty.call(window, '__linkpeekLoaded') && window.__linkpeekLoaded === true;

function focusedLinkHere(): boolean {
  if (!document.hasFocus()) return false;
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return Boolean(el && Element.prototype.closest.call(el, 'a[href]') instanceof HTMLAnchorElement);
}

if (!alreadyRunning) {
  window.__linkpeekLoaded = true;

  // Everything below waits for this. The message listener is registered right
  // away (the popup and service worker message us the moment injection
  // finishes), but no message is handled until the first apply() is done, so
  // nothing the message does can be undone by start-up.
  const ready: Promise<PageController> = (async () => {
    const settings = await getSettings();
    const controller = new PageController(document, settings);
    controller.removeLeftovers();
    // Listen before the first apply finishes, so a change made meanwhile isn't missed.
    onSettingsChanged((next) => void controller.apply(next));
    await controller.apply(settings);
    return controller;
  })();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse: (r: ContentResponse) => void) => {
    if (!isContentMessage(msg)) return false;
    // The shortcut is sent to every frame in the tab. Only the frame where a
    // link actually has focus answers; the others stay silent. (A page whose
    // focus is inside a frame also "has focus", so check for the link itself.)
    if (msg.type === 'peek-focused' && !focusedLinkHere()) return false;
    void ready.then((c) => c.handle(msg)).then(sendResponse, () => sendResponse({ ok: false }));
    return true; // we answer asynchronously
  });
}

export {};
