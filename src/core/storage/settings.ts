import type { Mode } from '../types';

export interface Settings {
  mode: Mode;
  /** Show fixture results on links marked data-linkpeek-demo (our test pages only). */
  showDemoResults: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'smart',
  showDemoResults: true,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings>) });
    }
  });
}
