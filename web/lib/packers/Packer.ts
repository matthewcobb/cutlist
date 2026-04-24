import type { Rectangle } from '../geometry/Rectangle';

/**
 * Interface responsible for implementing the bin packing algorithm.
 */
export interface Packer<T> {
  pack(
    bin: Rectangle<unknown>,
    rects: Rectangle<T>[],
    options: PackOptions<T>,
  ): PackResult<T>;
  addToPack(
    res: PackResult<T>,
    bin: Rectangle<unknown>,
    rects: Rectangle<T>[],
    options: PackOptions<T>,
  ): void;
}

export interface PackOptions<T = unknown> {
  gap: number;
  precision: number;
  allowRotations: boolean;
  /** Optional per-rect override. When provided, a rect can only be rotated if both
   * `allowRotations` is true AND this function returns true for that rect's data. */
  canRotateRect?: (data: T) => boolean;
}

export interface PackResult<T> {
  /**
   * List of rectangles that fit, translated to their packed location.
   */
  placements: Rectangle<T>[];
  /**
   * Any rectangles that didn't fit are returned here. Their positions are left untouched.
   */
  leftovers: T[];
}
