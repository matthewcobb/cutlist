import 'fake-indexeddb/auto';
import { beforeEach } from 'bun:test';

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
