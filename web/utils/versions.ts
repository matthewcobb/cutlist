/**
 * Cross-cutting version constants and the shared schema error class.
 *
 * These values are referenced by multiple unrelated subsystems (IDB open
 * path, export/import pipeline, layout cache fingerprint, packing worker),
 * so they live in their own tiny module to avoid pulling in unrelated
 * dependencies wherever they're used.
 *
 * Bump policies:
 * - `SCHEMA_VERSION` — any IDB record type's fields change. Must also add
 *   a matching `this.version(N)` call on `CutlistDB` and (if the change
 *   affects exported data) a record migration entry in `./migrations`.
 * - `LAYOUT_CACHE_VERSION` — packing algorithm output, scoring, or
 *   ConfigInput shape changes. Invalidates every cached board layout.
 * - `DERIVE_VERSION` (lives in `parseGltf.ts`) — `deriveFromGltf` output
 *   shape or semantics change.
 */

/**
 * Schema version for record shapes. Must equal the highest Dexie
 * `.version(N)` declared on `CutlistDB`. Never decrement.
 */
export const SCHEMA_VERSION = 1;

/**
 * Layout cache version. Baked into every cache fingerprint so that algorithm
 * or ConfigInput shape changes automatically invalidate stale layouts.
 */
export const LAYOUT_CACHE_VERSION = 1;

/**
 * Thrown when a stored DB (or an imported export file) was created by a
 * newer version of Cutlist than the one currently running. Prevents silent
 * data corruption by refusing to proceed.
 *
 * Raised from:
 * - `useIdb/db.ts` — translates Dexie's `VersionError` on open.
 * - `migrations.ts:migrateExport` — when an imported `.cutlist.gz` advertises
 *   a version greater than `SCHEMA_VERSION`.
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
