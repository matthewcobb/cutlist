import { describe, expect, it } from 'bun:test';
import { SCHEMA_VERSION, FutureSchemaError } from '../../versions';
import { migrations, migrateRecord, migrateExport } from '../migrations';
import { DEFAULT_SETTINGS, DEFAULT_STOCK_YAML } from '../../settings';
import {
  applyProjectDefaults,
  applyModelDefaults,
} from '../../../composables/useIdb';

// ─── migrateRecord ─────────────────────────────────────────────────────────

describe('migrateRecord', () => {
  it('returns record unchanged when no migrations apply', () => {
    const record = { id: 'x', name: 'test' };
    const result = migrateRecord('projects', record, SCHEMA_VERSION);
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
    const validStores = ['projects', 'models', 'buildSteps'];
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
  it('fills missing stock, colorMap, excludedColors, distanceUnit, and packing settings', () => {
    const bare = { id: 'x', name: 'X', createdAt: '', updatedAt: '' };
    const result = applyProjectDefaults(bare);
    expect(result.stock).toBe(DEFAULT_STOCK_YAML);
    expect(result.colorMap).toEqual({});
    expect(result.excludedColors).toEqual([]);
    expect(result.distanceUnit).toBe(DEFAULT_SETTINGS.distanceUnit);
    expect(result.bladeWidth).toBe(DEFAULT_SETTINGS.bladeWidth);
    expect(result.margin).toBe(DEFAULT_SETTINGS.margin);
    expect(result.optimize).toBe(DEFAULT_SETTINGS.optimize);
    expect(result.showPartNumbers).toBe(DEFAULT_SETTINGS.showPartNumbers);
  });

  it('preserves existing values', () => {
    const full = {
      id: 'x',
      name: 'X',
      stock: 'custom',
      colorMap: { a: 'b' },
      excludedColors: ['c'],
      distanceUnit: 'in' as const,
      bladeWidth: 4.2,
      margin: 1.5,
      optimize: 'CNC' as const,
      showPartNumbers: false,
      createdAt: '',
      updatedAt: '',
    };
    const result = applyProjectDefaults(full);
    expect(result.stock).toBe('custom');
    expect(result.colorMap).toEqual({ a: 'b' });
    expect(result.excludedColors).toEqual(['c']);
    expect(result.distanceUnit).toBe('in');
    expect(result.bladeWidth).toBe(4.2);
    expect(result.margin).toBe(1.5);
    expect(result.optimize).toBe('CNC');
    expect(result.showPartNumbers).toBe(false);
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
      colors: [
        { key: '#fff', rgb: [1, 1, 1] as [number, number, number], count: 1 },
      ],
      nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#fff' }],
      createdAt: '',
    };
    const result = applyModelDefaults(full);
    expect(result.source).toBe('manual');
    expect(result.enabled).toBe(false);
    expect(result.partOverrides).toEqual({ 1: { grainLock: 'length' } });
    expect(result.colors).toHaveLength(1);
    expect(result.nodePartMap).toHaveLength(1);
  });
});
