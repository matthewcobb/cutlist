import { describe, expect, it } from 'bun:test';
import { reduceStockMatrix } from '..';

describe('reduceStockMatrix', () => {
  it('returns [] for an empty matrix', () => {
    expect(reduceStockMatrix([])).toEqual([]);
  });

  it('returns one stock for a single item with one thickness/width/length (number meters)', () => {
    const result = reduceStockMatrix([
      { material: 'MDF', thickness: [0.018], width: [1.2], length: [2.4] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      material: 'MDF',
      thickness: 0.018,
      width: 1.2,
      length: 2.4,
    });
  });

  it('returns 2 stocks for a single item with 2 widths × 1 length × 1 thickness', () => {
    const result = reduceStockMatrix([
      { material: 'Ply', thickness: [0.012], width: [0.6, 1.2], length: [2.4] },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.width)).toEqual([0.6, 1.2]);
  });

  it('returns the Cartesian product count for multiple thicknesses and widths', () => {
    // 3 thicknesses × 2 widths × 2 lengths = 12
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        thickness: [0.009, 0.012, 0.018],
        width: [0.6, 1.2],
        length: [1.8, 2.4],
      },
    ]);
    expect(result).toHaveLength(12);
  });

  it('converts string distance "1in" thickness to approximately 0.0254m', () => {
    const result = reduceStockMatrix([
      { material: 'Ply', thickness: ['1in'], width: [1.2], length: [2.4] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].thickness).toBeCloseTo(0.0254, 6);
  });

  it('preserves material on all stocks', () => {
    const result = reduceStockMatrix([
      {
        material: 'Oak',
        thickness: [0.018],
        width: [0.3, 0.6],
        length: [1.8, 2.4],
      },
    ]);
    expect(result.every((s) => s.material === 'Oak')).toBe(true);
  });

  it('combines all stocks from multiple StockMatrix items', () => {
    const result = reduceStockMatrix([
      { material: 'MDF', thickness: [0.018], width: [1.2], length: [2.4] },
      { material: 'Ply', thickness: [0.012], width: [0.6], length: [1.8] },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].material).toBe('MDF');
    expect(result[1].material).toBe('Ply');
  });
});
