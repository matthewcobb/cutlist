import type { Point, Rectangle } from '../geometry';
import type { PackOptions, PackResult, Packer } from './Packer';
import { isValidPlacement } from './utils';

export function createGenericPacker<T>({
  sortPlacements,
  getPossiblePlacements,
}: {
  sortPlacements?: (a: Point, b: Point, options: PackOptions) => number;
  getPossiblePlacements: (
    bin: Rectangle<unknown>,
    placements: Rectangle<T>[],
    gap: number,
  ) => Point[];
}): Packer<T> {
  return {
    pack(bin, rects, options) {
      const res: PackResult<T> = {
        leftovers: [],
        placements: [],
      };
      this.addToPack(res, bin, rects, options);
      return res;
    },
    addToPack(res, bin, rects, options) {
      return rects.reduce<PackResult<T>>((res, rect) => {
        const possiblePoints = getPossiblePlacements(
          bin,
          res.placements,
          options.gap,
        );
        if (sortPlacements)
          possiblePoints.sort((a, b) => sortPlacements(a, b, options));
        const possiblePlacements = possiblePoints.flatMap((point) => {
          const moved = rect.moveTo(point);
          const canRotate =
            options.allowRotations &&
            (options.canRotateRect == null ||
              options.canRotateRect(moved.data));
          if (canRotate) {
            return [moved, moved.flipOrientation()];
          }
          return [moved];
        });

        const validPlacements = possiblePlacements.filter((placement) =>
          isValidPlacement(bin, res.placements, placement, options.precision),
        );
        if (validPlacements.length > 0) {
          res.placements.push(validPlacements[0]);
        } else {
          res.leftovers.push(rect.data);
        }
        return res;
      }, res);
    },
  };
}
