/**
 * Content script entry. Runs inside web pages (in Chrome's isolated world, so
 * the page cannot see or call our code).
 */
declare global {
  interface Window {
    __linkpeekLoaded?: boolean;
  }
}

// The popup can inject this script on demand, so guard against running twice.
if (!window.__linkpeekLoaded) {
  window.__linkpeekLoaded = true;
}

export {};
