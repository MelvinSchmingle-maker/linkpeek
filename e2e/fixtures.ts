/**
 * Loads the test build of the extension (dist-e2e/) into Chromium.
 * Extensions need a persistent context; the "chromium" channel runs
 * Chrome's new headless mode, which supports extensions.
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const extensionPath = fileURLToPath(new URL('../dist-e2e', import.meta.url));

export const TEST_SERVER = 'http://127.0.0.1:4173';

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
