/**
 * Export/import format migration pipeline for `.cutlist.gz` files.
 *
 * Scope of this module: transforming record shapes inside imported export
 * files from the version they were written at up to the current
 * `SCHEMA_VERSION`. Does NOT touch IndexedDB — that's Dexie's job, handled
 * by the `.version(N).stores(...).upgrade(...)` chain on `CutlistDB` in
 * `~/composables/useIdb/db`.
 *
 * When adding a schema migration, the same logical transform should be
 * expressed twice:
 *   1. Inside Dexie's `.upgrade(tx => ...)` callback — runs on local IDB.
 *   2. As a pure entry in the `migrations` array below — runs on incoming
 *      `.cutlist.gz` payloads in `migrateExport`.
 *
 * Rules for the `migrations` array:
 *  - Append only; never edit or delete a shipped entry.
 *  - Pure functions (no side effects, no async).
 *  - New required fields must have a sensible default.
 */

import { FutureSchemaError, SCHEMA_VERSION } from '../versions';

type StoreName = 'projects' | 'models' | 'buildSteps';

/** A loosely-typed export record (string-keyed object with unknown values). */
export type IdbRecord = Record<string, unknown>;

export interface RecordMigration {
  /** The version this migration brings records TO. */
  version: number;
  store: StoreName;
  /** Pure function: old record in, patched record out. */
  migrate: (record: IdbRecord) => IdbRecord;
}

/** Ordered, append-only record migration list. */
export const migrations: RecordMigration[] = [
  // v1 baseline: nothing to migrate.
  // Future: { version: 2, store: 'projects', migrate: (r) => ({ ...r, tags: r.tags ?? [] }) },
];

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

// ─── Export migration ─────────────────────────────────────────────────────────

interface RawExport {
  version?: number;
  project?: IdbRecord;
  models?: IdbRecord[];
  buildSteps?: IdbRecord[];
  [key: string]: unknown;
}

/**
 * Migrate an imported `.cutlist.gz` from its version to `SCHEMA_VERSION`.
 * Throws `FutureSchemaError` when the export advertises a version greater
 * than this client supports — the same error class used on DB open, so
 * callers can handle "future schema" uniformly regardless of source.
 */
export function migrateExport(raw: RawExport): RawExport {
  const fromVersion = raw.version ?? 0;

  if (fromVersion > SCHEMA_VERSION) {
    throw new FutureSchemaError(fromVersion, 'export');
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
