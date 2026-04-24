import { isNearlyEqual } from '../geometry';
import { createGenericPacker } from './GenericPacker';
import type { Packer } from './Packer';
import { getAllPossiblePlacements } from './utils';

export function createTightPacker<T>(): Packer<T> {
  return createGenericPacker({
    getPossiblePlacements: getAllPossiblePlacements,
    sortPlacements(a, b, options) {
      // sort bottom most first, leftmost second
      if (!isNearlyEqual(a.y, b.y, options.precision)) return a.y - b.y;
      return a.x - b.x;
    },
  });
}
