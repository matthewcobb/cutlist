import { describe, expect, it } from 'bun:test';
import { gzipSync } from 'node:zlib';
import { SCHEMA_VERSION } from '../versions';
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
      bladeWidth: 3,
      margin: 0,
      optimize: 'Auto' as const,
      showPartNumbers: true,
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

// ─── Validation ─────────────────────────────────────────────────────────────

describe('parseProjectExport validation', () => {
  it('validates expected shape', () => {
    const parsed = parseProjectExport(makePayload());
    expect(parsed.project.name).toBe('Demo');
    expect(parsed.models).toHaveLength(1);
  });

  it('rejects non-object input', () => {
    expect(() => parseProjectExport('not an object')).toThrow(
      'expected a JSON object',
    );
    expect(() => parseProjectExport(null)).toThrow('expected a JSON object');
    expect(() => parseProjectExport(42)).toThrow('expected a JSON object');
  });

  it('rejects missing project field', () => {
    expect(() =>
      parseProjectExport({ version: SCHEMA_VERSION, models: [] }),
    ).toThrow('Invalid project file');
  });

  it('rejects missing version field', () => {
    // migrateExport treats missing version as v0, which is fine,
    // but the export itself needs to be structurally valid.
    const payload = makePayload();
    delete (payload as any).version;
    // Should still work — migrateExport defaults version to 0, then stamps current
    const parsed = parseProjectExport(payload);
    expect(parsed.version).toBe(SCHEMA_VERSION);
  });

  it('rejects models with invalid source enum', () => {
    const payload = makePayload();
    (payload.models[0] as any).source = 'invalid';
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('rejects parts with invalid size (non-finite number)', () => {
    const payload = makePayload();
    payload.models[0].parts = [
      {
        partNumber: 1,
        instanceNumber: 1,
        name: 'Bad Part',
        colorKey: '#fff',
        size: { width: Infinity, length: 0.1, thickness: 0.018 },
      },
    ] as any;
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('rejects build steps with missing partRefs', () => {
    const payload = makePayload();
    payload.buildSteps![0] = {
      ...payload.buildSteps![0],
      partRefs: undefined as any,
    };
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('rejects gltfJson that is not object or null', () => {
    const payload = makePayload();
    (payload.models[0] as any).gltfJson = 'string-not-allowed';
    expect(() => parseProjectExport(payload)).toThrow('Invalid project file');
  });

  it('accepts model with gltfJson: null (manual model)', () => {
    const payload = makePayload();
    (payload.models[0] as any).gltfJson = null;
    (payload.models[0] as any).source = 'manual';
    const parsed = parseProjectExport(payload);
    expect(parsed.models[0].gltfJson).toBeNull();
  });

  it('provides human-readable error messages with paths', () => {
    const payload = makePayload();
    (payload.project as any).name = 123; // Should be string
    try {
      parseProjectExport(payload);
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain('Invalid project file');
      // Should mention the path where the error occurred
      expect(e.message).toContain('project');
    }
  });
});

// ─── Import data ────────────────────────────────────────────────────────────

describe('importProjectData', () => {
  it('remaps project/model ids and preserves mapping data', async () => {
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
});

// ─── File import (gzip + fallback) ─────────────────────────────────────────

describe('importProjectFromFile', () => {
  it('supports gzipped input', async () => {
    const payload = makePayload();
    const gz = gzipSync(JSON.stringify(payload));
    const file = new File([new Uint8Array(gz)], 'demo.cutlist.gz', {
      type: 'application/gzip',
    });
    const { db, calls } = makeIdbMock();

    await importProjectFromFile(file, db as any);
    expect(calls.createProject).toHaveLength(1);
  });

  it('falls back to plain JSON when gzip decode fails', async () => {
    const payload = makePayload();
    const file = new File([JSON.stringify(payload)], 'demo.cutlist.gz', {
      type: 'application/json',
    });
    const { db, calls } = makeIdbMock();

    await importProjectFromFile(file, db as any);
    expect(calls.createProject).toHaveLength(1);
  });

  it('rejects non-JSON content with readable error', async () => {
    const file = new File(['this is not json'], 'bad.cutlist.gz', {
      type: 'text/plain',
    });
    const { db } = makeIdbMock();

    let caught: Error | null = null;
    try {
      await importProjectFromFile(file, db as any);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('Could not parse');
    expect(caught!.message).toContain('.cutlist.gz');
  });

  it('rejects structurally invalid JSON with readable error', async () => {
    const file = new File(
      [JSON.stringify({ random: 'garbage' })],
      'bad.cutlist.gz',
    );
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
});

// ─── Round-trip ─────────────────────────────────────────────────────────────

describe('export -> import round-trip', () => {
  it('a valid payload round-trips through parse without error', () => {
    const payload = makePayload();
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    const validated = parseProjectExport(parsed);

    expect(validated.project.name).toBe('Demo');
    expect(validated.models).toHaveLength(1);
    expect(validated.buildSteps).toHaveLength(1);
  });

  it('payload with parts round-trips correctly', () => {
    const payload = makePayload();
    payload.models[0].parts = [
      {
        partNumber: 1,
        instanceNumber: 1,
        name: 'Side Panel',
        colorKey: '#abc123',
        size: { width: 0.5, length: 1.2, thickness: 0.018 },
      },
      {
        partNumber: 1,
        instanceNumber: 2,
        name: 'Side Panel',
        colorKey: '#abc123',
        size: { width: 0.5, length: 1.2, thickness: 0.018 },
      },
    ] as any;

    const json = JSON.stringify(payload);
    const validated = parseProjectExport(JSON.parse(json));
    expect(validated.models[0].parts).toHaveLength(2);
  });
});
