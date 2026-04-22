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
        hasGrain: false,
        thickness: [18],
        sizes: [{ width: 1220, length: 2440 }],
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
        hasGrain: false,
        thickness: [0.75],
        sizes: [{ width: 48, length: 96 }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].thickness).toBeCloseTo(0.01905, 5);
    expect(result[0].width).toBeCloseTo(1.2192, 4);
    expect(result[0].length).toBeCloseTo(2.4384, 4);
  });

  it('defaults unit to mm when not specified', () => {
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        hasGrain: false,
        thickness: [18],
        sizes: [{ width: 1220, length: 2440 }],
      },
    ]);
    expect(result[0].thickness).toBeCloseTo(0.018, 6);
  });

  it('returns one stock per size × thickness combination', () => {
    const result = reduceStockMatrix([
      {
        material: 'Ply',
        unit: 'mm',
        hasGrain: false,
        thickness: [12],
        sizes: [
          { width: 600, length: 2440 },
          { width: 1220, length: 2440 },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.width)).toEqual([0.6, 1.22]);
  });

  it('returns sizes × thicknesses count', () => {
    // 2 sizes × 3 thicknesses = 6
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        hasGrain: false,
        thickness: [9, 12, 18],
        sizes: [
          { width: 600, length: 1800 },
          { width: 1220, length: 2440 },
        ],
      },
    ]);
    expect(result).toHaveLength(6);
  });

  it('string dimensions carry their own unit (backward compat)', () => {
    const result = reduceStockMatrix([
      {
        material: 'Ply',
        unit: 'mm',
        hasGrain: false,
        thickness: ['1in'],
        sizes: [{ width: '1220mm', length: '2440mm' }],
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
        hasGrain: false,
        thickness: [18],
        sizes: [
          { width: 300, length: 1800 },
          { width: 600, length: 2400 },
        ],
      },
    ]);
    expect(result.every((s) => s.material === 'Oak')).toBe(true);
  });

  it('combines all stocks from multiple StockMatrix items', () => {
    const result = reduceStockMatrix([
      {
        material: 'MDF',
        unit: 'mm',
        hasGrain: false,
        thickness: [18],
        sizes: [{ width: 1220, length: 2440 }],
      },
      {
        material: 'Ply',
        unit: 'mm',
        hasGrain: false,
        thickness: [12],
        sizes: [{ width: 600, length: 1800 }],
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
        hasGrain: false,
        thickness: [18, '1in'],
        sizes: [{ width: 1220, length: 2440 }],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].thickness).toBeCloseTo(0.018, 6); // 18mm
    expect(result[1].thickness).toBeCloseTo(0.0254, 6); // 1in string
  });
});
