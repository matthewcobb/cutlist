import { describe, expect, it } from 'bun:test';
import { parseStock } from '../parseStock';

describe('parseStock', () => {
  it('parses a valid YAML string with one stock entry', () => {
    const yaml = `
- material: MDF
  thickness: [0.018]
  width: [1.2]
  length: [2.4]
`;
    const result = parseStock(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      material: 'MDF',
      thickness: [0.018],
      width: [1.2],
      length: [2.4],
    });
  });

  it('parses multiple stock entries', () => {
    const yaml = `
- material: MDF
  thickness: [0.018]
  width: [1.2]
  length: [2.4]
- material: Ply
  thickness: [0.012]
  width: [0.6]
  length: [1.8]
`;
    const result = parseStock(yaml);
    expect(result).toHaveLength(2);
    expect(result[0].material).toBe('MDF');
    expect(result[1].material).toBe('Ply');
  });

  it('throws a ZodError for invalid YAML missing required fields', () => {
    const yaml = `
- material: MDF
`;
    expect(() => parseStock(yaml)).toThrow();
  });

  it('returns [] for an empty array YAML', () => {
    expect(parseStock('[]')).toEqual([]);
  });
});
