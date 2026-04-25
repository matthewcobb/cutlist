import { describe, expect, it } from 'vitest';
import { canFitOnAnyBoard } from '../canFitOnAnyBoard';
import type { Stock } from 'cutlist';

const board = (
  material: string,
  thickness: number,
  width: number,
  length: number,
): Stock => ({ material, thickness, width, length });

const part = (
  material: string,
  thicknessM: number,
  widthM: number,
  lengthM: number,
) => ({ material, thicknessM, widthM, lengthM });

const PLYWOOD = 'Plywood';
const MDF = 'MDF';

// 4×8 ft sheet in meters (≈1.22 × 2.44)
const SHEET_4x8 = board(PLYWOOD, 0.019, 1.22, 2.44);
// 2×4 ft sheet
const SHEET_2x4 = board(PLYWOOD, 0.019, 0.61, 1.22);

describe('canFitOnAnyBoard', () => {
  describe('no grain lock (free rotation)', () => {
    it('returns true when part fits in normal orientation', () => {
      const p = part(PLYWOOD, 0.019, 0.5, 1.0);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(true);
    });

    it('returns true when part fits only if rotated', () => {
      // 1.5m wide × 0.5m long — won't fit 1.22 wide but will rotated
      const p = part(PLYWOOD, 0.019, 1.5, 0.5);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(true);
    });

    it('returns false when part is too large in both orientations', () => {
      const p = part(PLYWOOD, 0.019, 1.5, 2.5);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(false);
    });
  });

  describe('grain lock = length', () => {
    it('returns true when locked orientation fits', () => {
      // length lock: widthM → board width, lengthM → board length
      const p = part(PLYWOOD, 0.019, 0.5, 1.0);
      expect(canFitOnAnyBoard(p, 'length', [SHEET_4x8], 0)).toBe(true);
    });

    it('returns false when only the rotated orientation would fit', () => {
      // 1.5m wide × 0.5m long — with length lock, width=1.5 must fit board width=1.22
      const p = part(PLYWOOD, 0.019, 1.5, 0.5);
      expect(canFitOnAnyBoard(p, 'length', [SHEET_4x8], 0)).toBe(false);
    });
  });

  describe('grain lock = width', () => {
    it('returns true when locked orientation fits', () => {
      // width lock: lengthM → board width, widthM → board length
      const p = part(PLYWOOD, 0.019, 0.5, 1.0);
      expect(canFitOnAnyBoard(p, 'width', [SHEET_4x8], 0)).toBe(true);
    });

    it('returns false when locked orientation is too wide', () => {
      // width lock: lengthM → board width. lengthM=1.5 > board width=1.22
      const p = part(PLYWOOD, 0.019, 0.5, 1.5);
      expect(canFitOnAnyBoard(p, 'width', [SHEET_4x8], 0)).toBe(false);
    });
  });

  describe('material and thickness matching', () => {
    it('returns false when no boards match material', () => {
      const p = part(MDF, 0.019, 0.5, 0.5);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(false);
    });

    it('returns false when no boards match thickness', () => {
      const p = part(PLYWOOD, 0.012, 0.5, 0.5);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(false);
    });

    it('matches thickness within tolerance', () => {
      const p = part(PLYWOOD, 0.01905, 0.5, 0.5); // ~0.00005 off
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8], 0)).toBe(true);
    });

    it('returns false with empty board list', () => {
      const p = part(PLYWOOD, 0.019, 0.5, 0.5);
      expect(canFitOnAnyBoard(p, undefined, [], 0)).toBe(false);
    });
  });

  describe('margin handling', () => {
    it('subtracts margin from usable board area', () => {
      // Part exactly fits the 2×4 sheet (0.61 × 1.22)
      const p = part(PLYWOOD, 0.019, 0.61, 1.22);
      expect(canFitOnAnyBoard(p, 'length', [SHEET_2x4], 0)).toBe(true);
      // With 0.01m margin → usable = 0.59 × 1.20, part no longer fits
      expect(canFitOnAnyBoard(p, 'length', [SHEET_2x4], 0.01)).toBe(false);
    });

    it('part that fits within margins passes', () => {
      const p = part(PLYWOOD, 0.019, 0.5, 1.0);
      expect(canFitOnAnyBoard(p, 'length', [SHEET_2x4], 0.01)).toBe(true);
    });

    it('returns false when margin consumes entire board', () => {
      const p = part(PLYWOOD, 0.019, 0.1, 0.1);
      // margin = 0.35 → inset = 0.70, board width = 0.61 → usable < 0
      expect(canFitOnAnyBoard(p, undefined, [SHEET_2x4], 0.35)).toBe(false);
    });
  });

  describe('multiple boards', () => {
    it('returns true if part fits on any one board', () => {
      // Too big for 2×4 sheet, fits on 4×8
      const p = part(PLYWOOD, 0.019, 1.0, 2.0);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_2x4, SHEET_4x8], 0)).toBe(
        true,
      );
    });

    it('skips non-matching materials and finds a match', () => {
      const mdfBoard = board(MDF, 0.019, 2.0, 3.0);
      const p = part(MDF, 0.019, 0.5, 0.5);
      expect(canFitOnAnyBoard(p, undefined, [SHEET_4x8, mdfBoard], 0)).toBe(
        true,
      );
    });
  });
});
