/**
 * DB infrastructure: lazy singleton, schema upgrade path, error channel,
 * quota-aware write wrapper, and the multi-tab BroadcastChannel.
 *
 * Everything here is module-level state — one instance per process — so
 * every domain module shares the same DB handle, error ref, and channel.
 */

import { ref, readonly } from 'vue';
import { openDB, type IDBPDatabase } from 'idb';
import { runStartupSweep } from '~/utils/migrations';
import type { CutlistDb } from './types';

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
    // Chromium, Safari, Firefox all use slightly different names/codes.
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 || // legacy code
      err.name === ('NS_ERROR_DOM_QUOTA_REACHED' as string)
    );
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

// ─── Multi-tab coordination ─────────────────────────────────────────────────

/**
 * BroadcastChannel for notifying other tabs of data changes.
 * Receiving tabs should reload project data when they get a message.
 */
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel('cutlist-idb');
  }
  return channel;
}

export function notifyOtherTabs(event: string) {
  try {
    getChannel()?.postMessage({ event, timestamp: Date.now() });
  } catch {
    // BroadcastChannel may not be supported or may have been closed.
  }
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<CutlistDb>> | null = null;

export function getDb(): Promise<IDBPDatabase<CutlistDb>> {
  if (!dbPromise) {
    dbPromise = openDB<CutlistDb>('cutlist-db', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const projects = db.createObjectStore('projects', { keyPath: 'id' });
          projects.createIndex('updatedAt', 'updatedAt');

          const models = db.createObjectStore('models', { keyPath: 'id' });
          models.createIndex('projectId', 'projectId');

          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          const buildSteps = db.createObjectStore('buildSteps', {
            keyPath: 'id',
          });
          buildSteps.createIndex('projectId', 'projectId');
        }
        if (oldVersion < 3) {
          db.createObjectStore('layoutCache', { keyPath: 'projectId' });
        }
      },
    })
      .then(async (db) => {
        await runStartupSweep(db);
        return db;
      })
      .catch((err) => {
        dbPromise = null;
        const message =
          err?.name === 'FutureSchemaError'
            ? err.message
            : `Browser storage unavailable (private browsing may prevent saving projects): ${err.message}`;
        idbError.value = message;
        throw new Error(message);
      });
  }
  return dbPromise;
}
