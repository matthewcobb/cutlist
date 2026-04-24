/**
 * Tests for useModelHydration — applyOverrides, hydrateModel, and loadProject.
 *
 * applyOverrides is a pure function and can be tested directly.
 * hydrateModel and loadProject depend on the computation worker (deriveModel)
 * which spawns a Web Worker unavailable in Bun tests. We mock that module
 * and exercise the hydration logic with real IDB via fake-indexeddb.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it, mock, beforeEach } from 'bun:test';
import type { Part, ColorInfo, NodePartMapping } from '~/utils/parseGltf';
import { DERIVE_VERSION } from '~/utils/parseGltf';
import type { IdbModel, IdbModelMeta, PartOverride } from '../useIdb';
import { useIdb } from '../useIdb';

// Mock deriveModel — the worker is not available in Bun tests.
// We replace it with a function that returns a deterministic DeriveResult.
// Preserve all other exports from the real module to avoid breaking tests
// that import cancelLayouts, computeLayouts, etc. from the same module.
const mockDeriveModel = mock(async (_gltfJson: object) => ({
  parts: [makePart(1, { name: 'Derived Part' })],
  colors: [
    { key: '#fff', rgb: [1, 1, 1] as [number, number, number], count: 1 },
  ],
  nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#fff' }],
}));

mock.module('../useComputationWorker', () => ({
  deriveModel: mockDeriveModel,
  computeLayouts: mock(async () => ({ layouts: [], leftovers: [] })),
  cancelLayouts: mock(() => {}),
  PART_COUNT_SOFT_LIMIT: 500,
  PART_COUNT_HARD_LIMIT: 2000,
  PartCountExceededError: class extends Error {
    constructor(count: number) {
      super(`Too many parts (${count}).`);
      this.name = 'PartCountExceededError';
    }
  },
}));

// Import after mocking so the mock is in effect.
const { applyOverrides, hydrateModel, loadProject } =
  await import('../useModelHydration');

const idb = useIdb();

function makePart(partNumber: number, overrides?: Partial<Part>): Part {
  return {
    partNumber,
    instanceNumber: 1,
    name: `Part ${partNumber}`,
    colorKey: '#aaa',
    size: { width: 0.3, length: 0.5, thickness: 0.018 },
    ...overrides,
  };
}

// ─── applyOverrides ────────────────────────────────────────────────────────

describe('applyOverrides', () => {
  it('returns identity when overrides are empty', () => {
    const parts = [makePart(1), makePart(2)];
    const result = applyOverrides(parts, {});
    expect(result).toBe(parts); // same reference, not a copy
  });

  it('applies grainLock override correctly', () => {
    const parts = [makePart(1), makePart(2)];
    const result = applyOverrides(parts, { 1: { grainLock: 'length' } });
    expect(result[0].grainLock).toBe('length');
    expect(result[1].grainLock).toBeUndefined();
  });

  it('applies name override', () => {
    const parts = [makePart(1, { name: 'Original' })];
    const result = applyOverrides(parts, { 1: { name: 'Renamed' } });
    expect(result[0].name).toBe('Renamed');
  });

  it('applies multiple overrides on different partNumbers', () => {
    const parts = [makePart(1), makePart(2), makePart(3)];
    const result = applyOverrides(parts, {
      1: { grainLock: 'width' },
      3: { name: 'Third Override' },
    });
    expect(result[0].grainLock).toBe('width');
    expect(result[1]).toEqual(parts[1]);
    expect(result[2].name).toBe('Third Override');
  });

  it('override for non-existent partNumber is harmless', () => {
    const parts = [makePart(1)];
    const result = applyOverrides(parts, { 99: { grainLock: 'width' } });
    expect(result).toHaveLength(1);
    expect(result[0].grainLock).toBeUndefined();
    // partNumber 1 is unchanged
    expect(result[0].name).toBe('Part 1');
  });

  it('does not mutate the input Part array', () => {
    const parts = [makePart(1), makePart(2)];
    const originals = parts.map((p) => ({ ...p }));
    applyOverrides(parts, { 1: { grainLock: 'length', name: 'Modified' } });
    expect(parts[0]).toEqual(originals[0]);
    expect(parts[1]).toEqual(originals[1]);
  });
});

// ─── hydrateModel ──────────────────────────────────────────────────────────

describe('hydrateModel', () => {
  beforeEach(() => {
    mockDeriveModel.mockClear();
  });

  it('manual model returns stored parts directly', async () => {
    const meta: IdbModelMeta = {
      id: 'manual-1',
      projectId: 'p1',
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Rail' }), makePart(2, { name: 'Stile' })],
      enabled: true,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    expect(model.id).toBe('manual-1');
    expect(model.source).toBe('manual');
    expect(model.parts).toHaveLength(2);
    expect(model.parts[0].name).toBe('Rail');
    expect(model.colors).toEqual([]);
    expect(model.enabled).toBe(true);
    // deriveModel should NOT be called for manual models
    expect(mockDeriveModel).not.toHaveBeenCalled();
  });

  it('manual model applies partOverrides', async () => {
    const meta: IdbModelMeta = {
      id: 'manual-2',
      projectId: 'p1',
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Rail' })],
      enabled: true,
      partOverrides: { 1: { grainLock: 'width' } },
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    expect(model.parts[0].grainLock).toBe('width');
  });

  it('GLTF model with valid derivedCache uses cache (no re-derive)', async () => {
    const cachedParts = [makePart(1, { name: 'Cached Part' })];
    const cachedColors: ColorInfo[] = [
      { key: '#abc', rgb: [0.5, 0.5, 0.5], count: 1 },
    ];
    const cachedNodeMap: NodePartMapping[] = [
      { nodeIndex: 0, partNumber: 1, colorHex: '#abc' },
    ];

    const meta: IdbModelMeta = {
      id: 'gltf-cached',
      projectId: 'p1',
      filename: 'test.glb',
      source: 'gltf',
      parts: [], // raw parts (unused when cache is valid)
      enabled: true,
      partOverrides: {},
      derivedCache: {
        version: DERIVE_VERSION,
        parts: cachedParts,
        colors: cachedColors,
        nodePartMap: cachedNodeMap,
      },
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    expect(model.parts).toEqual(cachedParts);
    expect(model.colors).toEqual(cachedColors);
    expect(model.nodePartMap).toEqual(cachedNodeMap);
    // Should NOT call deriveModel since cache version matches
    expect(mockDeriveModel).not.toHaveBeenCalled();
  });

  it('GLTF model with valid cache still applies partOverrides', async () => {
    const meta: IdbModelMeta = {
      id: 'gltf-cached-overrides',
      projectId: 'p1',
      filename: 'test.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      partOverrides: { 1: { name: 'Overridden Name' } },
      derivedCache: {
        version: DERIVE_VERSION,
        parts: [makePart(1, { name: 'Original' })],
        colors: [],
        nodePartMap: [],
      },
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    expect(model.parts[0].name).toBe('Overridden Name');
  });

  it('GLTF model with stale cache version triggers re-derive', async () => {
    // Create a real IDB model so getModelGltf can return the gltfJson
    const project = await idb.createProject('HydrateStaleCache');
    const modelId = crypto.randomUUID();
    const gltfJson = { scenes: [], nodes: [], meshes: [] };

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'stale.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      gltfJson,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    const meta: IdbModelMeta = {
      id: modelId,
      projectId: project.id,
      filename: 'stale.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      partOverrides: {},
      derivedCache: {
        version: DERIVE_VERSION - 1, // stale
        parts: [makePart(1, { name: 'Stale Cached' })],
        colors: [],
        nodePartMap: [],
      },
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    // Should have called deriveModel with the gltfJson from IDB
    expect(mockDeriveModel).toHaveBeenCalledTimes(1);
    expect(mockDeriveModel).toHaveBeenCalledWith(gltfJson);
    // Should use the derived result, not the stale cache
    expect(model.parts[0].name).toBe('Derived Part');
  });

  it('GLTF model with no cache and no gltfJson returns fallback', async () => {
    const meta: IdbModelMeta = {
      id: 'gltf-no-data',
      projectId: 'p1',
      filename: 'missing.glb',
      source: 'gltf',
      parts: [makePart(1, { name: 'Fallback Part' })],
      enabled: true,
      partOverrides: {},
      // no derivedCache
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    // No cache, no gltfJson found in IDB => falls back to meta.parts
    expect(model.parts[0].name).toBe('Fallback Part');
    expect(model.colors).toEqual([]);
    expect(mockDeriveModel).not.toHaveBeenCalled();
  });

  it('GLTF model with deriveModel failure returns fallback', async () => {
    // Create a real IDB model with gltfJson
    const project = await idb.createProject('HydrateDeriveFail');
    const modelId = crypto.randomUUID();

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'fail.glb',
      source: 'gltf',
      parts: [makePart(1, { name: 'Raw Part' })],
      enabled: true,
      gltfJson: { scenes: [] },
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    // Make deriveModel throw
    mockDeriveModel.mockImplementationOnce(async () => {
      throw new Error('Worker exploded');
    });

    const meta: IdbModelMeta = {
      id: modelId,
      projectId: project.id,
      filename: 'fail.glb',
      source: 'gltf',
      parts: [makePart(1, { name: 'Raw Part' })],
      enabled: true,
      partOverrides: {},
      // no derivedCache
      createdAt: new Date().toISOString(),
    };

    const model = await hydrateModel(meta, idb);
    // deriveModel was called and threw
    expect(mockDeriveModel).toHaveBeenCalledTimes(1);
    // Falls back to meta.parts
    expect(model.parts[0].name).toBe('Raw Part');
    expect(model.colors).toEqual([]);
  });
});

// ─── loadProject ───────────────────────────────────────────────────────────

describe('loadProject', () => {
  beforeEach(() => {
    mockDeriveModel.mockClear();
  });

  it('loads project + models from IDB', async () => {
    const project = await idb.createProject('LoadProjectTest');
    const modelId = crypto.randomUUID();

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Shelf' })],
      enabled: true,
      gltfJson: null,
      partOverrides: { 1: { grainLock: 'length' } },
      createdAt: new Date().toISOString(),
    });

    const result = await loadProject(idb, project.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(project.id);
    expect(result!.name).toBe('LoadProjectTest');
    expect(result!.models).toHaveLength(1);
    expect(result!.models[0].parts[0].name).toBe('Shelf');
    expect(result!.models[0].parts[0].grainLock).toBe('length');
  });

  it('returns null for non-existent project', async () => {
    const result = await loadProject(idb, 'does-not-exist');
    expect(result).toBeNull();
  });

  it('loads project with multiple models', async () => {
    const project = await idb.createProject('MultiModel');

    await idb.createModel({
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1)],
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    await idb.createModel({
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'Second Manual',
      source: 'manual',
      parts: [makePart(2)],
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    const result = await loadProject(idb, project.id);
    expect(result).not.toBeNull();
    expect(result!.models).toHaveLength(2);
  });
});
