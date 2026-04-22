import { describe, expect, it } from 'bun:test';
import { generateBoardLayouts, type Config, type PartToCut } from '..';

function createPart(
  partNumber: number,
  width: number,
  length: number,
): PartToCut {
  return {
    partNumber,
    instanceNumber: 1,
    name: `Part ${partNumber}`,
    material: 'MDF',
    size: {
      thickness: 0.018,
      width,
      length,
    },
  };
}

const stock = [
  {
    material: 'MDF',
    unit: 'mm' as const,
    hasGrain: false,
    thickness: ['0.018m'],
    sizes: [{ width: '1m', length: '3m' }],
  },
];

describe('generateBoardLayouts', () => {
  it('rotates parts in cuts mode when needed to fit', () => {
    const config: Config = {
      bladeWidth: 0,
      extraSpace: 0,
      optimize: 'cuts',
      maxSearchMs: 8000,
      precision: 1e-5,
    };
    const result = generateBoardLayouts([createPart(1, 2, 1)], stock, config);

    expect(result.leftovers).toHaveLength(0);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].placements).toEqual([
      expect.objectContaining({
        widthM: 1,
        lengthM: 2,
      }),
    ]);
  });

  it('rotates parts in cnc mode when needed to fit', () => {
    const config: Config = {
      bladeWidth: 0,
      extraSpace: 0,
      optimize: 'cnc',
      maxSearchMs: 8000,
      precision: 1e-5,
    };
    const result = generateBoardLayouts([createPart(1, 2, 1)], stock, config);

    expect(result.leftovers).toHaveLength(0);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].placements).toEqual([
      expect.objectContaining({
        widthM: 1,
        lengthM: 2,
      }),
    ]);
  });

  it('is deterministic in auto mode', () => {
    const config: Config = {
      bladeWidth: 0,
      extraSpace: 0,
      optimize: 'auto',
      maxSearchMs: 8000,
      precision: 1e-5,
    };
    const parts = [
      createPart(1, 1, 1),
      createPart(2, 1, 1),
      createPart(3, 2, 1),
      createPart(4, 2, 1),
      createPart(5, 1, 2),
      createPart(6, 1, 2),
    ];

    const first = generateBoardLayouts(parts, stock, config);
    const second = generateBoardLayouts(parts, stock, config);

    expect(second).toEqual(first);
  });
});
