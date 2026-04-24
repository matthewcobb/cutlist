import { describe, it, expect } from 'vitest';
import { createGenericPacker } from '../GenericPacker';
import { Rectangle } from '../../geometry';
import { getAllPossiblePlacements } from '../utils';
import type { PackOptions } from '../Packer';
import type { Point } from '../../geometry';

const defaultOptions: PackOptions = {
  allowRotations: false,
  gap: 0,
  precision: 0,
};

/** Build a packer that uses getAllPossiblePlacements with no custom sort. */
function makePacker<T>() {
  return createGenericPacker<T>({
    getPossiblePlacements: getAllPossiblePlacements,
  });
}

describe('createGenericPacker', () => {
  describe('pack', () => {
    it('returns empty placements and leftovers when no rects are given', () => {
      const packer = makePacker<string>();
      const bin = new Rectangle(null, 0, 0, 10, 10);
      const result = packer.pack(bin, [], defaultOptions);
      expect(result.placements).toEqual([]);
      expect(result.leftovers).toEqual([]);
    });

    it('places a single rect that fits at the bin bottom-left', () => {
      const packer = makePacker<string>();
      const bin = new Rectangle(null, 0, 0, 10, 10);
      const rect = new Rectangle('a', 0, 0, 5, 5);
      const result = packer.pack(bin, [rect], defaultOptions);
      expect(result.leftovers).toEqual([]);
      expect(result.placements).toHaveLength(1);
      expect(result.placements[0]).toMatchObject({
        data: 'a',
        left: bin.bottomLeft.x,
        bottom: bin.bottomLeft.y,
        width: 5,
        height: 5,
      });
    });

    it('puts a single rect that is too large in leftovers', () => {
      const packer = makePacker<string>();
      const bin = new Rectangle(null, 0, 0, 4, 4);
      const rect = new Rectangle('big', 0, 0, 10, 10);
      const result = packer.pack(bin, [rect], defaultOptions);
      expect(result.placements).toEqual([]);
      expect(result.leftovers).toEqual(['big']);
    });

    it('places two rects that both fit with no leftovers', () => {
      const packer = makePacker<string>();
      // 10×5 bin: two 5×5 pieces side by side
      const bin = new Rectangle(null, 0, 0, 10, 5);
      const rects = [
        new Rectangle('a', 0, 0, 5, 5),
        new Rectangle('b', 0, 0, 5, 5),
      ];
      const result = packer.pack(bin, rects, defaultOptions);
      expect(result.leftovers).toEqual([]);
      expect(result.placements).toHaveLength(2);
    });

    it('places first rect and puts second in leftovers when bin is full after first', () => {
      const packer = makePacker<string>();
      // Bin exactly fits the first rect; nothing left for the second
      const bin = new Rectangle(null, 0, 0, 5, 5);
      const rects = [
        new Rectangle('a', 0, 0, 5, 5),
        new Rectangle('b', 0, 0, 3, 3),
      ];
      const result = packer.pack(bin, rects, defaultOptions);
      expect(result.placements).toHaveLength(1);
      expect(result.placements[0]).toMatchObject({ data: 'a' });
      expect(result.leftovers).toEqual(['b']);
    });
  });

  describe('addToPack', () => {
    it('appends placements to an existing result', () => {
      const packer = makePacker<string>();
      const bin = new Rectangle(null, 0, 0, 10, 5);
      const options = defaultOptions;

      // First pack: one 5×5 piece
      const result = packer.pack(
        bin,
        [new Rectangle('a', 0, 0, 5, 5)],
        options,
      );
      expect(result.placements).toHaveLength(1);

      // addToPack: add another 5×5 piece that fits to the right
      packer.addToPack(result, bin, [new Rectangle('b', 0, 0, 5, 5)], options);
      expect(result.placements).toHaveLength(2);
      expect(result.placements.map((p) => p.data)).toContain('b');
      expect(result.leftovers).toEqual([]);
    });
  });

  describe('sortPlacements', () => {
    it('uses sortPlacements to influence which point is tried first', () => {
      // We need a scenario where two candidate points are BOTH valid so the sort order
      // determines which one is chosen.
      //
      // Setup: bin 10×10. Place an anchor rect (5×5) at bottom-left.
      // After placing the anchor, getAllPossiblePlacements returns three candidates:
      //   P0 = bin.bottomLeft          = (0, 0)  — blocked by anchor
      //   P1 = anchor.topLeft + (0,gap) = (0, 5)  — valid (top-left corner)
      //   P2 = anchor.bottomRight + gap = (5, 0)  — valid (to the right)
      // P0 is occupied, so both P1 and P2 are valid placement origins for the 3×3 probe.
      //
      // Default (no sort): points come out [P0, P1, P2]; P0 fails, P1=(0,5) wins.
      // Sorted by descending x: order becomes [P2(x=5), P1(x=0), P0(x=0)]; P2=(5,0) wins.

      const defaultPacker = createGenericPacker<string>({
        getPossiblePlacements: getAllPossiblePlacements,
        // no sortPlacements
      });

      const reversedPacker = createGenericPacker<string>({
        getPossiblePlacements: getAllPossiblePlacements,
        sortPlacements: (a: Point, b: Point) => b.x - a.x,
      });

      const bin = new Rectangle(null, 0, 0, 10, 10);
      const anchor = new Rectangle('anchor', 0, 0, 5, 5);
      const probe = new Rectangle('probe', 0, 0, 3, 3);

      const defaultResult = defaultPacker.pack(
        bin,
        [anchor, probe],
        defaultOptions,
      );
      const reversedResult = reversedPacker.pack(
        bin,
        [anchor, probe],
        defaultOptions,
      );

      const defaultProbe = defaultResult.placements.find(
        (p) => p.data === 'probe',
      )!;
      const reversedProbe = reversedResult.placements.find(
        (p) => p.data === 'probe',
      )!;

      expect(defaultProbe).toBeDefined();
      expect(reversedProbe).toBeDefined();
      // Default places at (0,5), reversed places at (5,0)
      expect(defaultProbe).toMatchObject({ left: 0, bottom: 5 });
      expect(reversedProbe).toMatchObject({ left: 5, bottom: 0 });
    });
  });

  describe('allowRotations', () => {
    it('rejects a rect that only fits when rotated when allowRotations=false', () => {
      const packer = makePacker<string>();
      // Bin is 3 wide × 10 tall; rect is 10 wide × 3 tall → only fits if rotated
      const bin = new Rectangle(null, 0, 0, 3, 10);
      const rect = new Rectangle('r', 0, 0, 10, 3);
      const noRotResult = packer.pack(bin, [rect], {
        ...defaultOptions,
        allowRotations: false,
      });
      expect(noRotResult.placements).toHaveLength(0);
      expect(noRotResult.leftovers).toEqual(['r']);
    });

    it('places a rect that only fits when rotated when allowRotations=true', () => {
      const packer = makePacker<string>();
      const bin = new Rectangle(null, 0, 0, 3, 10);
      const rect = new Rectangle('r', 0, 0, 10, 3);
      const rotResult = packer.pack(bin, [rect], {
        ...defaultOptions,
        allowRotations: true,
      });
      expect(rotResult.leftovers).toEqual([]);
      expect(rotResult.placements).toHaveLength(1);
      // Placed orientation should be flipped: width=3, height=10
      expect(rotResult.placements[0]).toMatchObject({
        data: 'r',
        width: 3,
        height: 10,
      });
    });
  });

  describe('gap', () => {
    it('respects the gap between placed rects', () => {
      const packer = makePacker<string>();
      // Bin: 12×5. First rect: 5×5. Second rect: 5×5. Gap: 2.
      // After placing the first rect at (0,0), the only candidate aside from
      // bin.bottomLeft is bottomRight of first rect + gap = (5+2, 0) = (7, 0).
      // The second rect placed at (7,0) would extend to right=12 which fits exactly.
      const bin = new Rectangle(null, 0, 0, 12, 5);
      const rects = [
        new Rectangle('a', 0, 0, 5, 5),
        new Rectangle('b', 0, 0, 5, 5),
      ];
      const result = packer.pack(bin, rects, { ...defaultOptions, gap: 2 });

      expect(result.leftovers).toEqual([]);
      expect(result.placements).toHaveLength(2);

      const placed = result.placements;
      const placedA = placed.find((p) => p.data === 'a')!;
      const placedB = placed.find((p) => p.data === 'b')!;

      // The gap between them: left edge of B minus right edge of A should equal the gap
      expect(placedB.left - placedA.right).toBeGreaterThanOrEqual(2);
    });

    it('puts second rect in leftovers when gap makes it not fit', () => {
      const packer = makePacker<string>();
      // Bin: 10×5. Gap: 1. Two 5×5 rects: second needs 5+1+5=11 but bin is only 10 wide.
      const bin = new Rectangle(null, 0, 0, 10, 5);
      const rects = [
        new Rectangle('a', 0, 0, 5, 5),
        new Rectangle('b', 0, 0, 5, 5),
      ];
      const result = packer.pack(bin, rects, { ...defaultOptions, gap: 1 });
      expect(result.placements).toHaveLength(1);
      expect(result.leftovers).toEqual(['b']);
    });
  });
});
