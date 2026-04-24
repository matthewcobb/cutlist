import { Rectangle } from '../geometry';
import type { PackOptions, PackResult, Packer } from './Packer';

/**
 * Whether strips run horizontally (rip cuts across height, crosscuts along
 * width) or vertically (rip cuts across width, crosscuts along height).
 */
export type StripOrientation = 'horizontal' | 'vertical';

/**
 * How aggressively to group parts into shared strips.
 * - `'exact'`: only parts whose cross-dimension matches within `precision`
 *   share a strip.
 * - `'kerf'`: parts whose cross-dimension differs by at most one blade kerf
 *   (`options.gap`) share a strip, with the strip height set to the group max.
 */
export type StripGroupingTolerance = 'exact' | 'kerf';

interface OrientedRect<T> {
  rect: Rectangle<T>;
  /** Dimension perpendicular to strip direction (strip "height"). */
  crossDim: number;
  /** Dimension along strip direction (how much strip length it consumes). */
  alongDim: number;
}

interface Strip<T> {
  /** Cross-dimension of this strip (set by the tallest part in the group). */
  crossDim: number;
  /** Consumed length along the strip (sum of parts + gaps). */
  usedAlong: number;
  /** Parts placed in this strip, in order. */
  parts: OrientedRect<T>[];
}

/**
 * 2D bin packer using strip decomposition (2-stage guillotine cutting).
 *
 * Instead of placing parts one at a time into free rectangles, this packer:
 *   1. Groups parts by compatible cross-dimension
 *   2. Fills strips via 1D First Fit Decreasing
 *   3. Stacks strips onto the sheet via 1D FFD
 *
 * This naturally groups similar-dimension parts together, aligns cuts, and
 * produces an obvious cut sequence: rip cuts between strips, crosscuts within.
 *
 * Every layout is strictly 2-stage guillotine-cuttable.
 */
export function createStripPacker<T>(
  config: {
    orientation?: StripOrientation;
    groupingTolerance?: StripGroupingTolerance;
  } = {},
): Packer<T> {
  const orientation = config.orientation ?? 'horizontal';
  const groupingTolerance = config.groupingTolerance ?? 'exact';

  return {
    pack(bin, rects, options) {
      const res: PackResult<T> = { placements: [], leftovers: [] };
      if (rects.length === 0) return res;

      const tolerance =
        groupingTolerance === 'kerf' ? options.gap : options.precision;
      const binAlongDim = orientation === 'horizontal' ? bin.width : bin.height;
      const binCrossDim = orientation === 'horizontal' ? bin.height : bin.width;

      // Step 1: Orient each rect to minimize strip cross-dimension
      const oriented: OrientedRect<T>[] = [];
      for (const rect of rects) {
        const o = orientRect(
          rect,
          orientation,
          options,
          binAlongDim,
          binCrossDim,
        );
        if (o == null) {
          res.leftovers.push(rect.data);
          continue;
        }
        oriented.push(o);
      }

      // Step 2: Sort by crossDim descending, then alongDim descending
      oriented.sort(
        (a, b) => b.crossDim - a.crossDim || b.alongDim - a.alongDim,
      );

      // Step 3: Group by compatible cross-dimension
      const groups: { crossDim: number; parts: OrientedRect<T>[] }[] = [];
      for (const item of oriented) {
        const last = groups[groups.length - 1];
        if (
          last != null &&
          last.crossDim - item.crossDim <= tolerance + options.precision
        ) {
          last.parts.push(item);
        } else {
          groups.push({ crossDim: item.crossDim, parts: [item] });
        }
      }

      // Step 4: Fill strips within each group (1D FFD along bin width/height)
      const strips: Strip<T>[] = [];
      for (const group of groups) {
        // Parts are already sorted by crossDim desc globally; within a group
        // crossDim is ~equal, so re-sort by alongDim desc for FFD.
        group.parts.sort((a, b) => b.alongDim - a.alongDim);

        for (const item of group.parts) {
          let placed = false;
          // Try existing strips in this group (find first fit)
          for (const strip of strips) {
            // Only try strips from this group (same crossDim)
            if (Math.abs(strip.crossDim - group.crossDim) > options.precision) {
              continue;
            }
            const neededAlong =
              (strip.parts.length > 0 ? options.gap : 0) + item.alongDim;
            if (
              strip.usedAlong + neededAlong <=
              binAlongDim + options.precision
            ) {
              strip.usedAlong += neededAlong;
              strip.parts.push(item);
              placed = true;
              break;
            }
          }
          if (!placed) {
            strips.push({
              crossDim: group.crossDim,
              usedAlong: item.alongDim,
              parts: [item],
            });
          }
        }
      }

      // Step 5: Sort strips by crossDim descending (FFD for stacking)
      strips.sort((a, b) => b.crossDim - a.crossDim);

      // Step 6: Stack strips onto the bin (1D FFD along cross-dimension)
      let usedCross = 0;
      const placedStrips: { strip: Strip<T>; crossOffset: number }[] = [];

      for (const strip of strips) {
        const gap = placedStrips.length > 0 ? options.gap : 0;
        const needed = gap + strip.crossDim;
        if (usedCross + needed <= binCrossDim + options.precision) {
          const crossOffset = usedCross + gap;
          placedStrips.push({ strip, crossOffset });
          usedCross = crossOffset + strip.crossDim;
        } else {
          // Strip doesn't fit — all its parts become leftovers
          for (const item of strip.parts) {
            res.leftovers.push(item.rect.data);
          }
        }
      }

      // Step 7: Compute final placements
      for (const { strip, crossOffset } of placedStrips) {
        let alongOffset = 0;
        for (let i = 0; i < strip.parts.length; i++) {
          const item = strip.parts[i];
          if (i > 0) alongOffset += options.gap;

          const left =
            orientation === 'horizontal'
              ? bin.left + alongOffset
              : bin.left + crossOffset;
          const bottom =
            orientation === 'horizontal'
              ? bin.bottom + crossOffset
              : bin.bottom + alongOffset;

          const placement = item.rect.clone({ left, bottom });
          res.placements.push(placement);
          alongOffset += item.alongDim;
        }
      }

      return res;
    },
    addToPack() {
      throw Error('Not supported');
    },
  };
}

/**
 * Orient a rectangle to minimize its cross-dimension for the given strip
 * orientation. Only considers orientations that fit within the bin. Returns
 * undefined if neither orientation fits. Respects rotation constraints.
 */
function orientRect<T>(
  rect: Rectangle<T>,
  orientation: StripOrientation,
  options: PackOptions<T>,
  binAlongDim: number,
  binCrossDim: number,
): OrientedRect<T> | undefined {
  const canRotate =
    options.allowRotations &&
    (options.canRotateRect == null || options.canRotateRect(rect.data));

  const toOriented = (r: Rectangle<T>): OrientedRect<T> & { fits: boolean } => {
    const crossDim = orientation === 'horizontal' ? r.height : r.width;
    const alongDim = orientation === 'horizontal' ? r.width : r.height;
    const fits =
      alongDim <= binAlongDim + options.precision &&
      crossDim <= binCrossDim + options.precision;
    return { rect: r, crossDim, alongDim, fits };
  };

  const normal = toOriented(rect);
  const rotated = canRotate ? toOriented(rect.flipOrientation()) : undefined;

  // Pick the fitting orientation with the smallest cross-dimension
  if (normal.fits && rotated?.fits) {
    return rotated.crossDim < normal.crossDim - options.precision
      ? rotated
      : normal;
  }
  if (normal.fits) return normal;
  if (rotated?.fits) return rotated;
  return undefined;
}
