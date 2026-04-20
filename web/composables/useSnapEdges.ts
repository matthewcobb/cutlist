import type { BoardLayout } from 'cutlist';
import type { SnapEdge } from './useRulerStore';

export default function (
  layout: MaybeRefOrGetter<BoardLayout>,
  boardIndex: MaybeRefOrGetter<number>,
) {
  return computed<SnapEdge[]>(() => {
    const l = toValue(layout);
    const idx = toValue(boardIndex);
    const edges: SnapEdge[] = [];

    // Board edges
    edges.push({ axis: 'x', positionM: 0, boardIndex: idx });
    edges.push({ axis: 'x', positionM: l.stock.widthM, boardIndex: idx });
    edges.push({ axis: 'y', positionM: 0, boardIndex: idx });
    edges.push({ axis: 'y', positionM: l.stock.lengthM, boardIndex: idx });

    // Part edges
    for (const p of l.placements) {
      edges.push({ axis: 'x', positionM: p.leftM, boardIndex: idx });
      edges.push({
        axis: 'x',
        positionM: p.leftM + p.widthM,
        boardIndex: idx,
      });
      edges.push({ axis: 'y', positionM: p.bottomM, boardIndex: idx });
      edges.push({
        axis: 'y',
        positionM: p.bottomM + p.lengthM,
        boardIndex: idx,
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    return edges.filter((e) => {
      const key = `${e.axis}:${e.positionM.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}
