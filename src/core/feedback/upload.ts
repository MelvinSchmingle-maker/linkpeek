/**
 * Sending feedback to a server. Not built: Part 14 decides whether feedback
 * ever leaves the device. The setting that would turn it on is off by default
 * and hidden from the options page. Until Part 14, nothing is sent, whatever
 * the setting says. docs/privacy.md says exactly what would be sent if it were.
 */
import { getSettings } from '../storage/settings';
import type { FeedbackEntry } from './store';

export type UploadResult = { sent: false; reason: 'off' | 'not-built' };

export async function uploadFeedback(_entries: FeedbackEntry[]): Promise<UploadResult> {
  const { shareFeedback } = await getSettings();
  return { sent: false, reason: shareFeedback ? 'not-built' : 'off' };
}
