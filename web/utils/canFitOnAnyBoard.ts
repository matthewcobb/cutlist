import type { Stock } from 'cutlist';
import type { GrainLock } from '~/utils/grain';

/**
 * Check whether a part with the given dimensions and proposed grain lock
 * can fit on at least one matching stock board (same material + ~thickness),
 * accounting for margin on each side of the board.
 */
export function canFitOnAnyBoard(
  part: {
    material: string;
    thicknessM: number;
    widthM: number;
    lengthM: number;
  },
  grainLock: GrainLock,
  boards: Stock[],
  marginM: number,
): boolean {
  const matching = boards.filter(
    (b) =>
      b.material === part.material &&
      Math.abs(b.thickness - part.thicknessM) < 1e-4,
  );
  if (matching.length === 0) return false;

  const inset = marginM * 2;

  for (const board of matching) {
    const usableW = board.width - inset;
    const usableL = board.length - inset;
    if (usableW <= 0 || usableL <= 0) continue;

    if (grainLock) {
      const partW = grainLock === 'width' ? part.lengthM : part.widthM;
      const partL = grainLock === 'width' ? part.widthM : part.lengthM;
      if (partW <= usableW && partL <= usableL) return true;
    } else {
      if (
        (part.widthM <= usableW && part.lengthM <= usableL) ||
        (part.lengthM <= usableW && part.widthM <= usableL)
      )
        return true;
    }
  }
  return false;
}
