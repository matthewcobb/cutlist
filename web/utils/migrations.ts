import type { IDBPDatabase } from 'idb';
import { DEFAULT_STOCK_YAML, DEFAULT_SETTINGS } from '~/utils/settings';

/**
 * Schema version for record shapes (independent of IDB database version).
 * Bump when any record type's fields change. Never decrement.
 */
export const SCHEMA_VERSION = 3;

type StoreName = 'projects' | 'models' | 'buildSteps' | 'settings';

export interface RecordMigration {
  /** The version this migration brings records TO. */
  version: number;
  store: StoreName;
  /** Pure function: old record in, patched record out. */
  migrate: (record: any) => any;
}

/**
 * Ordered, append-only migration list.
 * Rules:
 *  - Never edit or delete a shipped migration.
 *  - Each migration must be a pure function (no side effects, no async).
 *  - New required fields must have a sensible default.
 */
export const migrations: RecordMigration[] = [
  // v3: backfill fields that existed in TS types but had no migration
  {
    version: 3,
    store: 'projects',
    migrate: (p) => ({
      ...p,
      stock: p.stock ?? DEFAULT_STOCK_YAML,
      colorMap: p.colorMap ?? {},
    }),
  },
  {
    version: 3,
    store: 'models',
    migrate: (m) => ({
      ...m,
      source: m.source ?? 'gltf',
      enabled: m.enabled ?? true,
    }),
  },
  {
    version: 3,
    store: 'settings',
    migrate: (s) => ({
      ...s,
      settings: s.settings
        ? { ...DEFAULT_SETTINGS, ...s.settings }
        : { ...DEFAULT_SETTINGS },
    }),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Apply all migrations for a store from `fromVersion` to SCHEMA_VERSION. */
export function migrateRecord(
  store: StoreName,
  record: any,
  fromVersion: number,
): any {
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
 * Run once on app startup (called from getDb).
 * Checks stored schema version; if behind, iterates all stores and applies
 * pending migrations. Uses cursor for models store to avoid loading all
 * gltfJson blobs into memory.
 */
export async function runStartupSweep(db: IDBPDatabase<any>): Promise<void> {
  const versionRecord = await db.get('settings', SCHEMA_VERSION_KEY);
  const storedVersion: number = versionRecord?.version ?? 2;

  if (storedVersion >= SCHEMA_VERSION) return;

  // Small stores: getAll → migrate → put
  for (const store of ['projects', 'buildSteps'] as const) {
    const pending = migrations.filter(
      (m) => m.store === store && m.version > storedVersion,
    );
    if (pending.length === 0) continue;

    const tx = db.transaction(store, 'readwrite');
    const all = await tx.store.getAll();
    for (const record of all) {
      let patched = record;
      for (const m of pending) {
        patched = m.migrate(patched);
      }
      await tx.store.put(patched);
    }
    await tx.done;
  }

  // Models store: cursor-based to avoid loading all gltfJson blobs at once
  const modelMigrations = migrations.filter(
    (m) => m.store === 'models' && m.version > storedVersion,
  );
  if (modelMigrations.length > 0) {
    const tx = db.transaction('models', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor) {
      let record = cursor.value;
      for (const m of modelMigrations) {
        record = m.migrate(record);
      }
      await cursor.update(record);
      cursor = await cursor.continue();
    }
    await tx.done;
  }

  // Settings store
  const settingsMigrations = migrations.filter(
    (m) => m.store === 'settings' && m.version > storedVersion,
  );
  if (settingsMigrations.length > 0) {
    const record = await db.get('settings', 'global-settings');
    if (record) {
      let patched = record;
      for (const m of settingsMigrations) {
        patched = m.migrate(patched);
      }
      await db.put('settings', patched);
    }
  }

  // Stamp new version
  await db.put('settings', {
    key: SCHEMA_VERSION_KEY,
    version: SCHEMA_VERSION,
  } as any);
}

// ─── Export migration ─────────────────────────────────────────────────────────

interface RawExport {
  version?: number;
  project?: any;
  models?: any[];
  buildSteps?: any[];
  settings?: any;
  [key: string]: any;
}

/**
 * Migrate an imported .cutlist.json from its version to SCHEMA_VERSION.
 * Reuses the same migration functions as the IDB sweep.
 */
export function migrateExport(raw: RawExport): RawExport {
  const fromVersion = raw.version ?? 2;

  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `This export was created with a newer version of Cutlist (v${fromVersion}). Please update the app.`,
    );
  }

  if (fromVersion >= SCHEMA_VERSION) return raw;

  const project = raw.project
    ? migrateRecord('projects', raw.project, fromVersion)
    : raw.project;

  const models = (raw.models ?? []).map((m: any) =>
    migrateRecord('models', m, fromVersion),
  );

  const buildSteps = (raw.buildSteps ?? []).map((s: any) =>
    migrateRecord('buildSteps', s, fromVersion),
  );

  return { ...raw, version: SCHEMA_VERSION, project, models, buildSteps };
}
