import { describe, it, expect } from 'vitest';
import { Rectangle } from '../../geometry';
import { getAllPossiblePlacements, isValidPlacement } from '../utils';

// Helpers to create rectangles. data is typed as null for test purposes.
function rect(x: number, y: number, w: number, h: number) {
  return new Rectangle<null>(null, x, y, w, h);
}

const PRECISION = 0.001;

// ---------------------------------------------------------------------------
// getAllPossiblePlacements
// ---------------------------------------------------------------------------

describe('getAllPossiblePlacements', () => {
  it('returns only bin.bottomLeft when there are no existing placements', () => {
    const bin = rect(0, 0, 100, 100);
    const points = getAllPossiblePlacements(bin, [], 0);

    expect(points).toHaveLength(1);
    expect(points[0]).toEqual(bin.bottomLeft);
  });

  it('returns 3 points for one existing placement', () => {
    const bin = rect(0, 0, 100, 100);
    const gap = 2;
    const placement = rect(0, 0, 30, 20);

    const points = getAllPossiblePlacements(bin, [placement], gap);

    expect(points).toHaveLength(3);

    // Point 0: bin.bottomLeft
    expect(points[0]).toEqual(bin.bottomLeft);

    // Point 1: placement.topLeft + (0, gap)  →  (0, 20 + 2) = (0, 22)
    expect(points[1].x).toBe(placement.topLeft.x);
    expect(points[1].y).toBe(placement.topLeft.y + gap);

    // Point 2: placement.bottomRight + (gap, 0)  →  (30 + 2, 0) = (32, 0)
    expect(points[2].x).toBe(placement.bottomRight.x + gap);
    expect(points[2].y).toBe(placement.bottomRight.y);
  });

  it('returns 5 points for two existing placements', () => {
    const bin = rect(0, 0, 100, 100);
    const p1 = rect(0, 0, 30, 20);
    const p2 = rect(40, 0, 20, 15);

    const points = getAllPossiblePlacements(bin, [p1, p2], 0);

    // 1 (bin.bottomLeft) + 2 topLeft offsets + 2 bottomRight offsets = 5
    expect(points).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// isValidPlacement
// ---------------------------------------------------------------------------

describe('isValidPlacement', () => {
  it('returns true when the rect is fully inside the bin with no existing placements', () => {
    const bin = rect(0, 0, 100, 100);
    const candidate = rect(10, 10, 30, 30);

    expect(isValidPlacement(bin, [], candidate, PRECISION)).toBe(true);
  });

  it('returns true when the rect is fully inside the bin with no overlapping placements', () => {
    const bin = rect(0, 0, 100, 100);
    const existing = rect(0, 0, 30, 30);
    const candidate = rect(40, 0, 30, 30);

    expect(isValidPlacement(bin, [existing], candidate, PRECISION)).toBe(true);
  });

  it('returns false when the rect is outside the bin', () => {
    const bin = rect(0, 0, 100, 100);
    // Candidate extends beyond the bin's right edge
    const candidate = rect(80, 0, 30, 30);

    expect(isValidPlacement(bin, [], candidate, PRECISION)).toBe(false);
  });

  it('returns false when the rect overlaps an existing placement', () => {
    const bin = rect(0, 0, 100, 100);
    const existing = rect(0, 0, 40, 40);
    // Overlaps with 'existing' in the region (20..40, 0..40)
    const candidate = rect(20, 0, 30, 30);

    expect(isValidPlacement(bin, [existing], candidate, PRECISION)).toBe(false);
  });

  it('returns true when the rect sits exactly at the bin edge (within precision)', () => {
    const bin = rect(0, 0, 100, 100);
    // Rect from (0,0) to (100,100) — coincident with bin edges
    const candidate = rect(0, 0, 100, 100);

    expect(isValidPlacement(bin, [], candidate, PRECISION)).toBe(true);
  });

  it('returns true when two rects share only a touching edge (not intersecting)', () => {
    const bin = rect(0, 0, 100, 100);
    // existing occupies (0,0)→(30,30); candidate starts right at x=30
    const existing = rect(0, 0, 30, 30);
    const candidate = rect(30, 0, 30, 30);

    // isIntersecting returns false for merely-touching rects, so this should be valid
    expect(isValidPlacement(bin, [existing], candidate, PRECISION)).toBe(true);
  });
});
