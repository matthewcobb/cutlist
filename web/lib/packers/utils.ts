import type { Point, Rectangle } from '../geometry';

export function getAllPossiblePlacements<T>(
  bin: Rectangle<unknown>,
  placements: Rectangle<T>[],
  gap: number,
): Point[] {
  return [
    bin.bottomLeft,
    ...placements.map((rect) => rect.topLeft.add(0, gap)),
    ...placements.map((rect) => rect.bottomRight.add(gap, 0)),
  ];
}

export function isValidPlacement<T>(
  bin: Rectangle<unknown>,
  placements: Rectangle<T>[],
  rect: Rectangle<T>,
  precision: number,
  gap: number = 0,
): boolean {
  return (
    rect.isInside(bin, precision) &&
    placements.every((p) => {
      const padded =
        gap > 0 ? p.pad({ left: gap, right: gap, top: gap, bottom: gap }) : p;
      return !rect.isIntersecting(padded, precision);
    })
  );
}
