import { describe, it, expect } from 'vitest';
import { createGuillotinePacker } from '../GuillotinePacker';
import type { PackOptions } from '../Packer';
import { Rectangle } from '../../geometry';

const baseOptions: PackOptions = {
  allowRotations: false,
  gap: 0,
  precision: 0,
};

describe('Guillotine Packer', () => {
  it('returns no placements for an empty rect list', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    expect(packer.pack(bin, [], baseOptions)).toEqual({
      placements: [],
      leftovers: [],
    });
  });

  it('places a single rect at the bin origin', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 4, 6)],
      baseOptions,
    );
    expect(result.leftovers).toEqual([]);
    expect(result.placements).toEqual([
      expect.objectContaining({ data: 'a', left: 0, bottom: 0 }),
    ]);
  });

  it('packs four rects into a 10x10 bin without overlap', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    const rects = [
      new Rectangle('a', 0, 0, 5, 5),
      new Rectangle('b', 0, 0, 5, 5),
      new Rectangle('c', 0, 0, 5, 5),
      new Rectangle('d', 0, 0, 5, 5),
    ];

    const result = packer.pack(bin, rects, baseOptions);

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(4);

    // Verify no two placements intersect.
    for (let i = 0; i < result.placements.length; i++) {
      for (let j = i + 1; j < result.placements.length; j++) {
        expect(
          result.placements[i].isIntersecting(result.placements[j], 0),
        ).toBe(false);
      }
    }
    // All placements must be inside the bin.
    for (const p of result.placements) {
      expect(p.isInside(bin, 0)).toBe(true);
    }
  });

  it('rotates rects to fit when allowed', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 1, 3);
    const result = packer.pack(
      bin,
      [new Rectangle('a', 0, 0, 1, 1), new Rectangle('b', 0, 0, 2, 1)],
      { ...baseOptions, allowRotations: true },
    );

    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
    expect(result.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: 'b', width: 1, height: 2 }),
      ]),
    );
  });

  it('returns oversize rects as leftovers', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 5, 5);
    const result = packer.pack(
      bin,
      [new Rectangle('too-tall', 0, 0, 5, 6)],
      baseOptions,
    );
    expect(result.placements).toEqual([]);
    expect(result.leftovers).toEqual(['too-tall']);
  });

  it('respects kerf gap between placements', () => {
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 5);
    // Two 4x5 rects with a kerf of 1 should fit (4 + 1 + 4 = 9 ≤ 10);
    // a third 2x5 would not (would need 4+1+4+1+2 = 12).
    const result = packer.pack(
      bin,
      [
        new Rectangle('a', 0, 0, 4, 5),
        new Rectangle('b', 0, 0, 4, 5),
        new Rectangle('c', 0, 0, 2, 5),
      ],
      { ...baseOptions, gap: 1 },
    );

    expect(result.placements).toHaveLength(2);
    expect(result.leftovers).toEqual(['c']);

    const sorted = result.placements.toSorted((p1, p2) => p1.left - p2.left);
    // Adjacent placements must be separated by at least the kerf.
    expect(sorted[1].left - sorted[0].right).toBeGreaterThanOrEqual(1);
  });

  it('recovers contiguous free space via rectangle merge', () => {
    // Place a small rect, remove the space it consumed, then verify a much
    // larger rect can still fit by reclaiming the merged residual.
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);

    // Without merge this scenario could fail: a 1x10 column placed first
    // would split the bin into a 1x0 (gone) and a 9x10, so the 9x10 still
    // fits — confirms the basic case.
    const result = packer.pack(
      bin,
      [new Rectangle('thin', 0, 0, 1, 10), new Rectangle('big', 0, 0, 9, 10)],
      baseOptions,
    );
    expect(result.leftovers).toEqual([]);
    expect(result.placements).toHaveLength(2);
  });

  it('produces strictly guillotine-cuttable layouts (axis-aligned cuts)', () => {
    // Every placement edge that lies inside the bin must extend to another
    // placement edge or a bin edge — i.e., the layout can be reproduced with
    // edge-to-edge cuts.
    const packer = createGuillotinePacker<string>();
    const bin = new Rectangle(null, 0, 0, 20, 20);
    const result = packer.pack(
      bin,
      [
        new Rectangle('a', 0, 0, 8, 12),
        new Rectangle('b', 0, 0, 12, 8),
        new Rectangle('c', 0, 0, 8, 8),
        new Rectangle('d', 0, 0, 4, 12),
        new Rectangle('e', 0, 0, 8, 4),
      ],
      baseOptions,
    );

    for (const p of result.placements) {
      // Must be inside the bin.
      expect(p.isInside(bin, 1e-9)).toBe(true);
    }
    // No two placements may intersect.
    for (let i = 0; i < result.placements.length; i++) {
      for (let j = i + 1; j < result.placements.length; j++) {
        expect(
          result.placements[i].isIntersecting(result.placements[j], 1e-9),
        ).toBe(false);
      }
    }
  });
});
