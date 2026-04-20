import type { PotentialBoardLayout } from '../types';

export interface LayoutScore {
  boardsUsed: number;
  wasteArea: number;
  cutComplexity: number;
}

export function compareLayoutScores(
  a: LayoutScore,
  b: LayoutScore,
  precision: number,
): number {
  if (Math.abs(a.boardsUsed - b.boardsUsed) > precision)
    return a.boardsUsed - b.boardsUsed;
  if (Math.abs(a.wasteArea - b.wasteArea) > precision)
    return a.wasteArea - b.wasteArea;
  if (Math.abs(a.cutComplexity - b.cutComplexity) > precision)
    return a.cutComplexity - b.cutComplexity;
  return 0;
}

export function scoreLayouts(
  layouts: PotentialBoardLayout[],
  precision: number,
): LayoutScore {
  const boardsUsed = layouts.length;
  let wasteArea = 0;
  let cutComplexity = 0;

  for (const layout of layouts) {
    const boardArea = layout.stock.width * layout.stock.length;
    const usedArea = layout.placements.reduce(
      (total, placement) => total + placement.width * placement.height,
      0,
    );
    wasteArea += Math.max(0, boardArea - usedArea);

    const xLevels: number[] = [];
    const yLevels: number[] = [];
    for (const placement of layout.placements) {
      xLevels.push(placement.left, placement.right);
      yLevels.push(placement.bottom, placement.top);
    }
    cutComplexity +=
      countUniqueLevels(xLevels, precision) +
      countUniqueLevels(yLevels, precision);
  }

  return {
    boardsUsed,
    wasteArea,
    cutComplexity,
  };
}

function countUniqueLevels(values: number[], precision: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 1;
  let last = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i];
    if (Math.abs(value - last) > precision) {
      count++;
      last = value;
    }
  }
  return count;
}
