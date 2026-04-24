/**
 * Edge-case tests for project import: corrupt data, boundary cases,
 * and round-trip fidelity with overrides and build steps.
 */
import { describe, expect, it } from 'bun:test';
import { gzipSync } from 'node:zlib';
import { SCHEMA_VERSION } from '../migrations';
import {
  importProjectData,
  importProjectFromFile,
  parseProjectExport,
} from '../projectImport';

function makePayload(overrides?: any) {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    exportedAt: now,
    project: {
      id: 'proj-1',
      name: 'Test Project',
      colorMap: { '#aaa': 'Plywood' },
      excludedColors: ['#bbb'],
      stock: 'stock yaml',
      distanceUnit: 'mm' as const,
      createdAt: now,
      updatedAt: now,
    },
    models: [
      {
        id: 'model-1',
        projectId: 'proj-1',
        filename: 'test.glb',
        source: 'gltf' as const,
        parts: [
          {
            partNumber: 1,
            instanceNumber: 1,
            name: 'Panel',
            colorKey: '#aaa',
            size: { width: 0.3, length: 0.5, thickness: 0.018 },
          },
        ],
        enabled: true,
        gltfJson: { asset: { version: '2.0' } },
        partOverrides: { '1': { grainLock: 'length' } },
        createdAt: now,
      },
    ],
    buildSteps: [
      {
        id: 'step-1',
        projectId: 'proj-1',
        stepNumber: 1,
        title: 'Cut parts',
        description: 'Cut to size',
        partRefs: [{ modelId: 'model-1', partNumber: 1 }],
        createdAt: now,
      },
    ],
    settings: { bladeWidth: 3 },
    ...overrides,
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
        return { id: 'new-proj' };
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

describe('parseProjectExport edge cases', () => {
  it('rejects a boolean', () => {
    expect(() => parseProjectExport(true)).toThrow('expected a JSON object');
  });

  it('rejects an array', () => {
    // Array is typeof 'object' but not what we want
    expect(() => parseProjectExport([1, 2, 3])).toThrow('Invalid project file');
  });

  it('handles model with partOverrides preserved', () => {
    const payload = makePayload();
    const parsed = parseProjectExport(payload);
    // Zod parses the key as string from JSON, which is correct for Record<string, PartOverride>
    expect(parsed.models[0].partOverrides).toBeDefined();
  });

  it('handles payload with no buildSteps field', () => {
    const payload = makePayload();
    delete (payload as any).buildSteps;
    const parsed = parseProjectExport(payload);
    expect(parsed.buildSteps).toBeUndefined();
  });

  it('handles payload with empty models array', () => {
    const payload = makePayload();
    payload.models = [];
    const parsed = parseProjectExport(payload);
    expect(parsed.models).toHaveLength(0);
  });

  it('rejects payload with future schema version', () => {
    const payload = makePayload({ version: SCHEMA_VERSION + 100 });
    expect(() => parseProjectExport(payload)).toThrow('newer version');
  });

  it('rejects payload with negative partNumber', () => {
    const payload = makePayload();
    payload.models[0].parts[0].partNumber = -1;
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('rejects payload with NaN size', () => {
    const payload = makePayload();
    payload.models[0].parts[0].size.width = NaN;
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('coerces string-encoded numeric settings to numbers', () => {
    const payload = makePayload({
      settings: { margin: '3.5', bladeWidth: '2' },
    });
    const parsed = parseProjectExport(payload);
    expect(parsed.settings!.margin).toBe(3.5);
    expect(parsed.settings!.bladeWidth).toBe(2);
  });
});

describe('importProjectData remapping', () => {
  it('preserves excludedColors on import', async () => {
    const payload = makePayload();
    const { db, calls } = makeIdbMock();
    await importProjectData(payload as any, db as any);
    expect(calls.updateProject[0].patch.excludedColors).toEqual(['#bbb']);
  });

  it('generates unique model IDs for each model', async () => {
    const payload = makePayload();
    payload.models.push({
      ...payload.models[0],
      id: 'model-2',
    });
    const { db, calls } = makeIdbMock();
    await importProjectData(payload as any, db as any);

    const modelIds = calls.createModel.map((m: any) => m.id);
    expect(modelIds).toHaveLength(2);
    expect(modelIds[0]).not.toBe(modelIds[1]);
    // Neither should be the original IDs
    expect(modelIds[0]).not.toBe('model-1');
    expect(modelIds[1]).not.toBe('model-2');
  });

  it('remaps build step partRefs to new model IDs', async () => {
    const payload = makePayload();
    const { db, calls } = makeIdbMock();
    await importProjectData(payload as any, db as any);

    const step = calls.createBuildStep[0];
    const newModelId = calls.createModel[0].id;
    expect(step.partRefs[0].modelId).toBe(newModelId);
    expect(step.partRefs[0].partNumber).toBe(1);
  });

  it('drops build step partRefs referencing unknown model IDs', async () => {
    const payload = makePayload();
    payload.buildSteps![0].partRefs = [
      { modelId: 'nonexistent-model', partNumber: 1 },
    ];
    const { db, calls } = makeIdbMock();
    await importProjectData(payload as any, db as any);

    expect(calls.createBuildStep[0].partRefs).toEqual([]);
  });
});

describe('importProjectFromFile corrupt data', () => {
  // Note: Tests for empty/binary file rejection and plain JSON fallback are
  // covered in projectImport.test.ts. The DecompressionStream error path
  // crashes Bun's internal stream handling in test mode, so we test the
  // validation layer directly here instead.

  it('rejects structurally invalid gzipped JSON', async () => {
    const gz = gzipSync(JSON.stringify({ random: 'garbage' }));
    const file = new File([new Uint8Array(gz)], 'bad.cutlist.gz');
    const { db } = makeIdbMock();
    let caught: Error | null = null;
    try {
      await importProjectFromFile(file, db as any);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Invalid project file');
  });

  it('accepts valid gzipped export', async () => {
    const payload = makePayload();
    const gz = gzipSync(JSON.stringify(payload));
    const file = new File([new Uint8Array(gz)], 'valid.cutlist.gz');
    const { db, calls } = makeIdbMock();
    await importProjectFromFile(file, db as any);
    expect(calls.createProject).toHaveLength(1);
    expect(calls.createModel).toHaveLength(1);
  });
});

describe('round-trip fidelity', () => {
  it('preserves part overrides through parse -> import', async () => {
    const payload = makePayload();
    const parsed = parseProjectExport(payload);
    const { db, calls } = makeIdbMock();
    await importProjectData(parsed, db as any);

    // The model's partOverrides should be preserved
    const importedModel = calls.createModel[0];
    expect(importedModel.partOverrides).toBeDefined();
  });

  it('preserves stock and distanceUnit through import', async () => {
    const payload = makePayload();
    payload.project.stock = 'custom stock yaml';
    payload.project.distanceUnit = 'in';
    const { db, calls } = makeIdbMock();
    await importProjectData(payload as any, db as any);

    expect(calls.createProject[0].opts.stock).toBe('custom stock yaml');
    expect(calls.createProject[0].opts.distanceUnit).toBe('in');
  });

  it('preserves derivedCache on models', () => {
    const payload = makePayload();
    payload.models[0].derivedCache = {
      version: 1,
      parts: payload.models[0].parts,
      colors: [{ key: '#aaa', rgb: [0.5, 0.5, 0.5], count: 1 }],
      nodePartMap: [{ nodeIndex: 0, partNumber: 1, colorHex: '#aaa' }],
    };
    const parsed = parseProjectExport(payload);
    expect(parsed.models[0].derivedCache).toBeDefined();
    expect(parsed.models[0].derivedCache!.version).toBe(1);
  });
});
