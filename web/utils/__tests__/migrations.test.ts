import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'bun:test';
import { openDB, type IDBPDatabase } from 'idb';
import {
  SCHEMA_VERSION,
  migrations,
  migrateRecord,
  migrateExport,
  runStartupSweep,
} from '../migrations';
import { DEFAULT_STOCK_YAML, DEFAULT_SETTINGS } from '../settings';
import {
  applyProjectDefaults,
  applyModelDefaults,
} from '../../composables/useIdb';

// ─── Fixtures: realistic old records as they'd exist in IDB ──────────────────

/** v1 project: no stock, no colorMap (these fields were added later without migration) */
const V1_PROJECT = {
  id: 'p-001',
  name: 'My Desk',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
};

/** v2 project: has stock and colorMap (written by createProject after the field was added) */
const V2_PROJECT = {
  id: 'p-002',
  name: 'Bookshelf',
  stock:
    '- material: Oak\n  thickness: [18mm]\n  width: [300mm]\n  length: [2000mm]\n',
  colorMap: { '#8B4513': 'Oak', '#D2691E': 'Plywood' },
  createdAt: '2025-03-01T00:00:00.000Z',
  updatedAt: '2025-03-10T00:00:00.000Z',
};

/** v1 model: no source, no enabled (added without migration) */
const V1_MODEL = {
  id: 'm-001',
  projectId: 'p-001',
  filename: 'desk.glb',
  drafts: [
    {
      partNumber: 1,
      instanceNumber: 1,
      name: 'Top',
      colorKey: '#8B4513',
      size: { width: 0.6, length: 1.2, thickness: 0.018 },
    },
  ],
  colors: [{ key: '#8B4513', rgb: [0.545, 0.271, 0.075], count: 1 }],
  gltfJson: { scenes: [{ nodes: [0] }] },
  nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#8B4513' }],
  createdAt: '2025-01-01T00:00:00.000Z',
};

/** v2 model: has source and enabled */
const V2_MODEL = {
  ...V1_MODEL,
  id: 'm-002',
  source: 'manual' as const,
  enabled: false,
};

/** Settings record with only some fields (older version) */
const PARTIAL_SETTINGS = {
  key: 'global-settings' as const,
  settings: {
    bladeWidth: 3,
    distanceUnit: 'mm' as const,
  },
};

// ─── migrateRecord: project migrations ───────────────────────────────────────

describe('migrateRecord — projects', () => {
  it('v1 project (no stock/colorMap) gets defaults', () => {
    const result = migrateRecord('projects', V1_PROJECT, 2);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.colorMap).toEqual({});
    // Existing fields preserved
    expect(result.id).toBe('p-001');
    expect(result.name).toBe('My Desk');
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updatedAt).toBe('2025-01-15T00:00:00.000Z');
  });

  it('v2 project (has stock/colorMap) keeps existing values', () => {
    const result = migrateRecord('projects', V2_PROJECT, 2);
    expect(result.stock).toBe(V2_PROJECT.stock);
    expect(result.colorMap).toEqual(V2_PROJECT.colorMap);
  });

  it('project with archivedAt preserves it', () => {
    const archived = { ...V1_PROJECT, archivedAt: '2025-02-01T00:00:00.000Z' };
    const result = migrateRecord('projects', archived, 2);
    expect(result.archivedAt).toBe('2025-02-01T00:00:00.000Z');
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
  });

  it('does not mutate input', () => {
    const frozen = Object.freeze({ ...V1_PROJECT });
    const result = migrateRecord('projects', frozen, 2);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(frozen).not.toHaveProperty('stock');
  });

  it('skips when already at current version', () => {
    const result = migrateRecord('projects', V1_PROJECT, SCHEMA_VERSION);
    expect(result).toEqual(V1_PROJECT);
    expect(result).not.toHaveProperty('stock');
  });

  it('skips when ahead of current version', () => {
    const result = migrateRecord('projects', V1_PROJECT, SCHEMA_VERSION + 1);
    expect(result).toEqual(V1_PROJECT);
  });

  it('preserves unknown extra fields (forward compat)', () => {
    const withExtra = { ...V1_PROJECT, futureField: 'hello', anotherOne: 42 };
    const result = migrateRecord('projects', withExtra, 2);
    expect(result.futureField).toBe('hello');
    expect(result.anotherOne).toBe(42);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
  });
});

// ─── migrateRecord: model migrations ─────────────────────────────────────────

describe('migrateRecord — models', () => {
  it('v1 model (no source/enabled) gets defaults', () => {
    const result = migrateRecord('models', V1_MODEL, 2);
    expect(result.source).toBe('gltf');
    expect(result.enabled).toBe(true);
    // Existing fields preserved
    expect(result.id).toBe('m-001');
    expect(result.filename).toBe('desk.glb');
    expect(result.drafts).toHaveLength(1);
    expect(result.colors).toHaveLength(1);
    expect(result.gltfJson).toEqual({ scenes: [{ nodes: [0] }] });
  });

  it('v2 model (has source/enabled) keeps existing values', () => {
    const result = migrateRecord('models', V2_MODEL, 2);
    expect(result.source).toBe('manual');
    expect(result.enabled).toBe(false);
  });

  it('model with enabled=false is not overwritten to true', () => {
    const disabledGltf = { ...V1_MODEL, enabled: false };
    const result = migrateRecord('models', disabledGltf, 2);
    expect(result.enabled).toBe(false);
    expect(result.source).toBe('gltf');
  });

  it('preserves drafts with all part fields', () => {
    const modelWithGrain = {
      ...V1_MODEL,
      drafts: [
        {
          partNumber: 1,
          instanceNumber: 1,
          name: 'Side Panel',
          colorKey: '#8B4513',
          grainLock: 'length',
          sourcePartId: 'sp-1',
          size: { width: 0.4, length: 0.8, thickness: 0.018 },
        },
      ],
    };
    const result = migrateRecord('models', modelWithGrain, 2);
    expect(result.drafts[0].grainLock).toBe('length');
    expect(result.drafts[0].sourcePartId).toBe('sp-1');
  });

  it('does not mutate input', () => {
    const frozen = Object.freeze({ ...V1_MODEL });
    const result = migrateRecord('models', frozen, 2);
    expect(result.source).toBe('gltf');
    expect(frozen).not.toHaveProperty('source');
  });
});

// ─── migrateRecord: settings ─────────────────────────────────────────────────

describe('migrateRecord — settings', () => {
  it('backfills missing settings fields from defaults', () => {
    const result = migrateRecord('settings', PARTIAL_SETTINGS, 2);
    expect(result.settings.bladeWidth).toBe(3);
    expect(result.settings.distanceUnit).toBe('mm');
    // Backfilled from DEFAULT_SETTINGS
    expect(result.settings.extraSpace).toBe(DEFAULT_SETTINGS.extraSpace);
    expect(result.settings.optimize).toBe(DEFAULT_SETTINGS.optimize);
    expect(result.settings.showPartNumbers).toBe(
      DEFAULT_SETTINGS.showPartNumbers,
    );
    expect(result.settings.stock).toBe(DEFAULT_SETTINGS.stock);
  });

  it('preserves existing settings values over defaults', () => {
    const custom = {
      key: 'global-settings' as const,
      settings: {
        ...DEFAULT_SETTINGS,
        bladeWidth: 5,
        optimize: 'CNC' as const,
      },
    };
    const result = migrateRecord('settings', custom, 2);
    expect(result.settings.bladeWidth).toBe(5);
    expect(result.settings.optimize).toBe('CNC');
  });

  it('handles missing settings object entirely', () => {
    const empty = { key: 'global-settings' };
    const result = migrateRecord('settings', empty, 2);
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });
});

// ─── migrateRecord: buildSteps (no v3 migration, should pass through) ────────

describe('migrateRecord — buildSteps', () => {
  it('passes through unchanged (no buildStep migrations yet)', () => {
    const step = {
      id: 'bs-1',
      projectId: 'p-001',
      stepNumber: 1,
      title: 'Attach sides',
      description: 'Glue and clamp',
      partRefs: [{ modelId: 'm-001', partNumber: 1 }],
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const result = migrateRecord('buildSteps', step, 2);
    expect(result).toEqual(step);
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('running project migration twice produces same result', () => {
    const once = migrateRecord('projects', V1_PROJECT, 2);
    const twice = migrateRecord('projects', once, 2);
    expect(twice).toEqual(once);
  });

  it('running model migration twice produces same result', () => {
    const once = migrateRecord('models', V1_MODEL, 2);
    const twice = migrateRecord('models', once, 2);
    expect(twice).toEqual(once);
  });

  it('running settings migration twice produces same result', () => {
    const once = migrateRecord('settings', PARTIAL_SETTINGS, 2);
    const twice = migrateRecord('settings', once, 2);
    expect(twice).toEqual(once);
  });
});

// ─── Migration registry invariants ───────────────────────────────────────────

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

// ─── migrateExport ───────────────────────────────────────────────────────────

describe('migrateExport', () => {
  it('migrates a v2 export with multiple models', () => {
    const raw = {
      version: 2,
      exportedAt: '2025-03-01T00:00:00.000Z',
      project: { ...V1_PROJECT },
      models: [
        { ...V1_MODEL, id: 'ma' },
        { ...V1_MODEL, id: 'mb', enabled: false },
      ],
      buildSteps: [
        {
          id: 'bs-1',
          projectId: 'p-001',
          stepNumber: 1,
          title: 'Step',
          description: '',
          partRefs: [],
          createdAt: '',
        },
      ],
      settings: { ...DEFAULT_SETTINGS },
    };
    const result = migrateExport(raw);

    expect(result.version).toBe(SCHEMA_VERSION);
    // Project migrated
    expect(result.project.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.project.colorMap).toEqual({});
    // Both models migrated
    expect(result.models).toHaveLength(2);
    expect(result.models[0].source).toBe('gltf');
    expect(result.models[0].enabled).toBe(true);
    expect(result.models[1].source).toBe('gltf');
    expect(result.models[1].enabled).toBe(false); // existing false preserved
    // Build steps passed through
    expect(result.buildSteps).toHaveLength(1);
    // Extra fields preserved
    expect(result.exportedAt).toBe('2025-03-01T00:00:00.000Z');
  });

  it('rejects future version with descriptive error', () => {
    const raw = { version: SCHEMA_VERSION + 1, project: {}, models: [] };
    expect(() => migrateExport(raw)).toThrow('newer version');
    expect(() => migrateExport(raw)).toThrow('Please update the app');
  });

  it('returns current-version export by reference (no copy)', () => {
    const raw = {
      version: SCHEMA_VERSION,
      project: { ...V2_PROJECT },
      models: [{ ...V2_MODEL }],
      buildSteps: [],
    };
    const result = migrateExport(raw);
    expect(result).toBe(raw); // same reference = no unnecessary work
  });

  it('handles missing version (defaults to v2)', () => {
    const raw = {
      project: { ...V1_PROJECT },
      models: [{ ...V1_MODEL }],
    };
    const result = migrateExport(raw);
    expect(result.version).toBe(SCHEMA_VERSION);
    expect(result.project.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.models[0].source).toBe('gltf');
  });

  it('handles empty models array', () => {
    const raw = {
      version: 2,
      project: { ...V2_PROJECT },
      models: [],
      buildSteps: [],
    };
    const result = migrateExport(raw);
    expect(result.version).toBe(SCHEMA_VERSION);
    expect(result.models).toEqual([]);
  });

  it('handles missing models/buildSteps keys', () => {
    const raw = {
      version: 2,
      project: { ...V1_PROJECT },
    };
    const result = migrateExport(raw);
    expect(result.models).toEqual([]);
    expect(result.buildSteps).toEqual([]);
    expect(result.project.stock).toBe(DEFAULT_STOCK_YAML);
  });

  it('preserves unknown top-level fields', () => {
    const raw = {
      version: 2,
      project: { ...V2_PROJECT },
      models: [],
      customField: 'preserved',
    };
    const result = migrateExport(raw);
    expect((result as any).customField).toBe('preserved');
  });
});

// ─── applyDefaults (safety net layer) ────────────────────────────────────────

describe('applyProjectDefaults', () => {
  it('fills missing stock and colorMap', () => {
    const result = applyProjectDefaults(V1_PROJECT);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.colorMap).toEqual({});
  });

  it('preserves existing stock and colorMap', () => {
    const result = applyProjectDefaults(V2_PROJECT);
    expect(result.stock).toBe(V2_PROJECT.stock);
    expect(result.colorMap).toEqual(V2_PROJECT.colorMap);
  });

  it('preserves all other fields', () => {
    const result = applyProjectDefaults(V1_PROJECT);
    expect(result.id).toBe(V1_PROJECT.id);
    expect(result.name).toBe(V1_PROJECT.name);
    expect(result.createdAt).toBe(V1_PROJECT.createdAt);
    expect(result.updatedAt).toBe(V1_PROJECT.updatedAt);
  });
});

describe('applyModelDefaults', () => {
  it('fills missing source and enabled', () => {
    const result = applyModelDefaults(V1_MODEL);
    expect(result.source).toBe('gltf');
    expect(result.enabled).toBe(true);
  });

  it('preserves existing source and enabled', () => {
    const result = applyModelDefaults(V2_MODEL);
    expect(result.source).toBe('manual');
    expect(result.enabled).toBe(false);
  });

  it('preserves drafts and colors', () => {
    const result = applyModelDefaults(V1_MODEL);
    expect(result.drafts).toEqual(V1_MODEL.drafts);
    expect(result.colors).toEqual(V1_MODEL.colors);
  });
});

// ─── End-to-end: full v1 record → current version ───────────────────────────

describe('full migration chain: v1 → current', () => {
  it('project goes from bare minimum to fully populated', () => {
    const bare = { id: 'x', name: 'X', createdAt: '', updatedAt: '' };
    const migrated = migrateRecord('projects', bare, 2);
    const withDefaults = applyProjectDefaults(migrated);

    // Both layers agree
    expect(migrated.stock).toBe(DEFAULT_STOCK_YAML);
    expect(withDefaults.stock).toBe(DEFAULT_STOCK_YAML);
    expect(migrated.colorMap).toEqual({});
    expect(withDefaults.colorMap).toEqual({});
  });

  it('model goes from bare minimum to fully populated', () => {
    const bare = {
      id: 'x',
      projectId: 'p',
      filename: 'f.glb',
      drafts: [],
      colors: [],
      gltfJson: null,
      nodePartMap: null,
      createdAt: '',
    };
    const migrated = migrateRecord('models', bare, 2);
    const withDefaults = applyModelDefaults(migrated);

    expect(migrated.source).toBe('gltf');
    expect(withDefaults.source).toBe('gltf');
    expect(migrated.enabled).toBe(true);
    expect(withDefaults.enabled).toBe(true);
  });

  it('applyDefaults alone handles unmigrated records (sweep missed)', () => {
    // Simulates a record that the sweep never touched
    const unmigrated = { id: 'x', name: 'X', createdAt: '', updatedAt: '' };
    const result = applyProjectDefaults(unmigrated);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.colorMap).toEqual({});
  });
});

// ─── runStartupSweep (integration tests with fake-indexeddb) ─────────────────

/** Helper: open a fresh test DB that mirrors the real cutlist-db schema. */
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
  it('migrates v1 project records in IDB', async () => {
    const db = await openTestDb();
    // Seed a bare v1-era project (no stock, no colorMap)
    await db.put('projects', { ...V1_PROJECT });

    await runStartupSweep(db);

    const project = await db.get('projects', V1_PROJECT.id);
    expect(project.stock).toBe(DEFAULT_STOCK_YAML);
    expect(project.colorMap).toEqual({});
    expect(project.name).toBe('My Desk');
    db.close();
  });

  it('migrates v1 model records (cursor-based)', async () => {
    const db = await openTestDb();
    await db.put('models', { ...V1_MODEL });

    await runStartupSweep(db);

    const model = await db.get('models', V1_MODEL.id);
    expect(model.source).toBe('gltf');
    expect(model.enabled).toBe(true);
    expect(model.drafts).toHaveLength(1);
    expect(model.gltfJson).toEqual({ scenes: [{ nodes: [0] }] });
    db.close();
  });

  it('preserves existing values during migration', async () => {
    const db = await openTestDb();
    await db.put('projects', { ...V2_PROJECT });
    await db.put('models', { ...V2_MODEL });

    await runStartupSweep(db);

    const project = await db.get('projects', V2_PROJECT.id);
    expect(project.stock).toBe(V2_PROJECT.stock);
    expect(project.colorMap).toEqual(V2_PROJECT.colorMap);

    const model = await db.get('models', V2_MODEL.id);
    expect(model.source).toBe('manual');
    expect(model.enabled).toBe(false);
    db.close();
  });

  it('migrates multiple records across stores', async () => {
    const db = await openTestDb();
    // Seed multiple projects and models
    await db.put('projects', { ...V1_PROJECT, id: 'p1' });
    await db.put('projects', { ...V1_PROJECT, id: 'p2', name: 'Second' });
    await db.put('models', { ...V1_MODEL, id: 'm1', projectId: 'p1' });
    await db.put('models', { ...V1_MODEL, id: 'm2', projectId: 'p1' });
    await db.put('models', { ...V1_MODEL, id: 'm3', projectId: 'p2' });

    await runStartupSweep(db);

    // All projects migrated
    const p1 = await db.get('projects', 'p1');
    const p2 = await db.get('projects', 'p2');
    expect(p1.stock).toBe(DEFAULT_STOCK_YAML);
    expect(p2.stock).toBe(DEFAULT_STOCK_YAML);

    // All models migrated
    for (const id of ['m1', 'm2', 'm3']) {
      const m = await db.get('models', id);
      expect(m.source).toBe('gltf');
      expect(m.enabled).toBe(true);
    }
    db.close();
  });

  it('stamps schema-version after sweep', async () => {
    const db = await openTestDb();
    await db.put('projects', { ...V1_PROJECT });

    await runStartupSweep(db);

    const versionRecord = await db.get('settings', 'schema-version');
    expect(versionRecord).toBeDefined();
    expect(versionRecord.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('skips sweep when already at current version', async () => {
    const db = await openTestDb();
    // Pre-stamp at current version
    await db.put('settings', {
      key: 'schema-version',
      version: SCHEMA_VERSION,
    });
    // Seed an unmigrated project — should NOT be touched
    await db.put('projects', { ...V1_PROJECT });

    await runStartupSweep(db);

    const project = await db.get('projects', V1_PROJECT.id);
    expect(project).not.toHaveProperty('stock'); // untouched
    db.close();
  });

  it('is idempotent (running twice has no effect)', async () => {
    const db = await openTestDb();
    await db.put('projects', { ...V1_PROJECT });

    await runStartupSweep(db);
    const afterFirst = await db.get('projects', V1_PROJECT.id);

    await db.put('settings', { key: 'schema-version', version: 2 }); // reset version to force re-run
    await runStartupSweep(db);
    const afterSecond = await db.get('projects', V1_PROJECT.id);

    expect(afterSecond).toEqual(afterFirst);
    db.close();
  });

  it('migrates settings store', async () => {
    const db = await openTestDb();
    await db.put('settings', {
      key: 'global-settings',
      settings: { bladeWidth: 5, distanceUnit: 'in' },
    });

    await runStartupSweep(db);

    const record = await db.get('settings', 'global-settings');
    expect(record.settings.bladeWidth).toBe(5); // preserved
    expect(record.settings.distanceUnit).toBe('in'); // preserved
    expect(record.settings.extraSpace).toBe(DEFAULT_SETTINGS.extraSpace); // backfilled
    expect(record.settings.optimize).toBe(DEFAULT_SETTINGS.optimize); // backfilled
    expect(record.settings.showPartNumbers).toBe(
      DEFAULT_SETTINGS.showPartNumbers,
    );
    db.close();
  });

  it('handles empty database gracefully', async () => {
    const db = await openTestDb();
    // No records at all — should not throw
    await runStartupSweep(db);

    const versionRecord = await db.get('settings', 'schema-version');
    expect(versionRecord.version).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('handles mixed old and new records', async () => {
    const db = await openTestDb();
    // Mix of v1 (no stock) and v2 (has stock) projects
    await db.put('projects', { ...V1_PROJECT, id: 'old' });
    await db.put('projects', { ...V2_PROJECT, id: 'new' });

    await runStartupSweep(db);

    const old = await db.get('projects', 'old');
    const newP = await db.get('projects', 'new');
    expect(old.stock).toBe(DEFAULT_STOCK_YAML); // backfilled
    expect(newP.stock).toBe(V2_PROJECT.stock); // preserved
    db.close();
  });
});
