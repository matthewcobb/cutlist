import { describe, expect, it } from 'vitest';
import { parseStock } from '../parseStock';

describe('parseStock', () => {
  it('parses a valid YAML string with per-size thicknesses', () => {
    const yaml = `
- material: MDF
  sizes:
    - width: 1.2
      length: 2.4
      thickness: [0.018]
`;
    const result = parseStock(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      material: 'MDF',
      unit: 'mm',
      sizes: [{ width: 1.2, length: 2.4, thickness: [0.018] }],
    });
  });

  it('parses multiple stock entries', () => {
    const yaml = `
- material: MDF
  sizes:
    - width: 1.2
      length: 2.4
      thickness: [0.018]
- material: Ply
  sizes:
    - width: 0.6
      length: 1.8
      thickness: [0.012]
`;
    const result = parseStock(yaml);
    expect(result).toHaveLength(2);
    expect(result[0].material).toBe('MDF');
    expect(result[1].material).toBe('Ply');
  });

  it('Should parse explicit units, string dimensions, colors, and multiple thicknesses', () => {
    const yaml = `
- material: Baltic Birch
  unit: in
  color: '#d2b996'
  sizes:
    - width: 48
      length: 96
      thickness: [0.5, 0.75]
    - width: 1220mm
      length: 2440mm
      thickness: [18mm]
`;

    expect(parseStock(yaml)).toEqual([
      {
        material: 'Baltic Birch',
        unit: 'in',
        color: '#d2b996',
        sizes: [
          { width: 48, length: 96, thickness: [0.5, 0.75] },
          { width: '1220mm', length: '2440mm', thickness: ['18mm'] },
        ],
      },
    ]);
  });

  it('throws a ZodError for invalid YAML missing required fields', () => {
    const yaml = `
- material: MDF
`;
    expect(() => parseStock(yaml)).toThrow();
  });

  it('Should throw when YAML is malformed', () => {
    expect(() => parseStock('- material: [unterminated')).toThrow();
  });

  it('returns [] for an empty array YAML', () => {
    expect(parseStock('[]')).toEqual([]);
  });
});
