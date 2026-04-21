import { describe, it, expect } from 'bun:test';
import {
  generateBoardLayouts,
  type Config,
  type PartToCut,
  type StockMatrix,
} from '..';

const baseConfig: Config = {
  bladeWidth: 0,
  extraSpace: 0,
  optimize: 'auto',
  maxSearchMs: 8000,
  precision: 1e-5,
};

function makePart(
  partNumber: number,
  width: number,
  length: number,
  material = 'MDF',
  thickness = 0.018,
): PartToCut {
  return {
    partNumber,
    instanceNumber: 1,
    name: `Part ${partNumber}`,
    material,
    size: { thickness, width, length },
  };
}

// 1. All parts become leftovers — material 'Unknown' not in stock
describe('generateBoardLayouts edge cases', () => {
  it('puts all parts in leftovers when material is not in stock', () => {
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [2] },
    ];
    const parts = [
      makePart(1, 0.5, 0.5, 'Unknown'),
      makePart(2, 0.3, 0.3, 'Unknown'),
    ];

    const result = generateBoardLayouts(parts, stock, baseConfig);

    expect(result.layouts).toHaveLength(0);
    expect(result.leftovers).toHaveLength(2);
  });

  // 2. Multiple materials — each material's parts land on correct stock
  it('places parts on the correct stock when multiple materials are present', () => {
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [2] },
      { material: 'Plywood', thickness: [0.018], width: [1], length: [2] },
    ];
    const parts = [
      makePart(1, 0.4, 0.4, 'MDF'),
      makePart(2, 0.4, 0.4, 'Plywood'),
    ];

    const result = generateBoardLayouts(parts, stock, baseConfig);

    expect(result.leftovers).toHaveLength(0);
    expect(result.layouts).toHaveLength(2);

    const materials = result.layouts.map((l) => l.stock.material).sort();
    expect(materials).toEqual(['MDF', 'Plywood']);

    for (const layout of result.layouts) {
      for (const placement of layout.placements) {
        expect(placement.material).toBe(layout.stock.material);
      }
    }
  });

  // 3. String distance stock — '18mm' thickness parsed correctly
  it('parses string distances in stock and matches part thickness', () => {
    const stock: StockMatrix[] = [
      {
        material: 'MDF',
        thickness: ['18mm'],
        width: ['1000mm'],
        length: ['2000mm'],
      },
    ];
    // 0.018m === 18mm
    const parts = [makePart(1, 0.4, 0.4, 'MDF', 0.018)];

    const result = generateBoardLayouts(parts, stock, baseConfig);

    expect(result.leftovers).toHaveLength(0);
    expect(result.layouts).toHaveLength(1);
  });

  // 4. extraSpace reduces effective bin — part close to 1m doesn't fit in (1-extraSpace)
  it('does not place a part that exceeds the effective bin size after extraSpace is applied', () => {
    // Bin is 1m×1m; extraSpace is 10mm → effective area is 0.99m×0.99m
    // Part is 0.995m×0.995m which fits the raw board but not the reduced area
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [1] },
    ];
    const configWithExtraSpace: Config = {
      ...baseConfig,
      extraSpace: 0.01, // 10mm in meters
    };
    const parts = [makePart(1, 0.995, 0.995)];

    const result = generateBoardLayouts(parts, stock, configWithExtraSpace);

    // Part should not fit on the reduced effective area → leftover
    expect(result.leftovers).toHaveLength(1);
    expect(result.layouts).toHaveLength(0);
  });

  // 5. Empty parts list → layouts=[], leftovers=[]
  it('returns empty layouts and leftovers for an empty parts list', () => {
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [2] },
    ];

    const result = generateBoardLayouts([], stock, baseConfig);

    expect(result.layouts).toHaveLength(0);
    expect(result.leftovers).toHaveLength(0);
  });

  // 6. Empty stock throws
  it('throws when stock is empty', () => {
    const parts = [makePart(1, 0.5, 0.5)];

    expect(() => generateBoardLayouts(parts, [], baseConfig)).toThrow(
      'You must include at least 1 stock.',
    );
  });

  // 7. Parts spread across multiple boards
  it('uses two boards when parts do not all fit on one', () => {
    // Board is 0.5m×0.5m; each part is 0.4m×0.4m — two parts cannot share one board
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [0.5], length: [0.5] },
    ];
    const parts = [makePart(1, 0.4, 0.4), makePart(2, 0.4, 0.4)];

    const result = generateBoardLayouts(parts, stock, baseConfig);

    expect(result.leftovers).toHaveLength(0);
    expect(result.layouts).toHaveLength(2);
  });

  // 8. Part larger than all stock → in leftovers
  it('puts a part that is larger than every stock board into leftovers', () => {
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [0.5], length: [0.5] },
    ];
    // Part is 1m×1m — larger than the 0.5m×0.5m board
    const parts = [makePart(1, 1, 1)];

    const result = generateBoardLayouts(parts, stock, baseConfig);

    expect(result.leftovers).toHaveLength(1);
    expect(result.leftovers[0].widthM).toBe(1);
    expect(result.leftovers[0].lengthM).toBe(1);
    expect(result.layouts).toHaveLength(0);
  });

  // 9. Config with specific searchPasses → deterministic single-pass result
  it('produces a deterministic result when searchPasses is set to a single pass', () => {
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [3] },
    ];
    const config: Config = {
      ...baseConfig,
      optimize: 'auto',
      searchPasses: ['cnc-area'],
    };
    const parts = [
      makePart(1, 0.4, 0.4),
      makePart(2, 0.3, 0.5),
      makePart(3, 0.2, 0.6),
    ];

    const first = generateBoardLayouts(parts, stock, config);
    const second = generateBoardLayouts(parts, stock, config);

    expect(second).toEqual(first);
    expect(first.leftovers).toHaveLength(0);
  });

  // 10. bladeWidth reduces packing capacity — fewer parts fit on a board
  it('fits fewer parts when bladeWidth adds kerf gaps between parts', () => {
    // Board: 1m × 1m
    // Pack 4 parts each 0.49m × 0.49m — without gap they tile 2×2 fine (0.98 ≤ 1.0).
    // With bladeWidth=30mm (0.03m) the gap between the two columns/rows pushes the
    // total to 0.49+0.03+0.49 = 1.01m which exceeds the board, so only 2 fit per row
    // and the 3rd / 4th part must spill onto a second board.
    const stock: StockMatrix[] = [
      { material: 'MDF', thickness: [0.018], width: [1], length: [1] },
    ];

    const noBladeConfig: Config = { ...baseConfig, bladeWidth: 0 };
    const withBladeConfig: Config = { ...baseConfig, bladeWidth: 0.03 }; // 30mm

    // 4 parts that tile 2×2 without gaps (each 0.49m × 0.49m)
    const parts = [
      makePart(1, 0.49, 0.49),
      makePart(2, 0.49, 0.49),
      makePart(3, 0.49, 0.49),
      makePart(4, 0.49, 0.49),
    ];

    const withoutBlade = generateBoardLayouts(parts, stock, noBladeConfig);
    const withBlade = generateBoardLayouts(parts, stock, withBladeConfig);

    // Without blade width, all 4 parts should fit on one board (2×2 grid)
    expect(withoutBlade.leftovers).toHaveLength(0);
    expect(withoutBlade.layouts).toHaveLength(1);

    // With blade width adding 30mm gaps, 2×2 no longer fits → needs more boards
    expect(withBlade.layouts.length).toBeGreaterThan(
      withoutBlade.layouts.length,
    );
  });
});
