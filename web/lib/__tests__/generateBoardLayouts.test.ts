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
    sizes: [{ width: '1m', length: '3m', thickness: ['0.018m'] }],
  },
];

describe('generateBoardLayouts', () => {
  it('rotates parts in auto mode when needed to fit', () => {
    const config: Config = {
      bladeWidth: 0,
      margin: 0,
      optimize: 'auto',
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
      margin: 0,
      optimize: 'cnc',
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

  it('respects maxSearchPasses as a deterministic pass budget', () => {
    const parts = [
      createPart(1, 1, 1),
      createPart(2, 1, 1),
      createPart(3, 2, 1),
    ];

    // With the budget fixed at 1, only the very first pass runs per stock
    // group — the winning layout is fully determined by pass ordering.
    const budgeted = generateBoardLayouts(parts, stock, {
      bladeWidth: 0,
      margin: 0,
      optimize: 'auto',
      maxSearchPasses: 1,
      searchPasses: ['cnc-area', 'cnc-perimeter', 'cuts-shelf-long-side'],
      precision: 1e-5,
    });
    const firstPassOnly = generateBoardLayouts(parts, stock, {
      bladeWidth: 0,
      margin: 0,
      optimize: 'auto',
      searchPasses: ['cnc-area'],
      precision: 1e-5,
    });

    expect(budgeted).toEqual(firstPassOnly);
  });

  it('is deterministic in auto mode', () => {
    const config: Config = {
      bladeWidth: 0,
      margin: 0,
      optimize: 'auto',
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
