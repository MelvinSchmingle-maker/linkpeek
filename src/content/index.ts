/**
 * Content script entry. Runs inside web pages, in Chrome's isolated world,
 * so the page can't see or call our code.
 *
 * It arrives on a page in one of three ways: on a site you allowed (Smart
 * mode), when you press a popup button, or when you right-click a link /
 * use the shortcut. The guard below stops it running twice.
 */
import { getSettings, onSettingsChanged } from '../core/storage/settings';
import { PageController } from './controller';
import { isContentMessage } from './messages';

declare global {
  interface Window {
    __linkpeekLoaded?: boolean;
  }
}

async function start(): Promise<void> {
  const controller = new PageController(document, await getSettings());
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isContentMessage(msg)) return false;
    void controller.handle(msg).then(sendResponse);
    return true; // we answer asynchronously
  });
  controller.apply(await getSettings());
  onSettingsChanged((next) => controller.apply(next));
}

if (!window.__linkpeekLoaded) {
  window.__linkpeekLoaded = true;
  void start();
}

export {};
