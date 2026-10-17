/** The annoyance tools, in the order they're listed everywhere (Part 12). Wording is plain and never claims a page is safe or clean. */
import type { AnnoyanceSettings } from '../../core/storage/settings';

export const ANNOYANCE_LABEL: Record<keyof AnnoyanceSettings, { name: string; hint: string }> = {
  readingMode: { name: 'Reading mode', hint: '"Read here" on a card shows the article in a clean panel.' },
  signUpOverlays: { name: 'Sign-up boxes', hint: 'Hide sign-up boxes that cover the page. Login forms and cookie notices are never hidden.' },
  floatingVideo: { name: 'Floating videos', hint: 'Hide videos that float over the page while you scroll.' },
  stickyBars: { name: 'Large sticky bars', hint: 'Hide big bars fixed to the top or bottom of the page.' },
  urgencyLabels: { name: 'Urgency labels', hint: 'Add a note to countdowns and "only 2 left" lines. Nothing is hidden.' },
  autoplayPause: { name: 'Autoplay with sound', hint: 'Pause videos that start playing with sound.' },
};

export const ANNOYANCE_ORDER = Object.keys(ANNOYANCE_LABEL) as (keyof AnnoyanceSettings)[];
