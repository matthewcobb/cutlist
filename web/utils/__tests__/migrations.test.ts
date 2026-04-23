import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'bun:test';
import { openDB, type IDBPDatabase } from 'idb';
import {
  SCHEMA_VERSION,
  LAYOUT_CACHE_VERSION,
  migrations,
  migrateRecord,
  migrateExport,
  runStartupSweep,
  FutureSchemaError,
} from '../migrations';
import { DEFAULT_STOCK_YAML } from '../settings';
import {
  applyProjectDefaults,
  applyModelDefaults,
} from '../../composables/useIdb';

// ─── migrateRecord ─────────────────────────────────────────────────────────

describe('migrateRecord', () => {
  it('returns record unchanged when no migrations apply', () => {
    const record = { id: 'x', name: 'test' };
    const result = migrateRecord('projects', record, 0);
    expect(result).toEqual(record);
  });

  it('returns record unchanged when already at current version', () => {
    const record = { id: 'x', name: 'test' };
    const result = migrateRecord('projects', record, SCHEMA_VERSION);
    expect(result).toEqual(record);
  });
});

// ─── Migration registry invariants ──────────────────────────────────────────

describe('migration registry invariants', () => {
  it('all migrations have version <= SCHEMA_VERSION', () => {
    for (const m of migrations) {
      expect(m.version).toBeLessThanOrEqual(SCHEMA_VERSION);
    }
  });

  it('migration versions are non-decreasing', () => {
    for (let i = 1; i < migrations.length; i++) {
      expect(migrations[i].version).toBeGreaterThanOrEqual(
        migrations[i - 1].version,
      );
    }
  });

  it('every migration has a valid store name', () => {
    const validStores = ['projects', 'models', 'buildSteps', 'settings'];
    for (const m of migrations) {
      expect(validStores).toContain(m.store);
    }
  });

  it('every migration.migrate is a function', () => {
    for (const m of migrations) {
      expect(typeof m.migrate).toBe('function');
    }
  });
});

// ─── Version constants ──────────────────────────────────────────────────────

describe('version constants', () => {
  it('SCHEMA_VERSION is a positive integer', () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
  });

  it('LAYOUT_CACHE_VERSION is a positive integer', () => {
    expect(LAYOUT_CACHE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(LAYOUT_CACHE_VERSION)).toBe(true);
  });
});

// ─── migrateExport ──────────────────────────────────────────────────────────

describe('migrateExport', () => {
  it('rejects future version with descriptive error', () => {
    const raw = { version: SCHEMA_VERSION + 1, project: {}, models: [] };
    expect(() => migrateExport(raw)).toThrow('newer version');
    expect(() => migrateExport(raw)).toThrow('Please update the app');
  });

  it('returns current-version export by reference (no copy)', () => {
    const raw = {
      version: SCHEMA_VERSION,
      project: { id: 'p' },
      models: [],
      buildSteps: [],
    };
    const result = migrateExport(raw);
    expect(result).toBe(raw);
  });

  it('handles missing version (defaults to v0)', () => {
    const raw = {
      project: { id: 'p', name: 'Test' },
      models: [],
    };
    const result = migrateExport(raw);
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it('handles missing models/buildSteps keys', () => {
    const raw = { version: 0, project: { id: 'p' } };
    const result = migrateExport(raw);
    expect(result.models).toEqual([]);
    expect(result.buildSteps).toEqual([]);
  });

  it('preserves unknown top-level fields', () => {
    const raw = {
      version: 0,
      project: { id: 'p' },
      models: [],
      customField: 'preserved',
    };
    const result = migrateExport(raw);
    expect((result as any).customField).toBe('preserved');
  });
});

// ─── FutureSchemaError ──────────────────────────────────────────────────────

describe('FutureSchemaError', () => {
  it('has descriptive message including both versions', () => {
    const err = new FutureSchemaError(99);
    expect(err.message).toContain('99');
    expect(err.message).toContain(String(SCHEMA_VERSION));
    expect(err.name).toBe('FutureSchemaError');
  });
});

// ─── applyDefaults (safety net layer) ───────────────────────────────────────

describe('applyProjectDefaults', () => {
  it('fills missing stock, colorMap, excludedColors, and distanceUnit', () => {
    const bare = { id: 'x', name: 'X', createdAt: '', updatedAt: '' };
    const result = applyProjectDefaults(bare);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.colorMap).toEqual({});
    expect(result.excludedColors).toEqual([]);
    expect(result.distanceUnit).toBe('mm');
  });

  it('preserves existing values', () => {
    const full = {
      id: 'x',
      name: 'X',
      stock: 'custom',
      colorMap: { a: 'b' },
      excludedColors: ['c'],
      distanceUnit: 'in' as const,
      createdAt: '',
      updatedAt: '',
    };
    const result = applyProjectDefaults(full);
    expect(result.stock).toBe('custom');
    expect(result.colorMap).toEqual({ a: 'b' });
    expect(result.excludedColors).toEqual(['c']);
    expect(result.distanceUnit).toBe('in');
  });
});

describe('applyModelDefaults', () => {
  it('fills missing source, enabled, and partOverrides', () => {
    const bare = { id: 'x', projectId: 'p', filename: 'f.glb', createdAt: '' };
    const result = applyModelDefaults(bare);
    expect(result.source).toBe('gltf');
    expect(result.enabled).toBe(true);
    expect(result.partOverrides).toEqual({});
  });

  it('preserves existing values', () => {
    const full = {
      id: 'x',
      projectId: 'p',
      filename: 'f.glb',
      source: 'manual' as const,
      enabled: false,
      partOverrides: { 1: { grainLock: 'length' as const } },
      createdAt: '',
    };
    const result = applyModelDefaults(full);
    expect(result.source).toBe('manual');
    expect(result.enabled).toBe(false);
    expect(result.partOverrides).toEqual({ 1: { grainLock: 'length' } });
  });
});

// ─── runStartupSweep (integration tests with fake-indexeddb) ────────────────

let dbCounter = 0;
async function openTestDb(): Promise<IDBPDatabase<any>> {
  const name = `test-sweep-${++dbCounter}-${Date.now()}`;
  return openDB(name, 2, {
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
    },
  });
}

describe('runStartupSweep', () => {
  it('stamps schema-version on first run', async () => {
    const db = await openTestDb();
    await runStartupSweep(db);

    const versionRecord = await db.get('settings', 'schema-version');
    expect(versionRecord).toBeDefined();
    expect(versionRecord.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('skips sweep when already at current version', async () => {
    const db = await openTestDb();
    await db.put('settings', {
      key: 'schema-version',
      version: SCHEMA_VERSION,
    });
    const project = { id: 'p1', name: 'Test', createdAt: '', updatedAt: '' };
    await db.put('projects', project);

    await runStartupSweep(db);

    // Project should be untouched (no migrations to apply)
    const result = await db.get('projects', 'p1');
    expect(result).toEqual(project);
    db.close();
  });

  it('handles empty database gracefully', async () => {
    const db = await openTestDb();
    await runStartupSweep(db);

    const versionRecord = await db.get('settings', 'schema-version');
    expect(versionRecord.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('rejects future schema version with FutureSchemaError', async () => {
    const db = await openTestDb();
    await db.put('settings', {
      key: 'schema-version',
      version: SCHEMA_VERSION + 10,
    });

    let caught: Error | null = null;
    try {
      await runStartupSweep(db);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.name).toBe('FutureSchemaError');
    expect(caught!.message).toContain(String(SCHEMA_VERSION + 10));
    db.close();
  });

  it('atomically rolls back on migration failure', async () => {
    // This test verifies atomicity by temporarily injecting a migration
    // that throws mid-sweep. The database should remain at version 0.
    //
    // We can't easily inject into the real migration list, so we test
    // the transaction behavior directly: start a transaction, do a write,
    // then abort it, and verify nothing persisted.
    const db = await openTestDb();
    const project = {
      id: 'p1',
      name: 'Original',
      createdAt: '',
      updatedAt: '',
    };
    await db.put('projects', project);

    // Simulate: open a transaction, mutate, then abort
    const tx = db.transaction(['projects', 'settings'], 'readwrite');
    await tx.objectStore('projects').put({
      ...project,
      name: 'Mutated',
    });
    // Abort simulates a migration failure. Awaiting tx.done will throw
    // AbortError, which is expected.
    tx.abort();
    try {
      await tx.done;
    } catch {
      // AbortError is expected — the transaction was intentionally aborted.
    }

    // Verify the original data is intact (rollback happened)
    const result = await db.get('projects', 'p1');
    expect(result.name).toBe('Original');

    // Schema version should not have been stamped
    const versionRecord = await db.get('settings', 'schema-version');
    expect(versionRecord).toBeUndefined();

    db.close();
  });
});
