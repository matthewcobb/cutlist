/**
 * DB infrastructure: Dexie class singleton, error channel, and quota-aware
 * write wrapper.
 *
 * Everything here is module-level state — one instance per process — so
 * every domain module shares the same DB handle and error ref.
 *
 * Versioning: the canonical schema version lives in `SCHEMA_VERSION` in
 * `~/utils/versions`. When bumping, add a new `.version(N).stores(...)`
 * call in `CutlistDB` below AND bump `SCHEMA_VERSION` so the export file
 * format stays in sync. See `web/utils/projectImport/migrations.ts` for
 * the export-side record migrations.
 */

import { ref, readonly } from 'vue';
import Dexie, { type Table } from 'dexie';
import { FutureSchemaError, SCHEMA_VERSION } from '~/utils/versions';
import type {
  IdbProject,
  IdbModel,
  IdbBuildStep,
  IdbMetaRecord,
} from './types';

// ─── Dexie class ────────────────────────────────────────────────────────────

export class CutlistDB extends Dexie {
  projects!: Table<IdbProject, string>;
  models!: Table<IdbModel, string>;
  buildSteps!: Table<IdbBuildStep, string>;
  meta!: Table<IdbMetaRecord, string>;

  constructor() {
    super('cutlist-db');

    // v1 — clean-slate baseline.
    //
    // Schema string format (Dexie): 'primaryKey, index1, index2, ...'.
    // Fields that aren't indexed don't need to be listed — Dexie stores the
    // full record regardless.
    //
    // When adding v2+, append another `this.version(N).stores({...}).upgrade(...)`
    // call below. Do NOT edit this v1 call.
    this.version(1).stores({
      projects: 'id, updatedAt',
      models: 'id, projectId',
      buildSteps: 'id, projectId',
      meta: 'key',
    });
  }
}

// ─── IDB error handling ─────────────────────────────────────────────────────

/**
 * Reactive error state for IDB operations. Surfaced to the UI layer
 * so users see a toast/banner when storage is full or unavailable.
 */
const idbError = ref<string | null>(null);

/** Composable to read the current IDB error state in components. */
export function useIdbErrors() {
  return {
    /** Current error message, or null if everything is fine. */
    error: readonly(idbError),
    /** Clear the error (e.g. when user dismisses a toast). */
    dismiss: () => {
      idbError.value = null;
    },
  };
}

function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 ||
      err.name === ('NS_ERROR_DOM_QUOTA_REACHED' as string)
    );
  }
  // Dexie wraps quota errors in its own class with .inner or .name.
  if (err instanceof Dexie.DexieError) {
    return err.name === 'QuotaExceededError';
  }
  return false;
}

/**
 * Wrap an IDB write operation with quota error handling.
 * On QuotaExceededError, sets the reactive error state so the UI can react.
 */
export async function safeWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isQuotaExceeded(err)) {
      idbError.value =
        'Storage is full. Delete unused projects or clear browser data to free space.';
    }
    throw err;
  }
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<CutlistDB> | null = null;

/**
 * Lazy singleton accessor. First call triggers `db.open()` which runs any
 * pending Dexie `.upgrade()` callbacks atomically; subsequent calls return
 * the same handle.
 *
 * A future-version database (user opened the app with older code after
 * upgrading) is translated into our `FutureSchemaError` so the UI layer can
 * surface a consistent message.
 */
export function getDb(): Promise<CutlistDB> {
  if (!dbPromise) {
    const db = new CutlistDB();
    dbPromise = db
      .open()
      .then(() => db)
      .catch((err: unknown) => {
        dbPromise = null;
        // Dexie's VersionError means the stored DB is newer than this code.
        if (err instanceof Dexie.DexieError && err.name === 'VersionError') {
          const future = new FutureSchemaError(db.verno || SCHEMA_VERSION + 1);
          idbError.value = future.message;
          throw future;
        }
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Unknown error';
        const wrapped = `Browser storage unavailable (private browsing may prevent saving projects): ${msg}`;
        idbError.value = wrapped;
        throw new Error(wrapped);
      });
  }
  return dbPromise;
}

/**
 * Test-only: close the Dexie singleton and clear cached open promise so the
 * next `getDb()` opens against whatever `globalThis.indexedDB` is (e.g. a
 * fresh `IDBFactory` from fake-indexeddb). Do not import from app code.
 */
export async function __resetDbForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore — db may have failed to open
    }
  }
  dbPromise = null;
  idbError.value = null;
}
