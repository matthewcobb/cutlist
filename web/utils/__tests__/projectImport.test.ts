import { describe, expect, it } from 'bun:test';
import { gzipSync } from 'node:zlib';
import { SCHEMA_VERSION } from '../migrations';
import {
  importProjectData,
  importProjectFromFile,
  parseProjectExport,
} from '../projectImport';

function makePayload() {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    exportedAt: now,
    project: {
      id: 'old-project-id',
      name: 'Demo',
      colorMap: { '#abc123': 'Plywood' },
      excludedColors: [],
      stock:
        '- material: Plywood\n  unit: mm\n  thickness: [18]\n  sizes: [{ width: 1220, length: 2440 }]\n',
      distanceUnit: 'mm' as const,
      createdAt: now,
      updatedAt: now,
    },
    models: [
      {
        id: 'old-model-id',
        projectId: 'old-project-id',
        filename: 'demo.gltf',
        source: 'gltf' as const,
        parts: [],
        enabled: true,
        gltfJson: { asset: { version: '2.0' } },
        partOverrides: {},
        createdAt: now,
      },
    ],
    buildSteps: [
      {
        id: 'old-step-id',
        projectId: 'old-project-id',
        stepNumber: 1,
        title: 'Step 1',
        description: 'Desc',
        partRefs: [{ modelId: 'old-model-id', partNumber: 1 }],
        createdAt: now,
      },
    ],
    settings: {},
  };
}

function makeIdbMock() {
  const calls = {
    createProject: [] as any[],
    updateProject: [] as any[],
    createModel: [] as any[],
    createBuildStep: [] as any[],
  };
  return {
    calls,
    db: {
      async createProject(name: string, opts?: any) {
        calls.createProject.push({ name, opts });
        return { id: 'new-project-id' };
      },
      async updateProject(id: string, patch: any) {
        calls.updateProject.push({ id, patch });
      },
      async createModel(model: any) {
        calls.createModel.push(model);
      },
      async createBuildStep(step: any) {
        calls.createBuildStep.push(step);
      },
    },
  };
}

describe('projectImport utils', () => {
  it('parseProjectExport validates expected shape', () => {
    const parsed = parseProjectExport(makePayload());
    expect(parsed.project.name).toBe('Demo');
    expect(parsed.models).toHaveLength(1);
  });

  it('importProjectData remaps project/model ids and preserves mapping data', async () => {
    const payload = makePayload();
    const { db, calls } = makeIdbMock();

    const newProjectId = await importProjectData(payload as any, db as any);
    expect(newProjectId).toBe('new-project-id');

    expect(calls.createProject).toHaveLength(1);
    expect(calls.createProject[0].name).toBe('Demo');

    expect(calls.updateProject).toHaveLength(1);
    expect(calls.updateProject[0].id).toBe('new-project-id');
    expect(calls.updateProject[0].patch.colorMap).toEqual({
      '#abc123': 'Plywood',
    });

    expect(calls.createModel).toHaveLength(1);
    expect(calls.createModel[0].projectId).toBe('new-project-id');
    expect(calls.createModel[0].id).not.toBe('old-model-id');

    expect(calls.createBuildStep).toHaveLength(1);
    expect(calls.createBuildStep[0].projectId).toBe('new-project-id');
    expect(calls.createBuildStep[0].partRefs[0].modelId).not.toBe(
      'old-model-id',
    );
  });

  it('importProjectFromFile supports gzipped input', async () => {
    const payload = makePayload();
    const gz = gzipSync(JSON.stringify(payload));
    const file = new File([new Uint8Array(gz)], 'demo.cutlist.gz', {
      type: 'application/gzip',
    });
    const { db, calls } = makeIdbMock();

    await importProjectFromFile(file, db as any);
    expect(calls.createProject).toHaveLength(1);
  });

  it('importProjectFromFile falls back to plain JSON when gzip decode fails', async () => {
    const payload = makePayload();
    const file = new File([JSON.stringify(payload)], 'demo.cutlist.gz', {
      type: 'application/json',
    });
    const { db, calls } = makeIdbMock();

    await importProjectFromFile(file, db as any);
    expect(calls.createProject).toHaveLength(1);
  });
});
