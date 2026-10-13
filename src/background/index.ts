/**
 * Service worker. Chrome can stop and restart it at any time, so it keeps no
 * state in memory that matters: everything lives in chrome.storage.
 */
import { DEFAULT_SETTINGS } from '../core/storage/settings';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});
