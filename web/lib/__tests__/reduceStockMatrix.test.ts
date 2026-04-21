import { describe, expect, it } from 'bun:test';
import { reduceStockMatrix } from '..';

describe('reduceStockMatrix', () => {
  it('returns [] for an empty matrix', () => {
    expect(reduceStockMatrix([])).toEqual([]);
  });

  it('interprets plain numbers using material unit (mm)', () => {
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        thickness: [18],
        width: [1220],
        length: [2440],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].thickness).toBeCloseTo(0.018, 6);
    expect(result[0].width).toBeCloseTo(1.22, 6);
    expect(result[0].length).toBeCloseTo(2.44, 6);
  });

  it('interprets plain numbers using material unit (in)', () => {
    const result = reduceStockMatrix([
      {
        material: 'Ply',
        unit: 'in',
        thickness: [0.75],
        width: [48],
        length: [96],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].thickness).toBeCloseTo(0.01905, 5);
    expect(result[0].width).toBeCloseTo(1.2192, 4);
    expect(result[0].length).toBeCloseTo(2.4384, 4);
  });

  it('defaults unit to mm when not specified', () => {
    const result = reduceStockMatrix([
      { material: 'MDF', thickness: [18], width: [1220], length: [2440] },
    ]);
    expect(result[0].thickness).toBeCloseTo(0.018, 6);
  });

  it('returns 2 stocks for a single item with 2 widths × 1 length × 1 thickness', () => {
    const result = reduceStockMatrix([
      {
        material: 'Ply',
        unit: 'mm',
        thickness: [12],
        width: [600, 1220],
        length: [2440],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.width)).toEqual([0.6, 1.22]);
  });

  it('returns the Cartesian product count for multiple thicknesses and widths', () => {
    // 3 thicknesses × 2 widths × 2 lengths = 12
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        thickness: [9, 12, 18],
        width: [600, 1220],
        length: [1800, 2440],
      },
    ]);
    expect(result).toHaveLength(12);
  });

  it('string dimensions carry their own unit (backward compat)', () => {
    const result = reduceStockMatrix([
      {
        material: 'Ply',
        thickness: ['1in'],
        width: ['1220mm'],
        length: ['2440mm'],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].thickness).toBeCloseTo(0.0254, 6);
    expect(result[0].width).toBeCloseTo(1.22, 6);
  });

  it('preserves material on all stocks', () => {
    const result = reduceStockMatrix([
      {
        material: 'Oak',
        unit: 'mm',
        thickness: [18],
        width: [300, 600],
        length: [1800, 2400],
      },
    ]);
    expect(result.every((s) => s.material === 'Oak')).toBe(true);
  });

  it('combines all stocks from multiple StockMatrix items', () => {
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        thickness: [18],
        width: [1220],
        length: [2440],
      },
      {
        material: 'Ply',
        unit: 'mm',
        thickness: [12],
        width: [600],
        length: [1800],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].material).toBe('MDF');
    expect(result[1].material).toBe('Ply');
  });

  it('mixes string and number dimensions within one material', () => {
    const result = reduceStockMatrix([
      {
        material: 'Mix',
        unit: 'mm',
        thickness: [18, '1in'],
        width: [1220],
        length: [2440],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].thickness).toBeCloseTo(0.018, 6); // 18mm
    expect(result[1].thickness).toBeCloseTo(0.0254, 6); // 1in string
  });
});
