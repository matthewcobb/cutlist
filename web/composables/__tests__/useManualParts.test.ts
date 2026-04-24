/**
 * Tests for useManualParts — addManualPart, removeManualPart, updateManualPart.
 *
 * These functions take a context object with a real IDB (fake-indexeddb) and
 * a ref-like activeProjectData. We use Vue's ref() for the reactive wrapper.
 */
import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { ref, type Ref } from 'vue';
import { useIdb, type IdbModel } from '../useIdb';
import type { Part } from '~/utils/parseGltf';
import type { Project, ManualPartInput } from '../useProjects';
import { useManualParts } from '../useManualParts';
import { DEFAULT_SETTINGS } from '../../utils/settings';

const idb = useIdb();
const mockUpdateColorMap = mock(async () => {});

function makeProject(id: string, models: Project['models'] = []): Project {
  return {
    id,
    name: 'Test Project',
    models,
    colorMap: {},
    excludedColors: [],
    stock: '',
    distanceUnit: DEFAULT_SETTINGS.distanceUnit,
    bladeWidth: DEFAULT_SETTINGS.bladeWidth,
    margin: DEFAULT_SETTINGS.margin,
    optimize: DEFAULT_SETTINGS.optimize,
    showPartNumbers: DEFAULT_SETTINGS.showPartNumbers,
  };
}

function makeManualModel(id: string, parts: Part[]): Project['models'][number] {
  return {
    id,
    filename: 'Manual Parts',
    source: 'manual',
    parts,
    colors: [],
    enabled: true,
  };
}

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

function makeInput(overrides?: Partial<ManualPartInput>): ManualPartInput {
  return {
    name: 'Side Panel',
    widthMm: 300,
    lengthMm: 600,
    thicknessMm: 18,
    qty: 1,
    material: 'Plywood',
    ...overrides,
  };
}

describe('addManualPart', () => {
  let activeProjectData: Ref<Project | null>;
  let projectId: string;

  beforeEach(async () => {
    mockUpdateColorMap.mockClear();
    const project = await idb.createProject(
      'ManualPartTest-' + crypto.randomUUID().slice(0, 8),
    );
    projectId = project.id;
    activeProjectData = ref(makeProject(projectId));
  });

  it('creates a part with correct defaults', async () => {
    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart(
      projectId,
      makeInput({
        name: 'Shelf',
        widthMm: 400,
        lengthMm: 800,
        thicknessMm: 18,
        qty: 1,
        material: 'Oak',
      }),
    );

    const project = activeProjectData.value!;
    expect(project.models).toHaveLength(1);

    const model = project.models[0];
    expect(model.source).toBe('manual');
    expect(model.filename).toBe('Manual Parts');
    expect(model.parts).toHaveLength(1);

    const part = model.parts[0];
    expect(part.partNumber).toBe(1);
    expect(part.instanceNumber).toBe(1);
    expect(part.name).toBe('Shelf');
    expect(part.colorKey).toBe('Oak');
    // Dimensions converted from mm to meters
    expect(part.size.width).toBeCloseTo(0.4);
    expect(part.size.length).toBeCloseTo(0.8);
    expect(part.size.thickness).toBeCloseTo(0.018);
  });

  it('assigns sequential partNumbers', async () => {
    const modelId = crypto.randomUUID();
    const existingParts = [makePart(1, { name: 'First' })];

    // Set up an existing manual model in both reactive state and IDB
    activeProjectData.value = makeProject(projectId, [
      makeManualModel(modelId, existingParts),
    ]);
    await idb.createModel({
      id: modelId,
      projectId,
      filename: 'Manual Parts',
      source: 'manual',
      parts: existingParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart(projectId, makeInput({ name: 'Second' }));

    const model = activeProjectData.value!.models.find(
      (m) => m.source === 'manual',
    )!;
    const partNumbers = [...new Set(model.parts.map((p) => p.partNumber))];
    expect(partNumbers).toContain(1);
    expect(partNumbers).toContain(2);
  });

  it('creates multiple instances when qty > 1', async () => {
    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart(projectId, makeInput({ qty: 3, name: 'Leg' }));

    const model = activeProjectData.value!.models[0];
    expect(model.parts).toHaveLength(3);
    // All same partNumber, different instanceNumbers
    expect(model.parts.every((p) => p.partNumber === 1)).toBe(true);
    const instances = model.parts.map((p) => p.instanceNumber).sort();
    expect(instances).toEqual([1, 2, 3]);
  });

  it('calls updateColorMap for new materials', async () => {
    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart(projectId, makeInput({ material: 'Walnut' }));
    expect(mockUpdateColorMap).toHaveBeenCalledWith(
      projectId,
      'Walnut',
      'Walnut',
    );
  });

  it('stores grainLock in partOverrides, not on the Part', async () => {
    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart(
      projectId,
      makeInput({ grainLock: 'length', name: 'Grain Test' }),
    );

    // The reactive model should show grainLock applied (via applyOverrides)
    const model = activeProjectData.value!.models[0];
    expect(model.parts[0].grainLock).toBe('length');

    // Verify IDB stores it in partOverrides, not on raw parts
    const full = await idb.getProjectWithModels(projectId);
    const idbModel = full!.models[0];
    expect(idbModel.partOverrides[1]).toEqual({ grainLock: 'length' });
  });

  it('does nothing if project ID does not match', async () => {
    const { addManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await addManualPart('wrong-id', makeInput());
    expect(activeProjectData.value!.models).toHaveLength(0);
  });
});

describe('removeManualPart', () => {
  let activeProjectData: Ref<Project | null>;
  let projectId: string;
  let modelId: string;

  beforeEach(async () => {
    mockUpdateColorMap.mockClear();
    const project = await idb.createProject(
      'RemovePartTest-' + crypto.randomUUID().slice(0, 8),
    );
    projectId = project.id;
    modelId = crypto.randomUUID();

    const parts = [
      makePart(1, { name: 'Rail' }),
      makePart(2, { name: 'Stile' }),
      makePart(3, { name: 'Panel' }),
    ];

    activeProjectData = ref(
      makeProject(projectId, [makeManualModel(modelId, parts)]),
    );

    await idb.createModel({
      id: modelId,
      projectId,
      filename: 'Manual Parts',
      source: 'manual',
      parts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });
  });

  it('removes the correct part by partNumber', async () => {
    const { removeManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await removeManualPart(projectId, 2);

    const model = activeProjectData.value!.models[0];
    expect(model.parts).toHaveLength(2);
    const names = model.parts.map((p) => p.name);
    expect(names).toContain('Rail');
    expect(names).toContain('Panel');
    expect(names).not.toContain('Stile');
  });

  it('removes the manual model entirely when last part is removed', async () => {
    // Start with a single part
    const singlePartModelId = crypto.randomUUID();
    const singleProject = await idb.createProject(
      'SinglePartRemove-' + crypto.randomUUID().slice(0, 8),
    );
    const singleParts = [makePart(1, { name: 'Only Part' })];
    const singleActiveData: Ref<Project | null> = ref(
      makeProject(singleProject.id, [
        makeManualModel(singlePartModelId, singleParts),
      ]),
    );

    await idb.createModel({
      id: singlePartModelId,
      projectId: singleProject.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: singleParts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    const { removeManualPart } = useManualParts({
      activeProjectData: singleActiveData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await removeManualPart(singleProject.id, 1);
    expect(singleActiveData.value!.models).toHaveLength(0);
  });

  it('does nothing if project ID does not match', async () => {
    const { removeManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await removeManualPart('wrong-id', 1);
    expect(activeProjectData.value!.models[0].parts).toHaveLength(3);
  });
});

describe('updateManualPart', () => {
  let activeProjectData: Ref<Project | null>;
  let projectId: string;
  let modelId: string;

  beforeEach(async () => {
    mockUpdateColorMap.mockClear();
    const project = await idb.createProject(
      'UpdatePartTest-' + crypto.randomUUID().slice(0, 8),
    );
    projectId = project.id;
    modelId = crypto.randomUUID();

    const parts = [
      makePart(1, { name: 'Rail', colorKey: 'Oak' }),
      makePart(2, { name: 'Stile', colorKey: 'Oak' }),
    ];

    activeProjectData = ref(
      makeProject(projectId, [makeManualModel(modelId, parts)]),
    );

    await idb.createModel({
      id: modelId,
      projectId,
      filename: 'Manual Parts',
      source: 'manual',
      parts,
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });
  });

  it('updates dimensions correctly', async () => {
    const { updateManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await updateManualPart(
      projectId,
      1,
      makeInput({
        name: 'Updated Rail',
        widthMm: 100,
        lengthMm: 200,
        thicknessMm: 12,
        material: 'Oak',
      }),
    );

    const model = activeProjectData.value!.models[0];
    const updatedPart = model.parts.find((p) => p.partNumber === 1)!;
    expect(updatedPart.name).toBe('Updated Rail');
    expect(updatedPart.size.width).toBeCloseTo(0.1);
    expect(updatedPart.size.length).toBeCloseTo(0.2);
    expect(updatedPart.size.thickness).toBeCloseTo(0.012);

    // Other parts unchanged
    const stile = model.parts.find((p) => p.partNumber === 2)!;
    expect(stile.name).toBe('Stile');
  });

  it('updates grain lock via partOverrides', async () => {
    const { updateManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await updateManualPart(
      projectId,
      1,
      makeInput({
        name: 'Rail',
        material: 'Oak',
        grainLock: 'width',
      }),
    );

    // Check reactive state has grainLock applied
    const model = activeProjectData.value!.models[0];
    const rail = model.parts.find((p) => p.partNumber === 1)!;
    expect(rail.grainLock).toBe('width');

    // Check IDB has it stored in partOverrides
    const full = await idb.getProjectWithModels(projectId);
    await idb.flushPendingModelWrites();
    const fullAfterFlush = await idb.getProjectWithModels(projectId);
    const idbModel = fullAfterFlush!.models[0];
    expect(idbModel.partOverrides[1]?.grainLock).toBe('width');
  });

  it('clears grainLock when removed', async () => {
    // First set a grainLock
    await idb.updateModel(modelId, {
      partOverrides: { 1: { grainLock: 'length' } },
    });
    await idb.flushPendingModelWrites();

    const { updateManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    // Update without grainLock to clear it
    await updateManualPart(
      projectId,
      1,
      makeInput({
        name: 'Rail',
        material: 'Oak',
        // no grainLock
      }),
    );

    // Check IDB partOverrides - grainLock should be cleared
    await idb.flushPendingModelWrites();
    const full = await idb.getProjectWithModels(projectId);
    const idbModel = full!.models[0];
    // partOverrides entry for partNumber 1 should be gone (empty override removed)
    expect(idbModel.partOverrides[1]).toBeUndefined();
  });

  it('does nothing if project ID does not match', async () => {
    const { updateManualPart } = useManualParts({
      activeProjectData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await updateManualPart('wrong-id', 1, makeInput());
    const model = activeProjectData.value!.models[0];
    expect(model.parts[0].name).toBe('Rail'); // unchanged
  });

  it('does nothing if no manual model exists', async () => {
    // Set up a project with no manual model
    const gltfProject = await idb.createProject(
      'NoManual-' + crypto.randomUUID().slice(0, 8),
    );
    const gltfActiveData: Ref<Project | null> = ref(
      makeProject(gltfProject.id, [
        {
          id: 'gltf-1',
          filename: 'test.glb',
          source: 'gltf',
          parts: [makePart(1)],
          colors: [],
          enabled: true,
        },
      ]),
    );

    const { updateManualPart } = useManualParts({
      activeProjectData: gltfActiveData,
      idb,
      updateColorMap: mockUpdateColorMap,
    });

    await updateManualPart(gltfProject.id, 1, makeInput());
    // Model should be unchanged - still gltf, no manual model added
    expect(gltfActiveData.value!.models[0].source).toBe('gltf');
  });
});
