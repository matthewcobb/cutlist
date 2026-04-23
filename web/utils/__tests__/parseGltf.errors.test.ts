import { describe, expect, it } from 'bun:test';
import { deriveFromGltf, DERIVE_VERSION } from '../parseGltf';

describe('deriveFromGltf error handling', () => {
  it('throws when nodes are missing', () => {
    expect(() => deriveFromGltf({ meshes: [], accessors: [] })).toThrow(
      'missing required nodes/meshes/accessors',
    );
  });

  it('throws when meshes are missing', () => {
    expect(() => deriveFromGltf({ nodes: [], accessors: [] })).toThrow(
      'missing required nodes/meshes/accessors',
    );
  });

  it('throws when accessors are missing', () => {
    expect(() => deriveFromGltf({ nodes: [], meshes: [] })).toThrow(
      'missing required nodes/meshes/accessors',
    );
  });

  it('throws when no geometry is found', () => {
    expect(() =>
      deriveFromGltf({
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'empty' }], // no mesh reference
        meshes: [],
        accessors: [],
      }),
    ).toThrow('No parts with geometry');
  });

  it('throws for meshes with no POSITION accessor', () => {
    expect(() =>
      deriveFromGltf({
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'test', mesh: 0 }],
        meshes: [{ primitives: [{ attributes: {} }] }],
        accessors: [],
      }),
    ).toThrow('No parts with geometry');
  });
});

describe('deriveFromGltf color resolution', () => {
  function makeGltfWithMaterial(material: any) {
    return {
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'Part', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      accessors: [
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [0.5, 0.3, 0.018],
        },
      ],
      materials: [material],
    };
  }

  it('resolves Onshape color encoding (R_G_B in material name)', () => {
    const result = deriveFromGltf(
      makeGltfWithMaterial({
        name: '0.921569_0.800000_0.564706_0_0',
      }),
    );
    // Should use hex as the key (not the raw name)
    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].key).toMatch(/^#[0-9a-f]{6}$/);
    // RGB should be parsed from the name
    expect(result.colors[0].rgb[0]).toBeCloseTo(0.921569, 4);
    expect(result.colors[0].rgb[1]).toBeCloseTo(0.8, 4);
    expect(result.colors[0].rgb[2]).toBeCloseTo(0.564706, 4);
  });

  it('resolves standard PBR base color', () => {
    const result = deriveFromGltf(
      makeGltfWithMaterial({
        name: 'Oak',
        pbrMetallicRoughness: { baseColorFactor: [0.7, 0.5, 0.3, 1.0] },
      }),
    );
    expect(result.colors).toHaveLength(1);
    // Should use material name as the key
    expect(result.colors[0].key).toBe('Oak');
    expect(result.colors[0].rgb).toEqual([0.7, 0.5, 0.3]);
  });

  it('falls back to hex when PBR material has no name', () => {
    const result = deriveFromGltf(
      makeGltfWithMaterial({
        name: '',
        pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] },
      }),
    );
    expect(result.colors[0].key).toBe('#ff0000');
  });

  it('uses grey fallback when no material info available', () => {
    const result = deriveFromGltf(makeGltfWithMaterial({ name: '' }));
    expect(result.colors[0].rgb).toEqual([0.5, 0.5, 0.5]);
  });

  it('falls back to Unknown key for empty name and no PBR', () => {
    const result = deriveFromGltf(makeGltfWithMaterial({ name: '' }));
    expect(result.colors[0].key).toBe('Unknown');
  });
});

describe('deriveFromGltf with transforms', () => {
  it('handles node with translation', () => {
    const gltf = {
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        {
          name: 'Translated',
          mesh: 0,
          translation: [1, 2, 3] as [number, number, number],
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      accessors: [
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [0.5, 0.3, 0.018],
        },
      ],
      materials: [
        {
          name: 'Wood',
          pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.5, 1] },
        },
      ],
    };

    const result = deriveFromGltf(gltf);
    // Dimensions should be the same regardless of translation
    // (sorted: thickness=0.018, width=0.3, length=0.5)
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].size.thickness).toBeCloseTo(0.018, 4);
    expect(result.parts[0].size.width).toBeCloseTo(0.3, 4);
    expect(result.parts[0].size.length).toBeCloseTo(0.5, 4);
  });

  it('handles node with uniform scale', () => {
    const gltf = {
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        {
          name: 'Scaled',
          mesh: 0,
          scale: [2, 2, 2] as [number, number, number],
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      accessors: [
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [0.5, 0.3, 0.018],
        },
      ],
      materials: [
        {
          name: 'Wood',
          pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.5, 1] },
        },
      ],
    };

    const result = deriveFromGltf(gltf);
    // Dimensions should be doubled due to 2x scale
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].size.thickness).toBeCloseTo(0.036, 4);
    expect(result.parts[0].size.width).toBeCloseTo(0.6, 4);
    expect(result.parts[0].size.length).toBeCloseTo(1.0, 4);
  });

  it('handles child nodes (hierarchy)', () => {
    const gltf = {
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [
        { name: 'Parent', children: [1] },
        { name: 'Child', mesh: 0 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      accessors: [
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [0.5, 0.3, 0.018],
        },
      ],
      materials: [
        {
          name: 'Wood',
          pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.5, 1] },
        },
      ],
    };

    const result = deriveFromGltf(gltf);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].name).toBe('Child');
  });
});

describe('deriveFromGltf nodePartMap', () => {
  it('maps all node indices to their corresponding partNumber', () => {
    const gltf = {
      scene: 0,
      scenes: [{ nodes: [0, 1, 2] }],
      nodes: [
        { name: 'A', mesh: 0 },
        { name: 'B', mesh: 1 },
        { name: 'C', mesh: 2 },
      ],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
        { primitives: [{ attributes: { POSITION: 1 }, material: 0 }] },
        { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
      ],
      accessors: [
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [0.5, 0.3, 0.018],
        },
        {
          componentType: 5126,
          count: 8,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1.0, 0.5, 0.018],
        },
      ],
      materials: [
        {
          name: 'Wood',
          pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.5, 1] },
        },
      ],
    };

    const result = deriveFromGltf(gltf);
    // Nodes 0 and 2 should be the same group (same accessor/size/material)
    expect(result.nodePartMap).toHaveLength(3);
    const byNode = new Map(
      result.nodePartMap.map((e) => [e.nodeIndex, e.partNumber]),
    );
    expect(byNode.get(0)).toBe(byNode.get(2)); // same group
    expect(byNode.get(1)).not.toBe(byNode.get(0)); // different
  });
});

describe('DERIVE_VERSION', () => {
  it('is a positive integer', () => {
    expect(DERIVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(DERIVE_VERSION)).toBe(true);
  });
});
