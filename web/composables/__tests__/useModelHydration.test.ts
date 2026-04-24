/**
 * Tests for useModelHydration — applyOverrides, hydrateModel, and loadProject.
 *
 * Both GLTF and manual models now store their parts directly in IDB, so
 * hydration is a straightforward read + override-apply step. No worker needed.
 */
import { describe, expect, it } from 'vitest';
import type { Part, ColorInfo, NodePartMapping } from '~/utils/modelTypes';
import type { IdbModelMeta } from '../useIdb';
import { useIdb } from '../useIdb';
import {
  applyOverrides,
  hydrateModel,
  loadProject,
} from '../useModelHydration';

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

  it('Should apply overrides to every instance with the same partNumber', () => {
    const parts = [
      makePart(1, { instanceNumber: 1 }),
      makePart(1, { instanceNumber: 2 }),
      makePart(2),
    ];

    const result = applyOverrides(parts, { 1: { grainLock: 'length' } });

    expect(result[0].grainLock).toBe('length');
    expect(result[1].grainLock).toBe('length');
    expect(result[2].grainLock).toBeUndefined();
  });

  it('Should merge multiple override fields onto the same part', () => {
    const parts = [makePart(1, { name: 'Original' })];

    const result = applyOverrides(parts, {
      1: { grainLock: 'width', name: 'Override' },
    });

    expect(result[0]).toMatchObject({
      colorKey: '#aaa',
      grainLock: 'width',
      name: 'Override',
      size: { width: 0.3, length: 0.5, thickness: 0.018 },
    });
  });
});

// ─── hydrateModel ──────────────────────────────────────────────────────────

describe('hydrateModel', () => {
  it('manual model returns stored parts directly', () => {
    const meta: IdbModelMeta = {
      id: 'manual-1',
      projectId: 'p1',
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Rail' }), makePart(2, { name: 'Stile' })],
      colors: [],
      nodePartMap: [],
      enabled: true,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };

    const model = hydrateModel(meta);
    expect(model.id).toBe('manual-1');
    expect(model.source).toBe('manual');
    expect(model.parts).toHaveLength(2);
    expect(model.parts[0].name).toBe('Rail');
    expect(model.colors).toEqual([]);
    expect(model.enabled).toBe(true);
  });

  it('manual model applies partOverrides', () => {
    const meta: IdbModelMeta = {
      id: 'manual-2',
      projectId: 'p1',
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Rail' })],
      colors: [],
      nodePartMap: [],
      enabled: true,
      partOverrides: { 1: { grainLock: 'width' } },
      createdAt: new Date().toISOString(),
    };

    const model = hydrateModel(meta);
    expect(model.parts[0].grainLock).toBe('width');
  });

  it('GLTF model returns stored parts and colors', () => {
    const storedParts = [makePart(1, { name: 'Stored Part' })];
    const storedColors: ColorInfo[] = [
      { key: '#abc', rgb: [0.5, 0.5, 0.5], count: 1 },
    ];
    const storedNodeMap: NodePartMapping[] = [
      { nodeIndex: 0, partNumber: 1, colorHex: '#abc' },
    ];

    const meta: IdbModelMeta = {
      id: 'gltf-stored',
      projectId: 'p1',
      filename: 'test.glb',
      source: 'gltf',
      parts: storedParts,
      colors: storedColors,
      nodePartMap: storedNodeMap,
      enabled: true,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    };

    const model = hydrateModel(meta);
    expect(model.parts).toEqual(storedParts);
    expect(model.colors).toEqual(storedColors);
    expect(model.nodePartMap).toEqual(storedNodeMap);
  });

  it('GLTF model applies partOverrides', () => {
    const meta: IdbModelMeta = {
      id: 'gltf-overrides',
      projectId: 'p1',
      filename: 'test.glb',
      source: 'gltf',
      parts: [makePart(1, { name: 'Original' })],
      colors: [],
      nodePartMap: [],
      enabled: true,
      partOverrides: { 1: { name: 'Overridden Name' } },
      createdAt: new Date().toISOString(),
    };

    const model = hydrateModel(meta);
    expect(model.parts[0].name).toBe('Overridden Name');
  });
});

// ─── loadProject ───────────────────────────────────────────────────────────

describe('loadProject', () => {
  it('loads project + models from IDB', async () => {
    const project = await idb.createProject('LoadProjectTest');
    const modelId = crypto.randomUUID();

    await idb.createModel({
      id: modelId,
      projectId: project.id,
      filename: 'Manual Parts',
      source: 'manual',
      parts: [makePart(1, { name: 'Shelf' })],
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
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
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    await idb.createModel({
      id: crypto.randomUUID(),
      projectId: project.id,
      filename: 'Second Manual',
      source: 'manual',
      parts: [makePart(2)],
      colors: [],
      nodePartMap: [],
      enabled: true,
      rawSource: null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });

    const result = await loadProject(idb, project.id);
    expect(result).not.toBeNull();
    expect(result!.models).toHaveLength(2);
  });
});
