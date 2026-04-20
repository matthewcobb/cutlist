import { Rectangle } from '../geometry';
import type { Visualizer } from '../visualizers';
import type { PackOptions, PackResult, Packer } from './Packer';

/**
 * How to choose shelf height when opening a new shelf.
 * - `first-fit`: Shelf height = height of the first part placed on it.
 * - `best-width-fit`: Among parts that haven't been placed yet, pick the one
 *   whose height (as shelf height) would leave the least wasted width across
 *   all remaining parts that share that height.
 */
export type ShelfHeightMode = 'first-fit' | 'best-width-fit';

/**
 * 2D bin packer that arranges parts into horizontal shelves (rows).
 *
 * Each shelf is a horizontal band spanning the full bin width. Parts are placed
 * left-to-right within a shelf, and shelves stack bottom-to-top. The shelf
 * height is determined by the tallest part on that shelf.
 *
 * This produces layouts that are trivially guillotine-cuttable:
 *   1. One horizontal cut per shelf boundary (full-width).
 *   2. Vertical cuts within each shelf to separate parts.
 *
 * This is the easiest pattern to execute with a table/track/circular saw.
 */
export function createShelfPacker<T>(
  visualizer?: Visualizer,
  config: {
    shelfHeightMode?: ShelfHeightMode;
  } = {},
): Packer<T> {
  const shelfHeightMode = config.shelfHeightMode ?? 'first-fit';

  return {
    pack(bin, rects, options) {
      const res: PackResult<T> = { placements: [], leftovers: [] };
      const shelves: Shelf[] = [];
      const remaining = [...rects];

      while (remaining.length > 0) {
        const rect = remaining.shift()!;
        visualizer?.render('start', { res, bin, toPlace: rect });

        const placed = placeOnExistingShelf(rect, shelves, bin, options, res);
        if (placed) {
          visualizer?.render('placed', { res, bin });
          continue;
        }

        // Open a new shelf
        const shelfBottom = getNextShelfBottom(shelves, options);
        const oriented = chooseBestOrientation(rect, bin, shelfBottom, options);
        if (!oriented) {
          res.leftovers.push(rect.data);
          continue;
        }

        const shelfHeight = oriented.height;
        // Check shelf fits vertically
        if (
          shelfBottom + shelfHeight >
          bin.bottom + bin.height + options.precision
        ) {
          res.leftovers.push(rect.data);
          continue;
        }

        const shelf: Shelf = {
          bottom: shelfBottom,
          height: shelfHeight,
          usedWidth: 0,
        };
        shelves.push(shelf);

        const placement = oriented.clone({
          left: bin.left + shelf.usedWidth,
          bottom: shelf.bottom,
        });
        res.placements.push(placement);
        shelf.usedWidth += placement.width + options.gap;

        visualizer?.render('placed', { res, bin });

        // Try to fill the rest of this shelf from remaining parts
        fillShelf(shelf, remaining, bin, options, res, visualizer);
      }

      return res;
    },
    addToPack() {
      throw Error('Not supported');
    },
  };
}

interface Shelf {
  bottom: number;
  height: number;
  usedWidth: number;
}

function getNextShelfBottom(shelves: Shelf[], options: PackOptions): number {
  if (shelves.length === 0) return 0;
  const last = shelves[shelves.length - 1];
  return last.bottom + last.height + options.gap;
}

/**
 * Try to place a rect on an existing shelf. Returns true if placed.
 */
function placeOnExistingShelf<T>(
  rect: Rectangle<T>,
  shelves: Shelf[],
  bin: Rectangle<unknown>,
  options: PackOptions,
  res: PackResult<T>,
): boolean {
  // Try each shelf, prefer the one with least remaining width (best fit)
  let bestShelf: Shelf | undefined;
  let bestOriented: Rectangle<T> | undefined;
  let bestRemainingWidth = Infinity;

  for (const shelf of shelves) {
    const oriented = fitOnShelf(rect, shelf, bin, options);
    if (!oriented) continue;

    const remainingWidth = bin.width - shelf.usedWidth - oriented.width;
    if (remainingWidth < bestRemainingWidth) {
      bestRemainingWidth = remainingWidth;
      bestShelf = shelf;
      bestOriented = oriented;
    }
  }

  if (bestShelf && bestOriented) {
    const placement = bestOriented.clone({
      left: bin.left + bestShelf.usedWidth,
      bottom: bestShelf.bottom,
    });
    res.placements.push(placement);
    bestShelf.usedWidth += placement.width + options.gap;
    return true;
  }

  return false;
}

/**
 * Check if rect fits on a shelf (respecting height and remaining width).
 * Returns the correctly oriented rect, or undefined if it doesn't fit.
 */
function fitOnShelf<T>(
  rect: Rectangle<T>,
  shelf: Shelf,
  bin: Rectangle<unknown>,
  options: PackOptions,
): Rectangle<T> | undefined {
  const availableWidth = bin.width - shelf.usedWidth;
  const orientations = options.allowRotations
    ? [rect, rect.flipOrientation()]
    : [rect];

  let best: Rectangle<T> | undefined;
  let bestWaste = Infinity;

  for (const oriented of orientations) {
    if (
      oriented.width <= availableWidth + options.precision &&
      oriented.height <= shelf.height + options.precision
    ) {
      // Prefer orientation that wastes less shelf height
      const waste = shelf.height - oriented.height;
      if (waste < bestWaste) {
        bestWaste = waste;
        best = oriented;
      }
    }
  }

  return best;
}

/**
 * Choose the best orientation for a rect that will define a new shelf height.
 * Prefer the orientation whose height is smaller (shorter shelf = more shelves
 * = more parts fit).
 */
function chooseBestOrientation<T>(
  rect: Rectangle<T>,
  bin: Rectangle<unknown>,
  shelfBottom: number,
  options: PackOptions,
): Rectangle<T> | undefined {
  const availableHeight = bin.bottom + bin.height - shelfBottom;
  const orientations = options.allowRotations
    ? [rect, rect.flipOrientation()]
    : [rect];

  const fitting = orientations.filter(
    (o) =>
      o.width <= bin.width + options.precision &&
      o.height <= availableHeight + options.precision,
  );

  if (fitting.length === 0) return undefined;

  // Pick orientation with smaller height to minimize shelf waste
  return fitting.sort((a, b) => a.height - b.height)[0];
}

/**
 * After opening a new shelf, scan remaining parts and greedily fill
 * the shelf left-to-right. Removes placed parts from the remaining array.
 */
function fillShelf<T>(
  shelf: Shelf,
  remaining: Rectangle<T>[],
  bin: Rectangle<unknown>,
  options: PackOptions,
  res: PackResult<T>,
  visualizer?: Visualizer,
): void {
  let i = 0;
  while (i < remaining.length) {
    const rect = remaining[i];
    const oriented = fitOnShelf(rect, shelf, bin, options);
    if (oriented) {
      const placement = oriented.clone({
        left: bin.left + shelf.usedWidth,
        bottom: shelf.bottom,
      });
      res.placements.push(placement);
      shelf.usedWidth += placement.width + options.gap;
      remaining.splice(i, 1);
      visualizer?.render('placed', { res, bin });
    } else {
      i++;
    }
  }
}
