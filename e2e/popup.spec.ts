import { test, expect } from './fixtures';

test('extension loads and the popup says it is installed', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(page.getByText('Installed.')).toBeVisible();
  await expect(page.locator('[data-version]')).toHaveText(/\d+\.\d+\.\d+/);
});
