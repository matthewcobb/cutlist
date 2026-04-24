import { describe, it, expect } from 'bun:test';
import { createStripPacker } from '../StripPacker';
import type { PackOptions } from '../Packer';
import { Rectangle } from '../../geometry';

const baseOptions: PackOptions = {
  allowRotations: false,
  gap: 0,
  precision: 0,
};

describe('Strip Packer (horizontal)', () => {
  it('returns no placements for an empty rect list', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    expect(packer.pack(bin, [], baseOptions)).toEqual({
      placements: [],
      leftovers: [],
    });
  });

  it('places a single rect at the bin origin', () => {
    const packer = createStripPacker<string>();
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

  it('groups same-height parts into one strip', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    // Three 3x4 parts should form one strip of height 4
    const rects = [
      new Rectangle('a', 0, 0, 3, 4),
      new Rectangle('b', 0, 0, 3, 4),
      new Rectangle('c', 0, 0, 3, 4),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(3);
    // All parts share the same bottom coordinate (same strip)
    for (const p of result.placements) {
      expect(p.bottom).toBe(0);
      expect(p.height).toBe(4);
    }
    // Placed left-to-right
    const lefts = result.placements.map((p) => p.left).sort((a, b) => a - b);
    expect(lefts).toEqual([0, 3, 6]);
  });

  it('separates different-height parts into distinct strips', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 20);
    const rects = [
      new Rectangle('tall', 0, 0, 4, 6),
      new Rectangle('short', 0, 0, 4, 3),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Different bottom coordinates — different strips
    const bottoms = result.placements.map((p) => p.bottom);
    expect(new Set(bottoms).size).toBe(2);
    // Taller strip placed first (FFD — tallest strip at bottom)
    const tallPlacement = result.placements.find((p) => p.data === 'tall')!;
    const shortPlacement = result.placements.find((p) => p.data === 'short')!;
    expect(tallPlacement.bottom).toBeLessThan(shortPlacement.bottom);
  });

  it('aligns similar parts within the same strip', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 20, 20);
    // 5 parts all 4 units tall — should share strips, all at same bottom
    const rects = [
      new Rectangle('a', 0, 0, 5, 4),
      new Rectangle('b', 0, 0, 6, 4),
      new Rectangle('c', 0, 0, 7, 4),
      new Rectangle('d', 0, 0, 3, 4),
      new Rectangle('e', 0, 0, 4, 4),
    ];
    // Total width = 5+6+7+3+4 = 25, bin width = 20
    // Should split across strips but all strips have height 4
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    // All parts should have height 4
    for (const p of result.placements) {
      expect(p.height).toBe(4);
    }
    // Parts in the same strip share the same bottom
    const byBottom = new Map<number, typeof result.placements>();
    for (const p of result.placements) {
      if (!byBottom.has(p.bottom)) byBottom.set(p.bottom, []);
      byBottom.get(p.bottom)!.push(p);
    }
    // Should be exactly 2 strips (7+6+5=18 first, 4+3=7 second)
    expect(byBottom.size).toBe(2);
  });

  it('respects kerf gap between parts within a strip', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 5);
    // Two 4x5 parts with gap=1: 4 + 1 + 4 = 9 ≤ 10
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

  it('respects kerf gap between strips', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 20);
    // Two different-height parts → two strips
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 4, 6), new Rectangle('b', 0, 0, 4, 3)],
      { ...baseOptions, gap: 1 },
    );

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    const sorted = result.placements.toSorted((a, b) => a.bottom - b.bottom);
    // Gap between strip top and next strip bottom
    expect(sorted[1].bottom - sorted[0].top).toBeGreaterThanOrEqual(1);
  });

  it('rotates rects to minimize strip height when allowed', () => {
    const packer = createStripPacker<string>();
    // Bin is wide and short
    const bin = new Rectangle(null, 0, 0, 10, 4);
    // Part is 2x5 — unrotated height=5 > bin height=4; rotated → 5x2, height=2 fits
    const result = packer.pack(bin, [new Rectangle('a', 0, 0, 2, 5)], {
      ...baseOptions,
      allowRotations: true,
    });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(1);
    // Should be rotated: width=5, height=2
    expect(result.placements[0]).toMatchObject({ width: 5, height: 2 });
  });

  it('does not rotate when rotation makes the part too wide', () => {
    const packer = createStripPacker<string>();
    // Bin is narrow and tall — 3 wide, 10 tall
    const bin = new Rectangle(null, 0, 0, 3, 10);
    // Part is 2x5 — unrotated: width=2 fits in 3. Rotated: width=5 > 3, won't fit.
    const result = packer.pack(bin, [new Rectangle('a', 0, 0, 2, 5)], {
      ...baseOptions,
      allowRotations: true,
    });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(1);
    // Should NOT be rotated since 5 > 3 along-dimension
    expect(result.placements[0]).toMatchObject({ width: 2, height: 5 });
  });

  it('respects canRotateRect (grain lock)', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    // Part is 2x8 — would benefit from rotation (height 8 → 2) but locked
    const result = packer.pack(bin, [new Rectangle('locked', 0, 0, 2, 8)], {
      ...baseOptions,
      allowRotations: true,
      canRotateRect: () => false,
    });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ width: 2, height: 8 });
  });

  it('returns oversize rects as leftovers', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 5, 5);
    const result = packer.pack(
      bin,
      [new Rectangle('too-wide', 0, 0, 6, 3)],
      baseOptions,
    );
    expect(result.placements).toEqual([]);
    expect(result.leftovers).toEqual(['too-wide']);
  });

  it('returns parts from strips that exceed bin height as leftovers', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 7);
    // Three strips of height 3 each = 9, but bin height = 7
    // First two fit (3 + 3 = 6 ≤ 7), third doesn't
    const rects = [
      new Rectangle('a', 0, 0, 10, 3),
      new Rectangle('b', 0, 0, 10, 3),
      new Rectangle('c', 0, 0, 10, 3),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.placements).toHaveLength(2);
    expect(result.leftovers).toEqual(['c']);
  });

  it('respects non-zero bin origin (margin)', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 2, 3, 10, 10);
    const rects = [
      new Rectangle('a', 0, 0, 4, 5),
      new Rectangle('b', 0, 0, 4, 5),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    for (const p of result.placements) {
      expect(p.left).toBeGreaterThanOrEqual(2);
      expect(p.bottom).toBeGreaterThanOrEqual(3);
      expect(p.right).toBeLessThanOrEqual(12);
      expect(p.top).toBeLessThanOrEqual(13);
    }
  });

  it('produces no overlapping placements', () => {
    const packer = createStripPacker<string>();
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

  it('produces guillotine-cuttable strip layouts', () => {
    const packer = createStripPacker<string>();
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

    // Group by bottom coordinate (strip)
    const strips = new Map<number, typeof result.placements>();
    for (const p of result.placements) {
      if (!strips.has(p.bottom)) strips.set(p.bottom, []);
      strips.get(p.bottom)!.push(p);
    }

    // Parts in the same strip must have identical height (the strip cross-dim)
    for (const [, parts] of strips) {
      const heights = parts.map((p) => p.height);
      const maxH = Math.max(...heights);
      for (const h of heights) {
        expect(h).toBe(maxH);
      }
    }
  });

  it('uses FFD — tallest strips placed first', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 20);
    // Parts of heights 2, 4, 6 — strips should be stacked tallest-first
    const rects = [
      new Rectangle('short', 0, 0, 5, 2),
      new Rectangle('medium', 0, 0, 5, 4),
      new Rectangle('tall', 0, 0, 5, 6),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(3);

    const tall = result.placements.find((p) => p.data === 'tall')!;
    const medium = result.placements.find((p) => p.data === 'medium')!;
    const short = result.placements.find((p) => p.data === 'short')!;
    expect(tall.bottom).toBeLessThan(medium.bottom);
    expect(medium.bottom).toBeLessThan(short.bottom);
  });
});

describe('Strip Packer (tolerant grouping)', () => {
  it('groups near-matching heights within kerf tolerance', () => {
    const packer = createStripPacker<string>({ groupingTolerance: 'kerf' });
    const bin = new Rectangle(null, 0, 0, 20, 20);
    // Heights 4.0 and 3.8 — differ by 0.2, within gap=0.3
    const rects = [
      new Rectangle('a', 0, 0, 5, 4.0),
      new Rectangle('b', 0, 0, 5, 3.8),
    ];
    const result = packer.pack(bin, rects, { ...baseOptions, gap: 0.3 });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Both should be in the same strip (same bottom)
    expect(result.placements[0].bottom).toBe(result.placements[1].bottom);
  });

  it('separates heights that exceed kerf tolerance', () => {
    const packer = createStripPacker<string>({ groupingTolerance: 'kerf' });
    const bin = new Rectangle(null, 0, 0, 20, 20);
    // Heights 4.0 and 3.0 — differ by 1.0, exceeds gap=0.3
    const rects = [
      new Rectangle('a', 0, 0, 5, 4.0),
      new Rectangle('b', 0, 0, 5, 3.0),
    ];
    const result = packer.pack(bin, rects, { ...baseOptions, gap: 0.3 });

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Different strips (different bottoms)
    expect(result.placements[0].bottom).not.toBe(result.placements[1].bottom);
  });

  it('exact grouping separates near-matches', () => {
    const packer = createStripPacker<string>({ groupingTolerance: 'exact' });
    const bin = new Rectangle(null, 0, 0, 20, 20);
    // Heights 4.0 and 3.8 — with exact grouping and precision=0, these differ
    const rects = [
      new Rectangle('a', 0, 0, 5, 4.0),
      new Rectangle('b', 0, 0, 5, 3.8),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Different strips
    expect(result.placements[0].bottom).not.toBe(result.placements[1].bottom);
  });
});

describe('Strip Packer (vertical orientation)', () => {
  it('creates vertical strips (parts stacked bottom-to-top)', () => {
    const packer = createStripPacker<string>({ orientation: 'vertical' });
    const bin = new Rectangle(null, 0, 0, 10, 10);
    // Three 4x3 parts — vertical strips: crossDim=width=4, alongDim=height=3
    const rects = [
      new Rectangle('a', 0, 0, 4, 3),
      new Rectangle('b', 0, 0, 4, 3),
      new Rectangle('c', 0, 0, 4, 3),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(3);
    // All parts in the same strip share the same left coordinate
    for (const p of result.placements) {
      expect(p.left).toBe(0);
      expect(p.width).toBe(4);
    }
    // Placed bottom-to-top
    const bottoms = result.placements
      .map((p) => p.bottom)
      .sort((a, b) => a - b);
    expect(bottoms).toEqual([0, 3, 6]);
  });

  it('stacks vertical strips left-to-right', () => {
    const packer = createStripPacker<string>({ orientation: 'vertical' });
    const bin = new Rectangle(null, 0, 0, 20, 10);
    // Parts of different widths → different vertical strips
    const rects = [
      new Rectangle('wide', 0, 0, 6, 5),
      new Rectangle('narrow', 0, 0, 3, 5),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    // Wider strip placed first (FFD)
    const wide = result.placements.find((p) => p.data === 'wide')!;
    const narrow = result.placements.find((p) => p.data === 'narrow')!;
    expect(wide.left).toBeLessThan(narrow.left);
  });
});

describe('Strip Packer (strip filling — 1D FFD within strips)', () => {
  it('fills strips longest-first within a group', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 15, 10);
    // All height 4, varying widths — should pack longest first
    const rects = [
      new Rectangle('short', 0, 0, 3, 4),
      new Rectangle('long', 0, 0, 8, 4),
      new Rectangle('medium', 0, 0, 5, 4),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    // FFD: long(8) + medium(5) = 13 on strip 1, short(3) on strip 1 too (13+3=16>15? no 13+3=16>15 so strip 2)
    // Actually 8+5+3=16>15, so 8+5=13 on strip 1, 3 on strip 2
    // OR 8+3=11 on strip 1, 5 on strip 2 (first-fit decreasing)
    // With FFD: sorted desc = [8, 5, 3]. Try 8 → strip1(8). Try 5 → strip1(8+5=13 ≤ 15) → strip1(13). Try 3 → strip1(13+3=16 > 15) → strip2(3).
    const strip1 = result.placements.filter((p) => p.bottom === 0);
    const strip2 = result.placements.filter((p) => p.bottom > 0);
    expect(strip1).toHaveLength(2); // long + medium
    expect(strip2).toHaveLength(1); // short
  });

  it('opens multiple strips for parts that exceed one strip length', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 20);
    // 4 parts, each 4 wide, height 5. Strip width = 10, so 2 per strip.
    const rects = [
      new Rectangle('a', 0, 0, 4, 5),
      new Rectangle('b', 0, 0, 4, 5),
      new Rectangle('c', 0, 0, 4, 5),
      new Rectangle('d', 0, 0, 4, 5),
    ];
    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(4);
    // Two strips of 2 parts each
    const byBottom = new Map<number, typeof result.placements>();
    for (const p of result.placements) {
      if (!byBottom.has(p.bottom)) byBottom.set(p.bottom, []);
      byBottom.get(p.bottom)!.push(p);
    }
    expect(byBottom.size).toBe(2);
    for (const [, parts] of byBottom) {
      expect(parts).toHaveLength(2);
    }
  });
});
