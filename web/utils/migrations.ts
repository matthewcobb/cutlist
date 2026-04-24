/**
 * Schema migration framework for Cutlist's IndexedDB persistence layer.
 *
 * Design principles:
 * - Startup sweep is atomic: all stores are migrated in a single IDB
 *   transaction. A failure mid-sweep rolls back everything, so the database
 *   is never left in a partially-migrated state.
 * - Migrations are pure functions (no side effects, no async).
 * - The migration list is append-only and never edited after shipping.
 * - Forward-version detection: if the stored schema version is higher than
 *   the running code's SCHEMA_VERSION, the app refuses to start rather than
 *   silently corrupt data.
 *
 * Versioning policy:
 * - Bump SCHEMA_VERSION when any IDB record type's fields change.
 * - Bump LAYOUT_CACHE_VERSION when the packing algorithm or ConfigInput shape
 *   changes. This invalidates all cached board layouts without requiring a
 *   schema migration.
 * - Bump DERIVE_VERSION (in parseGltf.ts) when deriveFromGltf output changes.
 *
 * Adding a new migration:
 * 1. Bump SCHEMA_VERSION.
 * 2. Append to the `migrations` array. Never reorder or edit existing entries.
 * 3. The migrate function must be pure: old record in, new record out.
 * 4. Update the matching applyDefaults function in useIdb.ts.
 * 5. Add a test in utils/__tests__/migrations.test.ts.
 */

import type { IDBPDatabase } from 'idb';
import { DEFAULT_STOCK_YAML } from '~/utils/settings';

/**
 * Schema version for record shapes (independent of IDB database version).
 * Bump when any record type's fields change. Never decrement.
 *
 * Starting at 1 as the production baseline (clean slate, April 2025).
 */
export const SCHEMA_VERSION = 1;

/**
 * Layout cache version. Baked into every cache fingerprint so that algorithm
 * or ConfigInput shape changes automatically invalidate stale layouts.
 * Bump whenever the packing engine output shape, scoring, or ConfigInput
 * fields change.
 */
export const LAYOUT_CACHE_VERSION = 2;

type StoreName = 'projects' | 'models' | 'buildSteps' | 'settings';

/** A loosely-typed IDB record (string-keyed object with unknown values). */
export type IdbRecord = Record<string, unknown>;

export interface RecordMigration {
  /** The version this migration brings records TO. */
  version: number;
  store: StoreName;
  /** Pure function: old record in, patched record out. */
  migrate: (record: IdbRecord) => IdbRecord;
}

/**
 * Ordered, append-only migration list.
 * Rules:
 *  - Never edit or delete a shipped migration.
 *  - Each migration must be a pure function (no side effects, no async).
 *  - New required fields must have a sensible default.
 */
export const migrations: RecordMigration[] = [
  // Baseline version 1: no migrations needed (clean slate).
  // Future migrations go here, e.g.:
  // { version: 2, store: 'projects', migrate: (r) => ({ ...r, newField: 'default' }) },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Apply all migrations for a store from `fromVersion` to SCHEMA_VERSION. */
export function migrateRecord(
  store: StoreName,
  record: IdbRecord,
  fromVersion: number,
): IdbRecord {
  let result = record;
  for (const m of migrations) {
    if (m.store === store && m.version > fromVersion) {
      result = m.migrate(result);
    }
  }
  return result;
}

// ─── Startup sweep ────────────────────────────────────────────────────────────

const SCHEMA_VERSION_KEY = 'schema-version';

/**
 * Error thrown when the stored schema version is higher than the running code.
 * This means the user opened the app with an older version after upgrading.
 */
export class FutureSchemaError extends Error {
  constructor(storedVersion: number) {
    super(
      `Database was created by a newer version of Cutlist (schema v${storedVersion}, ` +
        `but this version only supports up to v${SCHEMA_VERSION}). ` +
        `Please update the app or clear your browser data.`,
    );
    this.name = 'FutureSchemaError';
  }
}

/**
 * Run once on app startup (called from getDb).
 *
 * Checks stored schema version; if behind, migrates all stores atomically
 * in a single transaction. If ahead, throws FutureSchemaError.
 *
 * Atomicity guarantee: all store mutations plus the version stamp happen in
 * one readwrite transaction. If any migration throws, IDB auto-aborts the
 * entire transaction and the database is left at its previous version.
 */
export async function runStartupSweep(db: IDBPDatabase<any>): Promise<void> {
  // Read the current schema version outside the migration transaction.
  const versionRecord = await db.get('settings', SCHEMA_VERSION_KEY);
  const storedVersion: number = versionRecord?.version ?? 0;

  if (storedVersion > SCHEMA_VERSION) {
    throw new FutureSchemaError(storedVersion);
  }

  if (storedVersion >= SCHEMA_VERSION) return;

  // Collect which stores need migration work.
  const storesWithMigrations = new Set<StoreName>();
  for (const m of migrations) {
    if (m.version > storedVersion) {
      storesWithMigrations.add(m.store);
    }
  }

  // Always include 'settings' so we can stamp the version.
  storesWithMigrations.add('settings');

  // Open a single atomic transaction over ALL stores that need work.
  // This ensures either everything migrates or nothing does.
  const allStores = ['projects', 'models', 'buildSteps', 'settings'] as const;
  const tx = db.transaction([...allStores], 'readwrite');

  try {
    // Small stores: getAll -> migrate -> put
    for (const store of ['projects', 'buildSteps'] as const) {
      const pending = migrations.filter(
        (m) => m.store === store && m.version > storedVersion,
      );
      if (pending.length === 0) continue;

      const all = await tx.objectStore(store).getAll();
      for (const record of all) {
        let patched = record;
        for (const m of pending) {
          patched = m.migrate(patched);
        }
        await tx.objectStore(store).put(patched);
      }
    }

    // Models store: cursor-based to avoid loading all gltfJson blobs at once
    const modelMigrations = migrations.filter(
      (m) => m.store === 'models' && m.version > storedVersion,
    );
    if (modelMigrations.length > 0) {
      let cursor = await tx.objectStore('models').openCursor();
      while (cursor) {
        let record = cursor.value;
        for (const m of modelMigrations) {
          record = m.migrate(record);
        }
        await cursor.update(record);
        cursor = await cursor.continue();
      }
    }

    // Settings store (global-settings record)
    const settingsMigrations = migrations.filter(
      (m) => m.store === 'settings' && m.version > storedVersion,
    );
    if (settingsMigrations.length > 0) {
      const record = await tx.objectStore('settings').get('global-settings');
      if (record) {
        let patched = record;
        for (const m of settingsMigrations) {
          patched = m.migrate(patched);
        }
        await tx.objectStore('settings').put(patched);
      }
    }

    // Stamp new version inside the same transaction.
    await tx.objectStore('settings').put({
      key: SCHEMA_VERSION_KEY,
      version: SCHEMA_VERSION,
    });

    await tx.done;
  } catch (err) {
    // Transaction auto-aborts on error — no partial state.
    console.error(
      `[migrations] Startup sweep failed migrating from v${storedVersion} to v${SCHEMA_VERSION}:`,
      err,
    );
    throw err;
  }
}

// ─── Export migration ─────────────────────────────────────────────────────────

interface RawExport {
  version?: number;
  project?: IdbRecord;
  models?: IdbRecord[];
  buildSteps?: IdbRecord[];
  settings?: IdbRecord;
  [key: string]: unknown;
}

/**
 * Migrate an imported .cutlist.gz from its version to SCHEMA_VERSION.
 * Reuses the same migration functions as the IDB sweep.
 */
export function migrateExport(raw: RawExport): RawExport {
  const fromVersion = raw.version ?? 0;

  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `This export was created with a newer version of Cutlist (v${fromVersion}). Please update the app.`,
    );
  }

  if (fromVersion >= SCHEMA_VERSION) return raw;

  const project = raw.project
    ? migrateRecord('projects', raw.project, fromVersion)
    : raw.project;

  const models = (raw.models ?? []).map((m) =>
    migrateRecord('models', m, fromVersion),
  );

  const buildSteps = (raw.buildSteps ?? []).map((s) =>
    migrateRecord('buildSteps', s, fromVersion),
  );

  return { ...raw, version: SCHEMA_VERSION, project, models, buildSteps };
}
