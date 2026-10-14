import { defineConfig } from '@playwright/test';

export default defineConfig<{ extensionDir: string }>({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'auto', testIgnore: /on-demand\.spec\.ts/ },
    { name: 'on-demand', testMatch: /on-demand\.spec\.ts/, use: { extensionDir: 'dist-e2e-on-demand' } },
  ],
  webServer: {
    command: 'node scripts/serve-test-pages.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
  },
});
