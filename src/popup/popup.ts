import { getSettings, updateSettings } from '../core/storage/settings';
import { applyBrand } from '../ui/theme';

applyBrand();

const version = document.querySelector('[data-version]');
if (version) version.textContent = chrome.runtime.getManifest().version;

const demoToggle = document.querySelector<HTMLInputElement>('#demo-toggle');
if (demoToggle) {
  demoToggle.checked = (await getSettings()).showDemoResults;
  demoToggle.addEventListener('change', () => {
    void updateSettings({ showDemoResults: demoToggle.checked });
  });
}

const runHere = document.querySelector<HTMLButtonElement>('#run-here');
const runStatus = document.querySelector<HTMLElement>('#run-status');
runHere?.addEventListener('click', async () => {
  const setStatus = (s: string) => {
    if (runStatus) runStatus.textContent = s;
  };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    // Clicking the toolbar button granted activeTab for this tab only.
    // Chrome refuses to inject into its own pages (chrome://, the Web Store),
    // which lands in the catch below.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    setStatus('LinkPeek is running on this page.');
  } catch {
    setStatus("LinkPeek can't run on this page. Browser pages and the Chrome Web Store are off limits to extensions.");
  }
});
