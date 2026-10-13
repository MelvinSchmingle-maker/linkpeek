import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-test-pages.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
});
