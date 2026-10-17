import type { SummaryEngine } from '../summary/provider';
import type { Mode } from '../types';

export interface Settings {
  mode: Mode;
  /** Show fixture results on links marked data-linkpeek-demo (our test pages only). */
  showDemoResults: boolean;
  /**
   * Hostnames where the user switched LinkPeek off, even though it has
   * permission there (for example after allowing all sites).
   */
  disabledSites: string[];
  /**
   * Who writes summaries. "extractive" (the default) picks the article's most
   * informative sentence. "chrome-on-device" uses Chrome's built-in AI when
   * this computer has it. "remote" sends the article text to LinkPeek's own
   * backend, which asks Claude (Part 06). Both fall back to extractive.
   */
  summaryEngine: SummaryEngine;
  /**
   * Send feedback votes to LinkPeek's server. Off, and hidden from the
   * options page until Part 14 decides whether it's ever built. Nothing reads
   * it as a real switch yet (see src/core/feedback/upload.ts).
   */
  shareFeedback: boolean;
  /** Per-filter switches for the annoyance tools (Part 12). Off by default; see src/core/annoyance. */
  annoyance: AnnoyanceSettings;
  /** Sites where a warning (Part 11) was overruled with "Don't warn me on this site". */
  overruledWarnings: string[];
  /** Per-site choices for the annoyance tools. A site's choice overrides the global one, tool by tool. */
  annoyanceSites: Record<string, Partial<AnnoyanceSettings>>;
}

/** One switch per annoyance tool, so each can be turned on and off alone. */
export interface AnnoyanceSettings {
  readingMode: boolean;
  signUpOverlays: boolean;
  floatingVideo: boolean;
  stickyBars: boolean;
  urgencyLabels: boolean;
  autoplayPause: boolean;
}

export const DEFAULT_ANNOYANCE: AnnoyanceSettings = {
  readingMode: false,
  signUpOverlays: false,
  floatingVideo: false,
  stickyBars: false,
  urgencyLabels: false,
  autoplayPause: false,
};

export const DEFAULT_SETTINGS: Settings = {
  mode: 'smart',
  showDemoResults: true,
  disabledSites: [],
  summaryEngine: 'extractive',
  shareFeedback: false,
  annoyance: DEFAULT_ANNOYANCE,
  overruledWarnings: [],
  annoyanceSites: {},
};

/** The annoyance tools that apply on one site: the global choices, with that site's own choices over them. */
export function annoyanceFor(s: Settings, host: string): AnnoyanceSettings {
  return { ...s.annoyance, ...(s.annoyanceSites[host] ?? {}) };
}

const KEY = 'settings';

/** Fills in anything a saved copy is missing, so an older copy still works after a new setting is added. */
export function withDefaults(saved: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    annoyance: { ...DEFAULT_ANNOYANCE, ...saved?.annoyance },
    annoyanceSites: { ...saved?.annoyanceSites },
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return withDefaults(stored[KEY] as Partial<Settings> | undefined);
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cb(withDefaults(changes[KEY].newValue as Partial<Settings>));
    }
  });
}
