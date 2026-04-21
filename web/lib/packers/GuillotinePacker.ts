import { Rectangle } from '../geometry';
import { isNearlyEqual } from '../utils/floating-point-utils';
import type { PackOptions, PackResult, Packer } from './Packer';

/**
 * Heuristic used to score candidate placements (which free rectangle to pick).
 * - `bssf` Best Short Side Fit: minimize the shorter leftover side.
 * - `baf`  Best Area Fit: minimize leftover area.
 * - `blsf` Best Long Side Fit: minimize the longer leftover side.
 */
export type GuillotineFitMode = 'bssf' | 'baf' | 'blsf';

/**
 * Heuristic used to choose the split axis after placing a rectangle.
 * - `sas` Shorter Axis Split: split along the shorter leftover side, keeping
 *   the longer leftover intact.
 * - `las` Longer Axis Split: opposite of `sas`.
 * - `min-area` Pick the split that produces the larger contiguous free
 *   rectangle (lower area on the smaller fragment).
 */
export type GuillotineSplitMode = 'sas' | 'las' | 'min-area';

interface FreeRect {
  left: number;
  bottom: number;
  width: number;
  height: number;
}

interface FitCandidate<T> {
  rect: Rectangle<T>;
  freeIndex: number;
  score: number;
  tieBreak: number;
}

/**
 * 2D bin packer using the Guillotine algorithm with explicit free-rectangle
 * tracking, configurable placement + split heuristics, and an optional
 * rectangle-merge pass to recover sliver fragments.
 *
 * Layouts produced by this packer are strictly guillotine-cuttable: every
 * placement boundary corresponds to an edge-to-edge cut of the remaining
 * stock, so they're safe for table/circular/track saws.
 *
 * Reference: J. Jylänki, "A Thousand Ways to Pack the Bin", and the rectpack
 * Python library by secnot.
 */
export function createGuillotinePacker<T>(
  config: {
    fitMode?: GuillotineFitMode;
    splitMode?: GuillotineSplitMode;
    rectMerge?: boolean;
  } = {},
): Packer<T> {
  const fitMode = config.fitMode ?? 'bssf';
  const splitMode = config.splitMode ?? 'sas';
  const rectMerge = config.rectMerge ?? true;

  return {
    pack(bin, rects, options) {
      const res: PackResult<T> = { placements: [], leftovers: [] };
      const freeRects: FreeRect[] = [
        {
          left: bin.left,
          bottom: bin.bottom,
          width: bin.width,
          height: bin.height,
        },
      ];

      for (const rect of rects) {
        const candidate = pickBestPlacement(rect, freeRects, options, fitMode);
        if (!candidate) {
          res.leftovers.push(rect.data);
          continue;
        }

        const free = freeRects[candidate.freeIndex];
        const placement = candidate.rect.clone({
          left: free.left,
          bottom: free.bottom,
        });
        res.placements.push(placement);

        // Split the chosen free rect into two new free rects (with kerf
        // applied between the placement and each remaining strip). The
        // remaining free rects are non-overlapping by construction, so no
        // additional pruning is required.
        const splits = splitFreeRect(free, placement, options, splitMode);
        freeRects.splice(candidate.freeIndex, 1, ...splits);

        if (rectMerge) {
          mergeFreeRects(freeRects, options.precision);
        }
      }

      return res;
    },
    addToPack() {
      throw Error('Not supported');
    },
  };
}

function pickBestPlacement<T>(
  rect: Rectangle<T>,
  freeRects: FreeRect[],
  options: PackOptions,
  fitMode: GuillotineFitMode,
): FitCandidate<T> | undefined {
  let best: FitCandidate<T> | undefined;

  for (let i = 0; i < freeRects.length; i++) {
    const free = freeRects[i];
    const canRotate =
      options.allowRotations &&
      (options.canRotateRect == null || options.canRotateRect(rect.data));
    const orientations = canRotate ? [rect, rect.flipOrientation()] : [rect];

    for (const candidateRect of orientations) {
      if (
        candidateRect.width > free.width + options.precision ||
        candidateRect.height > free.height + options.precision
      ) {
        continue;
      }

      const leftoverW = free.width - candidateRect.width;
      const leftoverH = free.height - candidateRect.height;
      const score = scoreFit(fitMode, leftoverW, leftoverH, candidateRect);
      // Prefer placements toward the bottom-left of the bin when scores tie,
      // so output is deterministic and visually predictable.
      const tieBreak = free.bottom * 1e6 + free.left;

      if (
        best == null ||
        score < best.score - options.precision ||
        (Math.abs(score - best.score) <= options.precision &&
          tieBreak < best.tieBreak)
      ) {
        best = { rect: candidateRect, freeIndex: i, score, tieBreak };
      }
    }
  }

  return best;
}

function scoreFit<T>(
  mode: GuillotineFitMode,
  leftoverW: number,
  leftoverH: number,
  rect: Rectangle<T>,
): number {
  if (mode === 'bssf') return Math.min(leftoverW, leftoverH);
  if (mode === 'blsf') return Math.max(leftoverW, leftoverH);
  // baf: leftover area = freeArea - rectArea, expanded in terms of the
  // leftover dims so we don't need the free rect here.
  return (
    leftoverW * leftoverH + leftoverW * rect.height + leftoverH * rect.width
  );
}

function splitFreeRect<T>(
  free: FreeRect,
  placement: Rectangle<T>,
  options: PackOptions,
  splitMode: GuillotineSplitMode,
): FreeRect[] {
  const leftoverW = free.width - placement.width;
  const leftoverH = free.height - placement.height;
  const splitHorizontal = chooseSplitAxis(
    splitMode,
    leftoverW,
    leftoverH,
    placement,
    free,
  );

  // Horizontal cut: bottom strip is the placement's row (full free width
  // minus the placement); the top strip spans the full free width.
  // Vertical cut: left strip is the placement's column; right strip spans
  // the full free height.
  const splits: FreeRect[] = [];

  if (splitHorizontal) {
    // Right of placement, same height as placement.
    const rightWidth = leftoverW - options.gap;
    if (rightWidth > options.precision) {
      splits.push({
        left: free.left + placement.width + options.gap,
        bottom: free.bottom,
        width: rightWidth,
        height: placement.height,
      });
    }
    // Above placement, full free width.
    const topHeight = leftoverH - options.gap;
    if (topHeight > options.precision) {
      splits.push({
        left: free.left,
        bottom: free.bottom + placement.height + options.gap,
        width: free.width,
        height: topHeight,
      });
    }
  } else {
    // Above placement, same width as placement.
    const topHeight = leftoverH - options.gap;
    if (topHeight > options.precision) {
      splits.push({
        left: free.left,
        bottom: free.bottom + placement.height + options.gap,
        width: placement.width,
        height: topHeight,
      });
    }
    // Right of placement, full free height.
    const rightWidth = leftoverW - options.gap;
    if (rightWidth > options.precision) {
      splits.push({
        left: free.left + placement.width + options.gap,
        bottom: free.bottom,
        width: rightWidth,
        height: free.height,
      });
    }
  }

  return splits;
}

function chooseSplitAxis<T>(
  mode: GuillotineSplitMode,
  leftoverW: number,
  leftoverH: number,
  placement: Rectangle<T>,
  free: FreeRect,
): boolean {
  // Returns true for horizontal split, false for vertical.
  if (mode === 'sas') {
    // Shorter Axis Split: split along the SHORTER leftover, keeping the
    // longer leftover intact. If width-leftover is smaller, the bigger
    // leftover is in the height direction → preserve it by splitting
    // horizontally (top strip gets full width).
    return leftoverW <= leftoverH;
  }
  if (mode === 'las') {
    return leftoverW > leftoverH;
  }
  // min-area: pick the split whose two fragments are most uneven (one big,
  // one small) — equivalently, the split where the smaller-area fragment is
  // smallest.
  const horizontalSmall = Math.min(
    leftoverW * placement.height,
    free.width * leftoverH,
  );
  const verticalSmall = Math.min(
    leftoverW * free.height,
    placement.width * leftoverH,
  );
  return horizontalSmall <= verticalSmall;
}

function mergeFreeRects(freeRects: FreeRect[], precision: number): void {
  // Merge pairs of free rects that share a full edge — recovers contiguous
  // space that was unnecessarily fragmented by an earlier split. Iterate
  // until stable; merges typically converge in 1–2 passes.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < freeRects.length; i++) {
      const a = freeRects[i];
      for (let j = i + 1; j < freeRects.length; j++) {
        const b = freeRects[j];

        // Same vertical band, stacked vertically.
        if (
          isNearlyEqual(a.left, b.left, precision) &&
          isNearlyEqual(a.width, b.width, precision)
        ) {
          if (isNearlyEqual(a.bottom + a.height, b.bottom, precision)) {
            a.height += b.height;
            freeRects.splice(j, 1);
            merged = true;
            break outer;
          }
          if (isNearlyEqual(b.bottom + b.height, a.bottom, precision)) {
            a.bottom = b.bottom;
            a.height += b.height;
            freeRects.splice(j, 1);
            merged = true;
            break outer;
          }
        }

        // Same horizontal band, stacked horizontally.
        if (
          isNearlyEqual(a.bottom, b.bottom, precision) &&
          isNearlyEqual(a.height, b.height, precision)
        ) {
          if (isNearlyEqual(a.left + a.width, b.left, precision)) {
            a.width += b.width;
            freeRects.splice(j, 1);
            merged = true;
            break outer;
          }
          if (isNearlyEqual(b.left + b.width, a.left, precision)) {
            a.left = b.left;
            a.width += b.width;
            freeRects.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
  }
}
