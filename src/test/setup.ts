/**
 * Minimal in-memory stand-in for the chrome.* APIs used in unit tests.
 * Real-browser behaviour is covered by the Playwright tests in e2e/.
 */
import { beforeEach } from 'vitest';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

function makeArea(area: string, listeners: Listener[]) {
  let store: Record<string, unknown> = {};
  return {
    async get(keys?: string | string[] | null) {
      if (keys == null) return structuredClone(store);
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: store[k], newValue: structuredClone(v) };
        store[k] = structuredClone(v);
      }
      for (const l of listeners) l(changes, area);
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
    async clear() {
      store = {};
    },
  };
}

function makeChrome() {
  let store: Record<string, unknown> = {};
  const listeners: Listener[] = [];
  const local = {
    async get(keys?: string | string[] | null) {
      if (keys == null) return structuredClone(store);
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: store[k], newValue: structuredClone(v) };
        store[k] = structuredClone(v);
      }
      for (const l of listeners) l(changes, 'local');
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
    async clear() {
      store = {};
    },
  };
  return {
    storage: {
      local,
      session: makeArea('session', listeners),
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
    },
    runtime: {
      getManifest: () => ({ version: '0.0.0-test', name: 'LinkPeek' }),
      id: 'test-extension-id',
    },
  };
}

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = makeChrome();
});
