import { describe, it, expect } from 'bun:test';
import { createShelfPacker } from '../ShelfPacker';
import type { PackOptions } from '../Packer';
import { Rectangle } from '../../geometry';

const baseOptions: PackOptions = {
  allowRotations: false,
  gap: 0,
  precision: 0,
};

describe('Shelf Packer', () => {
  it('returns no placements for an empty rect list', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    expect(packer.pack(bin, [], baseOptions)).toEqual({
      placements: [],
      leftovers: [],
    });
  });

  it('places a single rect at the bin origin', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 4, 6)],
      baseOptions,
    );
    expect(result.leftovers).toEqual([]);
    expect(result.placements).toEqual([
      expect.objectContaining({
        data: 'a',
        left: 0,
        bottom: 0,
        width: 4,
        height: 6,
      }),
    ]);
  });

  it('packs parts into horizontal shelves (same-height parts in a row)', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    // Three 3x4 parts should form one shelf of height 4
    const rects = [
      new Rectangle('a', 0, 0, 3, 4),
      new Rectangle('b', 0, 0, 3, 4),
      new Rectangle('c', 0, 0, 3, 4),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(3);
    // All on same shelf (bottom = 0)
    for (const p of result.placements) {
      expect(p.bottom).toBe(0);
      expect(p.height).toBe(4);
    }
    // Placed left to right
    const lefts = result.placements.map((p) => p.left).sort((a, b) => a - b);
    expect(lefts).toEqual([0, 3, 6]);
  });

  it('opens a new shelf when parts do not fit on current shelf width', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 20);
    const rects = [
      new Rectangle('a', 0, 0, 6, 4),
      new Rectangle('b', 0, 0, 6, 4),
      // These two won't fit side-by-side with a+b, should go on shelf 2
      new Rectangle('c', 0, 0, 6, 3),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(3);

    const shelf1 = result.placements.filter((p) => p.bottom === 0);
    const shelf2 = result.placements.filter((p) => p.bottom > 0);
    expect(shelf1).toHaveLength(1); // only 'a' fits (6 wide), then 'b' doesn't fit (6+6=12>10)
    expect(shelf2).toHaveLength(2);
  });

  it('returns oversize rects as leftovers', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 5, 5);
    const result = packer.pack(
      bin,
      [new Rectangle('too-wide', 0, 0, 6, 3)],
      baseOptions,
    );
    expect(result.placements).toEqual([]);
    expect(result.leftovers).toEqual(['too-wide']);
  });

  it('rotates rects to fit when allowed', () => {
    const packer = createShelfPacker<string>();
    // Bin is narrow and tall
    const bin = new Rectangle(null, 0, 0, 3, 10);
    // Part is 5x2 — won't fit unrotated (5 > 3), but 2x5 fits
    const result = packer.pack(bin, [new Rectangle('a', 0, 0, 5, 2)], {
      ...baseOptions,
      allowRotations: true,
    });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(1);
    // Should be rotated: width=2, height=5
    expect(result.placements[0]).toMatchObject({ width: 2, height: 5 });
  });

  it('respects kerf gap between parts on same shelf', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 5);
    // Two 4x5 parts with gap=1: 4 + 1 + 4 = 9 ≤ 10, should fit
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 4, 5), new Rectangle('b', 0, 0, 4, 5)],
      { ...baseOptions, gap: 1 },
    );

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    const sorted = result.placements.toSorted((a, b) => a.left - b.left);
    expect(sorted[1].left - sorted[0].right).toBeGreaterThanOrEqual(1);
  });

  it('respects kerf gap between shelves', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 3, 10);
    // Two parts that each need their own shelf
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 3, 4), new Rectangle('b', 0, 0, 3, 4)],
      { ...baseOptions, gap: 1 },
    );

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    const sorted = result.placements.toSorted((a, b) => a.bottom - b.bottom);
    // Gap between shelf top and next shelf bottom
    expect(sorted[1].bottom - sorted[0].top).toBeGreaterThanOrEqual(1);
  });

  it('shorter parts fit onto shelf opened by taller part', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    const rects = [
      new Rectangle('tall', 0, 0, 3, 6),
      new Rectangle('short', 0, 0, 3, 2), // height 2 < shelf height 6
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Both on same shelf
    expect(result.placements[0].bottom).toBe(0);
    expect(result.placements[1].bottom).toBe(0);
  });

  it('produces no overlapping placements', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 20, 20);
    const rects = [
      new Rectangle('a', 0, 0, 8, 12),
      new Rectangle('b', 0, 0, 12, 8),
      new Rectangle('c', 0, 0, 8, 8),
      new Rectangle('d', 0, 0, 4, 12),
      new Rectangle('e', 0, 0, 8, 4),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    for (const p of result.placements) {
      expect(p.isInside(bin, 1e-9)).toBe(true);
    }
    for (let i = 0; i < result.placements.length; i++) {
      for (let j = i + 1; j < result.placements.length; j++) {
        expect(
          result.placements[i].isIntersecting(result.placements[j], 1e-9),
        ).toBe(false);
      }
    }
  });

  it('produces guillotine-cuttable layouts (uniform shelf rows)', () => {
    const packer = createShelfPacker<string>();
    const bin = new Rectangle(null, 0, 0, 20, 20);
    const rects = [
      new Rectangle('a', 0, 0, 5, 4),
      new Rectangle('b', 0, 0, 7, 4),
      new Rectangle('c', 0, 0, 6, 4),
      new Rectangle('d', 0, 0, 5, 6),
      new Rectangle('e', 0, 0, 8, 6),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);

    // Group placements by bottom coordinate (shelf)
    const shelves = new Map<number, typeof result.placements>();
    for (const p of result.placements) {
      const key = p.bottom;
      if (!shelves.has(key)) shelves.set(key, []);
      shelves.get(key)!.push(p);
    }

    // Each shelf should have parts that don't exceed shelf height
    for (const [, parts] of shelves) {
      const shelfHeight = Math.max(...parts.map((p) => p.height));
      for (const p of parts) {
        expect(p.height).toBeLessThanOrEqual(shelfHeight + 1e-9);
      }
    }
  });
});
