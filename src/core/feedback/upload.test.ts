import { describe, expect, it } from 'vitest';
import { updateSettings } from '../storage/settings';
import { uploadFeedback } from './upload';

describe('sending feedback to a server (not built)', () => {
  it('sends nothing while the setting is off, which it is by default', async () => {
    expect(await uploadFeedback([])).toEqual({ sent: false, reason: 'off' });
  });

  it('still sends nothing when the setting is on, because the upload is not built yet', async () => {
    await updateSettings({ shareFeedback: true });
    expect(await uploadFeedback([])).toEqual({ sent: false, reason: 'not-built' });
  });
});
