import { describe, expect, it } from 'bun:test';
import { useIdb, applyModelDefaults } from '../useIdb';
import { DEFAULT_SETTINGS, DEFAULT_STOCK_YAML } from '../../utils/settings';
import type { IdbModel, IdbBuildStep } from '../useIdb';

const idb = useIdb();

// ─── Projects ───────────────────────────────────────────────────────────────

describe('project CRUD', () => {
  it('creates a project and returns it with defaults', async () => {
    const project = await idb.createProject('Test Project');
    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.colorMap).toEqual({});
    expect(project.excludedColors).toEqual([]);
    expect(project.stock).toBe(DEFAULT_STOCK_YAML);
    expect(project.distanceUnit).toBe(DEFAULT_SETTINGS.distanceUnit);
    expect(project.bladeWidth).toBe(DEFAULT_SETTINGS.bladeWidth);
    expect(project.margin).toBe(DEFAULT_SETTINGS.margin);
    expect(project.optimize).toBe(DEFAULT_SETTINGS.optimize);
    expect(project.showPartNumbers).toBe(DEFAULT_SETTINGS.showPartNumbers);
    expect(project.createdAt).toBeDefined();
    expect(project.updatedAt).toBeDefined();
    expect(project.archivedAt).toBeUndefined();
  });

  it('creates a project with custom options', async () => {
    const project = await idb.createProject('Imperial', {
      stock: 'custom yaml',
      distanceUnit: 'in',
      bladeWidth: 7,
      margin: 1,
      optimize: 'CNC',
      showPartNumbers: false,
    });
    expect(project.stock).toBe('custom yaml');
    expect(project.distanceUnit).toBe('in');
    expect(project.bladeWidth).toBe(7);
    expect(project.margin).toBe(1);
    expect(project.optimize).toBe('CNC');
    expect(project.showPartNumbers).toBe(false);
  });

  it('updateProject accepts packing settings fields', async () => {
    const project = await idb.createProject('Packing patch');
    const updated = await idb.updateProject(project.id, {
      bladeWidth: 4,
      margin: 2,
      optimize: 'CNC',
      showPartNumbers: false,
    });
    expect(updated.bladeWidth).toBe(4);
    expect(updated.margin).toBe(2);
    expect(updated.optimize).toBe('CNC');
    expect(updated.showPartNumbers).toBe(false);
  });

  it('getProjectList includes created projects', async () => {
    const a = await idb.createProject('First');
    const b = await idb.createProject('Second');
    const list = await idb.getProjectList();
    expect(list).toHaveLength(2);
    const ids = list.map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('getProjectWithModels returns project with empty models array', async () => {
    const project = await idb.createProject('WithModels');
    const result = await idb.getProjectWithModels(project.id);
    expect(result).toBeDefined();
    expect(result!.name).toBe('WithModels');
    expect(result!.models).toEqual([]);
  });

  it('getProjectWithModels returns undefined for nonexistent id', async () => {
    const result = await idb.getProjectWithModels('nonexistent');
    expect(result).toBeUndefined();
  });

  it('updates a project and bumps updatedAt', async () => {
    const project = await idb.createProject('Original');
    const updated = await idb.updateProject(project.id, {
      name: 'Renamed',
      distanceUnit: 'in',
    });
    expect(updated.name).toBe('Renamed');
    expect(updated.distanceUnit).toBe('in');
    expect(updated.updatedAt >= project.updatedAt).toBe(true);
  });

  it('updateProject throws for nonexistent id', async () => {
    expect(idb.updateProject('nonexistent', { name: 'X' })).rejects.toThrow(
      'not found',
    );
  });

  it('deleteProject removes project and cascades to models and buildSteps', async () => {
    const project = await idb.createProject('ToDelete');
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'test.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      gltfJson: { mock: true },
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);
    const step: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId: project.id,
      stepNumber: 1,
      title: 'Step 1',
      description: 'Do something',
      partRefs: [],
      createdAt: new Date().toISOString(),
    };
    await idb.createBuildStep(step);

    await idb.deleteProject(project.id);

    const result = await idb.getProjectWithModels(project.id);
    expect(result).toBeUndefined();
    const steps = await idb.getBuildSteps(project.id);
    expect(steps).toHaveLength(0);
  });
});

// ─── Archive / Unarchive ────────────────────────────────────────────────────

describe('archive and unarchive', () => {
  it('archiveProject removes from active list, appears in archived list', async () => {
    const project = await idb.createProject('Archivable');
    await idb.archiveProject(project.id);

    const active = await idb.getProjectList();
    expect(active.find((p) => p.id === project.id)).toBeUndefined();

    const archived = await idb.getArchivedList();
    const found = archived.find((p) => p.id === project.id);
    expect(found).toBeDefined();
    expect(found!.archivedAt).toBeDefined();
  });

  it('unarchiveProject restores to active list', async () => {
    const project = await idb.createProject('Restorable');
    await idb.archiveProject(project.id);
    await idb.unarchiveProject(project.id);

    const active = await idb.getProjectList();
    expect(active.find((p) => p.id === project.id)).toBeDefined();

    const archived = await idb.getArchivedList();
    expect(archived.find((p) => p.id === project.id)).toBeUndefined();
  });

  it('archiveProject throws for nonexistent id', async () => {
    expect(idb.archiveProject('nonexistent')).rejects.toThrow('not found');
  });

  it('unarchiveProject throws for nonexistent id', async () => {
    expect(idb.unarchiveProject('nonexistent')).rejects.toThrow('not found');
  });
});

// ─── Models ─────────────────────────────────────────────────────────────────

describe('model CRUD', () => {
  it('creates a model and retrieves it via getProjectWithModels', async () => {
    const project = await idb.createProject('ModelProject');
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'cabinet.glb',
      source: 'gltf',
      parts: [
        {
          name: 'Side Panel',
          partNumber: 1,
          instanceNumber: 1,
          colorKey: '#aaa',
          size: {
            width: 0.5,
            length: 0.8,
            thickness: 0.018,
          },
        },
      ],
      enabled: true,
      gltfJson: { scenes: [] },
      partOverrides: { 1: { grainLock: 'length' } },
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const result = await idb.getProjectWithModels(project.id);
    expect(result!.models).toHaveLength(1);
    expect(result!.models[0].filename).toBe('cabinet.glb');
    expect(result!.models[0].partOverrides).toEqual({
      1: { grainLock: 'length' },
    });
    // gltfJson should be stripped from meta
    expect((result!.models[0] as any).gltfJson).toBeUndefined();
  });

  it('getModelGltf returns the raw gltfJson', async () => {
    const project = await idb.createProject('GltfProject');
    const gltf = { asset: { version: '2.0' }, scenes: [{}] };
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'box.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      gltfJson: gltf,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    const result = await idb.getModelGltf(model.id);
    expect(result).toEqual(gltf);
  });

  it('getModelGltf returns null for nonexistent model', async () => {
    const result = await idb.getModelGltf('nonexistent');
    expect(result).toBeNull();
  });

  it('updates model fields', async () => {
    const project = await idb.createProject('UpdateModel');
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'shelf.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);

    await idb.updateModel(model.id, {
      enabled: false,
      partOverrides: { 1: { grainLock: 'width' } },
    });
    await idb.flushPendingModelWrites();

    const result = await idb.getProjectWithModels(project.id);
    expect(result!.models[0].enabled).toBe(false);
    expect(result!.models[0].partOverrides).toEqual({
      1: { grainLock: 'width' },
    });
  });

  it('updateModel throws for nonexistent id', async () => {
    await idb.updateModel('nonexistent', { enabled: false });
    expect(idb.flushPendingModelWrites()).rejects.toThrow('not found');
  });

  it('deleteModel removes model, project still exists', async () => {
    const project = await idb.createProject('DeleteModel');
    const model: IdbModel = {
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'gone.glb',
      source: 'gltf',
      parts: [],
      enabled: true,
      gltfJson: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };
    await idb.createModel(model);
    await idb.deleteModel(model.id);

    const result = await idb.getProjectWithModels(project.id);
    expect(result).toBeDefined();
    expect(result!.models).toHaveLength(0);
  });

  it('applyModelDefaults fills missing fields on partial record', () => {
    const bare = {
      id: 'x',
      projectId: 'p',
      filename: 'f.glb',
      parts: [],
      createdAt: '',
    };
    const result = applyModelDefaults(bare);
    expect(result.source).toBe('gltf');
    expect(result.enabled).toBe(true);
    expect(result.partOverrides).toEqual({});
  });
});

// ─── Demo seed marker ───────────────────────────────────────────────────────

describe('demo seed marker', () => {
  it('can be explicitly reset to false', async () => {
    await idb.setDemoSeeded(false);
    const seeded = await idb.getDemoSeeded();
    expect(seeded).toBe(false);
  });

  it('can be set and read back', async () => {
    await idb.setDemoSeeded(true);
    expect(await idb.getDemoSeeded()).toBe(true);

    await idb.setDemoSeeded(false);
    expect(await idb.getDemoSeeded()).toBe(false);
  });
});

// ─── Build Steps ────────────────────────────────────────────────────────────

describe('build steps', () => {
  it('creates and retrieves build steps sorted by stepNumber', async () => {
    const project = await idb.createProject('StepProject');
    const step2: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId: project.id,
      stepNumber: 2,
      title: 'Attach sides',
      description: 'Glue side panels',
      partRefs: [{ modelId: 'm1', partNumber: 1 }],
      createdAt: new Date().toISOString(),
    };
    const step1: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId: project.id,
      stepNumber: 1,
      title: 'Cut parts',
      description: 'Cut all parts to size',
      partRefs: [],
      createdAt: new Date().toISOString(),
    };
    // Insert out of order
    await idb.createBuildStep(step2);
    await idb.createBuildStep(step1);

    const steps = await idb.getBuildSteps(project.id);
    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe('Cut parts');
    expect(steps[1].title).toBe('Attach sides');
  });

  it('updates a build step', async () => {
    const project = await idb.createProject('StepUpdate');
    const step: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId: project.id,
      stepNumber: 1,
      title: 'Original',
      description: 'Original desc',
      partRefs: [],
      createdAt: new Date().toISOString(),
    };
    await idb.createBuildStep(step);
    await idb.updateBuildStep(step.id, {
      title: 'Updated',
      stepNumber: 3,
    });

    const steps = await idb.getBuildSteps(project.id);
    expect(steps[0].title).toBe('Updated');
    expect(steps[0].stepNumber).toBe(3);
  });

  it('updateBuildStep throws for nonexistent id', async () => {
    expect(idb.updateBuildStep('nonexistent', { title: 'X' })).rejects.toThrow(
      'not found',
    );
  });

  it('deletes a build step', async () => {
    const project = await idb.createProject('StepDelete');
    const step: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId: project.id,
      stepNumber: 1,
      title: 'Gone',
      description: '',
      partRefs: [],
      createdAt: new Date().toISOString(),
    };
    await idb.createBuildStep(step);
    await idb.deleteBuildStep(step.id);

    const steps = await idb.getBuildSteps(project.id);
    expect(steps).toHaveLength(0);
  });

  it('getBuildSteps returns empty for project with no steps', async () => {
    const project = await idb.createProject('NoSteps');
    const steps = await idb.getBuildSteps(project.id);
    expect(steps).toHaveLength(0);
  });
});
