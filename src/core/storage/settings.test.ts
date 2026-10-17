import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, updateSettings } from './settings';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults to Smart mode', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('smart');
  });

  it('merges updates with what is stored', async () => {
    await updateSettings({ mode: 'manual' });
    await updateSettings({ showDemoResults: false });
    expect(await getSettings()).toEqual({ mode: 'manual', showDemoResults: false, disabledSites: [], summaryEngine: 'extractive' });
  });

  it('notifies listeners on change', async () => {
    const seen: string[] = [];
    onSettingsChanged((s) => seen.push(s.mode));
    await updateSettings({ mode: 'scan' });
    expect(seen).toEqual(['scan']);
  });
});
