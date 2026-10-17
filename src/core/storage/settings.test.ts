import { describe, expect, it } from 'vitest';
import { DEFAULT_ANNOYANCE, DEFAULT_SETTINGS, getSettings, onSettingsChanged, updateSettings, withDefaults } from './settings';

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
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, mode: 'manual', showDemoResults: false });
  });

  it('a saved copy from before a setting existed gets that setting\'s default', () => {
    const old = withDefaults({ mode: 'scan' });
    expect(old.annoyance).toEqual(DEFAULT_ANNOYANCE);
    expect(old.shareFeedback).toBe(false);
    expect(old.overruledWarnings).toEqual([]);
  });

  it('the upload setting is off by default and nothing turns annoyance tools on', () => {
    expect(DEFAULT_SETTINGS.shareFeedback).toBe(false);
    expect(Object.values(DEFAULT_ANNOYANCE).every((on) => on === false)).toBe(true);
  });

  it('notifies listeners on change', async () => {
    const seen: string[] = [];
    onSettingsChanged((s) => seen.push(s.mode));
    await updateSettings({ mode: 'scan' });
    expect(seen).toEqual(['scan']);
  });
});
