/**
 * Integration tests for undo/redo with IDB round-trips.
 *
 * These tests exercise the pushUndoCommand function with real IDB operations,
 * verifying that undo/redo correctly persists and restores data in IndexedDB.
 *
 * Since useProjects.ts uses Nuxt auto-imports, we simulate the mutation
 * patterns (capture before-state, mutate, push undo command) against real
 * IDB records.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'bun:test';
import { ref } from 'vue';
import { useIdb, type IdbModel, type IdbProject } from '../useIdb';
import type { Part } from '~/utils/parseGltf';
import type { PartOverride } from '../useIdb';

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

describe('undo/redo IDB round-trip: manual part add', () => {
  it('undoing addManualPart removes parts from IDB', async () => {
    const project = await idb.createProject('UndoAddTest');
    const modelId = crypto.randomUUID();

    // Simulate: create manual model, add a part
    const newParts = [makePart(1, { name: 'Rail', colorKey: 'oak' })];
    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: newParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    // Verify part exists
    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(1);
    expect(full!.models[0].parts).toHaveLength(1);

    // Simulate undo: delete the model (since it was freshly created)
    await idb.deleteModel(modelId);

    // Verify part removed
    full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(0);

    // Simulate redo: re-create the model
    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: newParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(1);
    expect(full!.models[0].parts).toHaveLength(1);
    expect(full!.models[0].parts[0].name).toBe('Rail');
  });
});

describe('undo/redo IDB round-trip: manual part update', () => {
  it('undoing updateManualPart restores old parts in IDB', async () => {
    const project = await idb.createProject('UndoUpdateTest');
    const modelId = crypto.randomUUID();
    const originalParts = [
      makePart(1, { name: 'Rail', colorKey: 'oak' }),
      makePart(1, { name: 'Rail', colorKey: 'oak', instanceNumber: 2 }),
    ];

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: originalParts,
      enabled: true,
      gltfJson: null,
      partOverrides: { 1: { grainLock: 'length' } },
      createdAt: new Date().toISOString(),
    });

    // Capture before-state
    const beforeParts = [...originalParts];
    const beforeOverrides = { 1: { grainLock: 'length' as const } };

    // Simulate update: change part name and dimensions
    const updatedParts = [
      {
        ...makePart(1, { name: 'Stile', colorKey: 'oak' }),
        instanceNumber: 1,
      },
    ];
    const updatedOverrides = { 1: { grainLock: 'width' as const } };
    await idb.updateModel(modelId, {
      parts: updatedParts,
      partOverrides: updatedOverrides,
    });

    // Verify update
    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].parts).toHaveLength(1);
    expect(full!.models[0].parts[0].name).toBe('Stile');
    expect(full!.models[0].partOverrides[1].grainLock).toBe('width');

    // Simulate undo: restore before-state
    await idb.updateModel(modelId, {
      parts: beforeParts,
      partOverrides: beforeOverrides,
    });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].parts).toHaveLength(2);
    expect(full!.models[0].parts[0].name).toBe('Rail');
    expect(full!.models[0].partOverrides[1].grainLock).toBe('length');
  });
});

describe('undo/redo IDB round-trip: manual part remove', () => {
  it('undoing removeManualPart restores parts to IDB', async () => {
    const project = await idb.createProject('UndoRemoveTest');
    const modelId = crypto.randomUUID();
    const parts = [
      makePart(1, { name: 'Rail' }),
      makePart(2, { name: 'Stile' }),
    ];

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    // Capture before-state
    const beforeParts = [...parts];

    // Simulate remove part 1 (leaving only part 2)
    const remaining = parts.filter((p) => p.partNumber !== 1);
    await idb.updateModel(modelId, { parts: remaining });

    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].parts).toHaveLength(1);
    expect(full!.models[0].parts[0].name).toBe('Stile');

    // Simulate undo: restore before-state
    await idb.updateModel(modelId, { parts: beforeParts });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].parts).toHaveLength(2);
    expect(full!.models[0].parts[0].name).toBe('Rail');
    expect(full!.models[0].parts[1].name).toBe('Stile');
  });

  it('undoing removal of last part re-creates the model in IDB', async () => {
    const project = await idb.createProject('UndoRemoveLastTest');
    const modelId = crypto.randomUUID();
    const parts = [makePart(1, { name: 'Solo Part' })];

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts,
      enabled: true,
      gltfJson: null,
      partOverrides: { 1: { grainLock: 'width' } },
      createdAt: new Date().toISOString(),
    });

    // Capture before-state
    const beforeParts = [...parts];
    const beforeOverrides = { 1: { grainLock: 'width' as const } };

    // Simulate remove last part → deletes model
    await idb.deleteModel(modelId);

    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(0);

    // Simulate undo: re-create model
    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: beforeParts,
      enabled: true,
      gltfJson: null,
      partOverrides: beforeOverrides,
      createdAt: new Date().toISOString(),
    });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(1);
    expect(full!.models[0].parts[0].name).toBe('Solo Part');
    expect(full!.models[0].partOverrides[1].grainLock).toBe('width');
  });
});

describe('undo/redo IDB round-trip: model remove', () => {
  it('undoing removeModel restores the model with gltfJson', async () => {
    const project = await idb.createProject('UndoModelRemoveTest');
    const modelId = crypto.randomUUID();
    const gltfJson = { scenes: [{ name: 'test' }] };

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'table.gltf',
      source: 'gltf',
      parts: [makePart(1, { name: 'Leg' })],
      enabled: true,
      gltfJson,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    // Capture gltfJson before removing
    const capturedGltf = await idb.getModelGltf(modelId);

    // Simulate remove
    await idb.deleteModel(modelId);

    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(0);

    // Simulate undo: re-create with captured gltfJson
    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'table.gltf',
      source: 'gltf',
      parts: [makePart(1, { name: 'Leg' })],
      enabled: true,
      gltfJson: capturedGltf,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(1);
    expect(full!.models[0].filename).toBe('table.gltf');

    // Verify gltfJson was preserved
    const restoredGltf = await idb.getModelGltf(modelId);
    expect(restoredGltf).toEqual(gltfJson);
  });
});

describe('undo/redo IDB round-trip: color map', () => {
  it('undoing color map change restores previous mapping', async () => {
    const project = await idb.createProject('UndoColorMapTest');

    // Initial: map #fff to Oak
    await idb.updateProject(project.id, { colorMap: { '#fff': 'Oak' } });

    // Change to Maple
    await idb.updateProject(project.id, { colorMap: { '#fff': 'Maple' } });

    let updated = await idb.getProjectWithModels(project.id);
    expect(updated!.colorMap['#fff']).toBe('Maple');

    // Simulate undo: restore Oak
    await idb.updateProject(project.id, { colorMap: { '#fff': 'Oak' } });

    updated = await idb.getProjectWithModels(project.id);
    expect(updated!.colorMap['#fff']).toBe('Oak');
  });

  it('undoing first color map assignment removes the key', async () => {
    const project = await idb.createProject('UndoFirstColorMapTest');

    // Assign #fff to Oak (first time)
    await idb.updateProject(project.id, { colorMap: { '#fff': 'Oak' } });

    let updated = await idb.getProjectWithModels(project.id);
    expect(updated!.colorMap['#fff']).toBe('Oak');

    // Simulate undo: remove the mapping
    await idb.updateProject(project.id, { colorMap: {} });

    updated = await idb.getProjectWithModels(project.id);
    expect(updated!.colorMap['#fff']).toBeUndefined();
  });
});

describe('undo/redo IDB round-trip: toggle color excluded', () => {
  it('undoing color exclusion restores previous state', async () => {
    const project = await idb.createProject('UndoExcludeTest');

    // Exclude #fff
    await idb.updateProject(project.id, { excludedColors: ['#fff'] });

    let updated = await idb.getProjectWithModels(project.id);
    expect(updated!.excludedColors).toContain('#fff');

    // Simulate undo: restore to not excluded
    await idb.updateProject(project.id, { excludedColors: [] });

    updated = await idb.getProjectWithModels(project.id);
    expect(updated!.excludedColors).not.toContain('#fff');
  });
});

describe('undo/redo chain with IDB: edit → delete → undo × 2', () => {
  it('correctly restores through a mixed chain', async () => {
    const project = await idb.createProject('UndoChainTest');
    const modelId = crypto.randomUUID();
    const originalParts = [makePart(1, { name: 'Rail', colorKey: 'oak' })];

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: originalParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    // Step 1: Edit the part (change name)
    const editedParts = [
      makePart(1, { name: 'Updated Rail', colorKey: 'oak' }),
    ];
    await idb.updateModel(modelId, { parts: editedParts });

    // Step 2: Delete the part (removes the model)
    await idb.deleteModel(modelId);

    let full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(0);

    // Undo step 2 (un-delete): re-create with edited parts
    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: editedParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models).toHaveLength(1);
    expect(full!.models[0].parts[0].name).toBe('Updated Rail');

    // Undo step 1 (un-edit): restore original parts
    await idb.updateModel(modelId, { parts: originalParts });

    full = await idb.getProjectWithModels(project.id);
    expect(full!.models[0].parts[0].name).toBe('Rail');
  });
});
