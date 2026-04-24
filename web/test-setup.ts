import 'fake-indexeddb/auto';
import { beforeEach } from 'bun:test';
import { ref, shallowRef } from 'vue';

// Nuxt auto-imports these Vue primitives into every module. Bun's test runner
// doesn't, so shim them on globalThis before any test module loads.
// @ts-expect-error — Nuxt auto-import shim
globalThis.ref = ref;
// @ts-expect-error — Nuxt auto-import shim
globalThis.shallowRef = shallowRef;

const CUTLIST_DB_NAME = 'cutlist-db';

beforeEach(async () => {
  // Dynamic import so Dexie is not evaluated before fake-indexeddb/auto
  // (static `import db` would load dexie.mjs first and freeze domDeps.indexedDB as null).
  const { __resetDbForTests } = await import('./composables/useIdb/db');
  await __resetDbForTests();

  const idb = globalThis.indexedDB;
  if (!idb) return;

  await new Promise<void>((resolve, reject) => {
    const req = idb.deleteDatabase(CUTLIST_DB_NAME);
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onsuccess = () => resolve();
  });
});
