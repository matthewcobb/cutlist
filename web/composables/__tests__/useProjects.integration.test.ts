/**
 * Integration tests for useProjects that exercise the full IDB round-trip
 * for manual part management and model hydration.
 *
 * These tests construct IDB records directly and verify that hydrateModel
 * produces the correct Model output. They do NOT use the composable's
 * module-level reactive state (which requires Vue runtime).
 */
import { describe, expect, it } from 'bun:test';
import { useIdb, type IdbModel } from '../useIdb';
import type { Part } from '~/utils/modelTypes';
import type { PartOverride } from '../useIdb';

/** Mirror of applyOverrides from useProjects.ts (can't import due to Nuxt auto-imports). */
function applyOverrides(
  parts: Part[],
  overrides: Record<number, PartOverride>,
): Part[] {
  if (Object.keys(overrides).length === 0) return parts;
  return parts.map((p) => {
    const o = overrides[p.partNumber];
    return o ? { ...p, ...o } : p;
  });
}

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

// ─── Manual model round-trip ────────────────────────────────────────────────

describe('manual model IDB round-trip', () => {
  it('stores and retrieves manual parts with overrides', async () => {
    const project = await idb.createProject('ManualModelTest');
    const modelId = crypto.randomUUID();

    const parts: Part[] = [
      makePart(1, { name: 'Rail', instanceNumber: 1 }),
      makePart(1, { name: 'Rail', instanceNumber: 2 }),
      makePart(2, { name: 'Stile' }),
    ];

    const model: IdbModel = {
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts,
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
      partOverrides: { 1: { grainLock: 'length' } },
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const full = await idb.getProjectWithModels(project.id);
    expect(full).toBeDefined();
    expect(full!.models).toHaveLength(1);

    const meta = full!.models[0];
    expect(meta.source).toBe('manual');
    expect(meta.parts).toHaveLength(3);
    expect(meta.partOverrides).toEqual({ 1: { grainLock: 'length' } });

    // applyOverrides should merge correctly
    const hydrated = applyOverrides(meta.parts, meta.partOverrides);
    expect(hydrated[0].grainLock).toBe('length');
    expect(hydrated[1].grainLock).toBe('length'); // same partNumber
    expect(hydrated[2].grainLock).toBeUndefined(); // partNumber 2
  });

  it('updates partOverrides independently of parts', async () => {
    const project = await idb.createProject('OverrideUpdate');
    const modelId = crypto.randomUUID();

    const model: IdbModel = {
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1), makePart(2)],
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    // Add an override
    await idb.updateModel(modelId, {
      partOverrides: { 1: { grainLock: 'width' } },
    });
    await idb.flushPendingModelWrites();

    const full = await idb.getProjectWithModels(project.id);
    const meta = full!.models[0];
    expect(meta.partOverrides).toEqual({ 1: { grainLock: 'width' } });
    // Parts should be unchanged
    expect(meta.parts).toHaveLength(2);
  });

  it('handles model with no parts and no overrides', async () => {
    const project = await idb.createProject('EmptyManualModel');
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: [],
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const full = await idb.getProjectWithModels(project.id);
    const hydrated = applyOverrides(
      full!.models[0].parts,
      full!.models[0].partOverrides,
    );
    expect(hydrated).toEqual([]);
  });
});

// ─── GLTF model metadata ────────────────────────────────────────────────────

describe('GLTF model IDB metadata', () => {
  it('strips rawSource from model metadata in getProjectWithModels', async () => {
    const project = await idb.createProject('GltfMetaTest');
    const modelId = crypto.randomUUID();

    const model: IdbModel = {
      id: modelId,
      projectId: project.id,
      filename: 'test.glb',
      source: 'gltf',
      parts: [makePart(1)],
      colors: [{ key: '#fff', rgb: [1, 1, 1], count: 1 }],
      nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#fff' }],
      enabled: true,
      rawSource: { scenes: [], nodes: [], meshes: [], accessors: [] },
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0]).not.toHaveProperty('rawSource');

    // But getModelRawSource should still return it
    const gltf = await idb.getModelRawSource(modelId);
    expect(gltf).toEqual({ scenes: [], nodes: [], meshes: [], accessors: [] });
  });

  it('stores and retrieves colors and nodePartMap for GLTF models', async () => {
    const project = await idb.createProject('GltfDerivedDataTest');
    const modelId = crypto.randomUUID();

    const model: IdbModel = {
      id: modelId,
      projectId: project.id,
      filename: 'test.glb',
      source: 'gltf',
      parts: [makePart(1)],
      colors: [{ key: '#fff', rgb: [1, 1, 1], count: 1 }],
      nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#fff' }],
      enabled: true,
      rawSource: {},
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].colors).toHaveLength(1);
    expect(full!.models[0].colors[0].key).toBe('#fff');
    expect(full!.models[0].nodePartMap).toHaveLength(1);
    expect(full!.models[0].nodePartMap[0].partNumber).toBe(1);
    expect(full!.models[0].parts).toHaveLength(1);
  });
});

// ─── Multiple models per project ─────────────────────────────────────────────

describe('multiple models per project', () => {
  it('returns all models for a project', async () => {
    const project = await idb.createProject('MultiModelTest');
    for (let i = 0; i < 3; i++) {
      const model: IdbModel = {
        id: crypto.randomUUID(),
        projectId: project.id,
        filename: `model-${i}.glb`,
        source: i === 0 ? 'manual' : 'gltf',
        parts: [makePart(1, { name: `Part from model ${i}` })],
        colors: [],
        nodePartMap: [],
        enabled: true,
        rawSource: i === 0 ? null : { mock: true },
        partOverrides: {},
        createdAt: new Date().toISOString(),
      };
      await idb.createModel(model);
    }

    const full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(3);
  });

  it('removing a model does not affect other models', async () => {
    const project = await idb.createProject('RemoveModelTest');
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      const model: IdbModel = {
        id,
        projectId: project.id,
        filename: `model-${i}.glb`,
        source: 'manual',
        parts: [],
        colors: [],
        nodePartMap: [],
        enabled: true,
        rawSource: null,
        partOverrides: {},
        createdAt: new Date().toISOString(),
      };
      await idb.createModel(model);
    }

    await idb.deleteModel(ids[1]);

    const full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(2);
    expect(full!.models.map((m) => m.id).sort()).toEqual(
      [ids[0], ids[2]].sort(),
    );
  });
});
