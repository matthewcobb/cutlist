import 'fake-indexeddb/auto';
import { describe, expect, it } from 'bun:test';
import { openDB, type IDBPDatabase } from 'idb';
import {
  SCHEMA_VERSION,
  migrations,
  migrateRecord,
  migrateExport,
  runStartupSweep,
} from '../migrations';
import { DEFAULT_STOCK_YAML } from '../settings';
import {
  applyProjectDefaults,
  applyModelDefaults,
} from '../../composables/useIdb';

// ─── migrateRecord (no-op with empty migrations) ────────────────────────────

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

  it('migrations array is currently empty (clean slate)', () => {
    expect(migrations).toHaveLength(0);
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
});
