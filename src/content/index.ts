/**
 * Content script entry. Runs inside web pages, in Chrome's isolated world,
 * so the page can't see or call our code.
 */
import { getSettings, onSettingsChanged } from '../core/storage/settings';
import { CardController } from './card';
import { attachDemoIcons, removeDemoIcons } from './demo';

declare global {
  interface Window {
    __linkpeekLoaded?: boolean;
  }
}

async function start(): Promise<void> {
  const cards = new CardController();
  const settings = await getSettings();
  if (settings.showDemoResults) attachDemoIcons(document, cards);

  onSettingsChanged((next) => {
    if (next.showDemoResults) attachDemoIcons(document, cards);
    else removeDemoIcons(document, cards);
  });
}

// The popup can inject this script on demand, so guard against running twice.
if (!window.__linkpeekLoaded) {
  window.__linkpeekLoaded = true;
  void start();
}

export {};
