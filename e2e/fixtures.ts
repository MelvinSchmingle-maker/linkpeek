/**
 * Loads a test build of the extension into Chromium.
 * Extensions need a persistent context; the "chromium" channel runs
 * Chrome's new headless mode, which supports extensions.
 *
 * Two builds (see scripts/manifest.mjs):
 *  - dist-e2e: LinkPeek is added to test pages automatically (like a site you turned on).
 *  - dist-e2e-on-demand: nothing runs until injected (like any other site).
 * demo.test is mapped onto the local test server, to stand in for "a real
 * website that isn't LinkPeek's test server".
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const TEST_SERVER = 'http://127.0.0.1:4173';
export const OTHER_SITE = 'http://demo.test:4173';

export const test = base.extend<{ extensionDir: string; context: BrowserContext; extensionId: string }>({
  extensionDir: ['dist-e2e', { option: true }],
  context: async ({ extensionDir }, use) => {
    const extensionPath = fileURLToPath(new URL(`../${extensionDir}`, import.meta.url));
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--host-resolver-rules=MAP demo.test 127.0.0.1',
      ],
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

/** Run code in the extension's service worker. */
export async function inWorker<T, A>(context: BrowserContext, fn: (arg: A) => T | Promise<T>, arg: A): Promise<T> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  // Playwright's own types for evaluate() don't line up with a generic helper.
  const evaluate = worker.evaluate.bind(worker) as (f: unknown, a: unknown) => Promise<unknown>;
  return (await evaluate(fn, arg)) as T;
}

/** Change stored settings, as the popup or settings page would. */
export async function setSettings(context: BrowserContext, patch: Record<string, unknown>) {
  await inWorker(
    context,
    async (p) => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(settings as object), ...p } });
    },
    patch,
  );
}
