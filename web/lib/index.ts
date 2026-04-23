import {
  type PartToCut,
  type Stock,
  type StockMatrix,
  Config,
  type ConfigInput,
  type BoardLayout,
  type BoardLayoutLeftover,
  type BoardLayoutPlacement,
  type PotentialBoardLayout,
  type SearchPass,
} from './types';

import { Rectangle } from './geometry';
import { isNearlyEqual } from './utils/floating-point-utils';
import { isValidStock } from './utils/stock-utils';
import { Distance } from './utils/units';
import {
  compareLayoutScores,
  createGuillotinePacker,
  createShelfPacker,
  createTightPacker,
  scoreLayouts,
  type GuillotineFitMode,
  type LayoutScore,
  type PackOptions,
  type Packer,
} from './packers';

export * from './types';
export * from './utils/units';

type OptimizeMode = Exclude<Config['optimize'], 'auto'>;
type PackerKind = 'shelf' | 'guillotine' | 'tight';
type PartSortMode =
  | 'area-desc'
  | 'long-side-desc'
  | 'short-side-desc'
  | 'perimeter-desc'
  | 'area-random';

interface SearchPassDefinition {
  id: SearchPass;
  optimize: OptimizeMode;
  packerKind: PackerKind;
  partSortMode: PartSortMode;
  guillotineFitMode?: GuillotineFitMode;
  randomSeed?: number;
}

interface SearchPassResult {
  layouts: PotentialBoardLayout[];
  leftovers: PartToCut[];
  score: LayoutScore;
}

const SEARCH_PASS_DEFINITIONS: Record<SearchPass, SearchPassDefinition> = {
  // Shelf passes — simple horizontal rows, easiest to hand-cut
  'cuts-shelf-area': {
    id: 'cuts-shelf-area',
    optimize: 'cuts',
    packerKind: 'shelf',
    partSortMode: 'area-desc',
  },
  'cuts-shelf-long-side': {
    id: 'cuts-shelf-long-side',
    optimize: 'cuts',
    packerKind: 'shelf',
    partSortMode: 'long-side-desc',
  },
  'cuts-shelf-short-side': {
    id: 'cuts-shelf-short-side',
    optimize: 'cuts',
    packerKind: 'shelf',
    partSortMode: 'short-side-desc',
  },
  // Guillotine passes — strictly guillotine-valid, better waste efficiency
  'cuts-guillotine-bssf-area': {
    id: 'cuts-guillotine-bssf-area',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'area-desc',
    guillotineFitMode: 'bssf',
  },
  'cuts-guillotine-bssf-long-side': {
    id: 'cuts-guillotine-bssf-long-side',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'long-side-desc',
    guillotineFitMode: 'bssf',
  },
  'cuts-guillotine-bssf-short-side': {
    id: 'cuts-guillotine-bssf-short-side',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'short-side-desc',
    guillotineFitMode: 'bssf',
  },
  'cuts-guillotine-baf-area': {
    id: 'cuts-guillotine-baf-area',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'area-desc',
    guillotineFitMode: 'baf',
  },
  'cuts-guillotine-baf-long-side': {
    id: 'cuts-guillotine-baf-long-side',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'long-side-desc',
    guillotineFitMode: 'baf',
  },
  'cuts-guillotine-blsf-long-side': {
    id: 'cuts-guillotine-blsf-long-side',
    optimize: 'cuts',
    packerKind: 'guillotine',
    partSortMode: 'long-side-desc',
    guillotineFitMode: 'blsf',
  },
  // CNC / tight passes — no cutting constraints
  'cnc-area': {
    id: 'cnc-area',
    optimize: 'cnc',
    packerKind: 'tight',
    partSortMode: 'area-desc',
  },
  'cnc-perimeter': {
    id: 'cnc-perimeter',
    optimize: 'cnc',
    packerKind: 'tight',
    partSortMode: 'perimeter-desc',
  },
  'cnc-random-a': {
    id: 'cnc-random-a',
    optimize: 'cnc',
    packerKind: 'tight',
    partSortMode: 'area-random',
    randomSeed: 17,
  },
  'cnc-random-b': {
    id: 'cnc-random-b',
    optimize: 'cnc',
    packerKind: 'tight',
    partSortMode: 'area-random',
    randomSeed: 101,
  },
  'cnc-random-c': {
    id: 'cnc-random-c',
    optimize: 'cnc',
    packerKind: 'tight',
    partSortMode: 'area-random',
    randomSeed: 2027,
  },
};

const DEFAULT_SEARCH_PASSES: SearchPass[] = [
  // Shelf passes first — best for hand-cutting
  'cuts-shelf-long-side',
  'cuts-shelf-area',
  'cuts-shelf-short-side',
  // Guillotine passes — may win on waste
  'cuts-guillotine-bssf-long-side',
  'cuts-guillotine-bssf-area',
  'cuts-guillotine-baf-area',
  'cuts-guillotine-baf-long-side',
  'cuts-guillotine-blsf-long-side',
  // CNC passes
  'cnc-area',
  'cnc-perimeter',
  'cnc-random-a',
  'cnc-random-b',
  'cnc-random-c',
];

/**
 * Given a list of parts, stock, and some configuration, return the board
 * layouts (where each part goes on stock) and all the leftover parts that
 * couldn't be placed.
 *
 * General order of operations:
 * 1. Load parts that need to be placed
 * 2. Fill stock with parts until no more parts can be placed
 * 3. Try and reduce the size of final boards to minimize material usage
 *
 * The second step, filling the stock, is not simple. There's a few
 * implementations:
 * - Optimize for cnc - A greedy algorithm that packs parts as tightly as
 *   possible. Layouts may require non-guillotine cuts (plunge/jigsaw), so this
 *   is best for CNC routers and other tools that can cut anywhere on a sheet.
 * - Optimize for cuts - A variant of the [Guillotine cutting algorithm](https://en.wikipedia.org/wiki/Guillotine_cutting)
 *   that generates strictly edge-to-edge part placements that are easy to cut
 *   out with a table/circular/track saw.
 * - Optimize for auto - Run multiple deterministic passes and keep the best
 *   score by board count, then waste, then cut complexity.
 */
export function generateBoardLayouts(
  parts: PartToCut[],
  stock: StockMatrix[],
  config: ConfigInput,
): {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
} {
  const normalizedConfig = Config.parse(config);

  const boards = reduceStockMatrix(stock).toSorted(
    (a, b) => b.width * b.length - a.width * a.length,
  );
  if (boards.length === 0) throw Error('You must include at least 1 stock.');

  const searchResult =
    normalizedConfig.optimize === 'auto'
      ? runMultiPassSearch(normalizedConfig, parts, boards)
      : runSearchPass(
          normalizedConfig,
          parts,
          boards,
          getSingleModePass(normalizedConfig.optimize),
        );

  const marginM = new Distance(normalizedConfig.margin).m;
  return {
    layouts: searchResult.layouts.map((l) =>
      serializeBoardLayoutRectangles(l, marginM),
    ),
    leftovers: searchResult.leftovers.map(serializePartToCut),
  };
}

/**
 * Convert a dimension to meters. String dimensions carry their own unit;
 * plain numbers use the material's `unit` field.
 */
function dimToMeters(dim: number | string, unit: 'mm' | 'in'): number {
  if (typeof dim === 'string') return new Distance(dim).m;
  return new Distance(dim + unit).m;
}

/**
 * Given a stock matrix, reduce it down to the individual boards available.
 */
export function reduceStockMatrix(matrix: StockMatrix[]): Stock[] {
  return matrix.flatMap((item) => {
    const unit = item.unit ?? 'mm';
    return item.sizes.flatMap((size) =>
      size.thickness.map((thickness) => ({
        ...item,
        thickness: dimToMeters(thickness, unit),
        width: dimToMeters(size.width, unit),
        length: dimToMeters(size.length, unit),
      })),
    );
  });
}

export const PACKERS: Record<
  PackerKind,
  (pass?: SearchPassDefinition) => Packer<PartToCut>
> = {
  shelf: () => createShelfPacker<PartToCut>(),
  guillotine: (pass?: SearchPassDefinition) =>
    createGuillotinePacker<PartToCut>({
      fitMode: pass?.guillotineFitMode ?? 'bssf',
      splitMode: 'sas',
      rectMerge: true,
    }),
  tight: () => createTightPacker<PartToCut>(),
};

function runMultiPassSearch(
  config: Config,
  parts: PartToCut[],
  stock: Stock[],
): SearchPassResult {
  const passOrder =
    config.searchPasses == null || config.searchPasses.length === 0
      ? DEFAULT_SEARCH_PASSES
      : config.searchPasses;

  // Run the tournament per stock group (material + thickness) so that changing
  // one group's constraints (e.g. grain lock) can't cause a different search
  // pass to win globally and alter layouts for unrelated groups.
  const groups = groupPartsByStock(parts, stock, config.precision);
  const allLayouts: PotentialBoardLayout[] = [];
  const allLeftovers: PartToCut[] = [];

  for (const group of groups) {
    let best: SearchPassResult | undefined;
    const startedAt = Date.now();

    for (let i = 0; i < passOrder.length; i++) {
      if (i > 0 && Date.now() - startedAt >= config.maxSearchMs) break;

      const pass = SEARCH_PASS_DEFINITIONS[passOrder[i]];
      const candidate = runSearchPass(config, group.parts, group.stock, pass);

      if (
        best == null ||
        isBetterSearchResult(candidate, best, config.precision)
      ) {
        best = candidate;
      }
    }

    if (best != null) {
      allLayouts.push(...best.layouts);
      allLeftovers.push(...best.leftovers);
    }
  }

  return {
    layouts: allLayouts,
    leftovers: allLeftovers,
    score: scoreLayouts(allLayouts, config.precision),
  };
}

function runSearchPass(
  config: Config,
  parts: PartToCut[],
  stock: Stock[],
  pass: SearchPassDefinition,
): SearchPassResult {
  const packer = PACKERS[pass.packerKind](pass);
  const packerOptions = getPackerOptions(config);

  const { layouts, leftovers } = placeAllParts(config, parts, stock, packer, {
    partSortMode: pass.partSortMode,
    randomSeed: pass.randomSeed,
    packerOptions,
  });
  const minimizedLayouts = layouts.map((layout) =>
    minimizeLayoutStock(config, layout, stock, packer, packerOptions),
  );

  return {
    layouts: minimizedLayouts,
    leftovers,
    score: scoreLayouts(minimizedLayouts, config.precision),
  };
}

function getSingleModePass(optimize: OptimizeMode): SearchPassDefinition {
  if (optimize === 'cnc') {
    return {
      id: 'cnc-area',
      optimize: 'cnc',
      packerKind: 'tight',
      partSortMode: 'area-desc',
    };
  }

  return {
    id: 'cuts-shelf-long-side',
    optimize: 'cuts',
    packerKind: 'shelf',
    partSortMode: 'long-side-desc',
  };
}

function isBetterSearchResult(
  candidate: SearchPassResult,
  best: SearchPassResult,
  precision: number,
): boolean {
  if (candidate.leftovers.length !== best.leftovers.length) {
    return candidate.leftovers.length < best.leftovers.length;
  }

  return compareLayoutScores(candidate.score, best.score, precision) < 0;
}

function placeAllParts(
  config: Config,
  parts: PartToCut[],
  stock: Stock[],
  packer: Packer<PartToCut>,
  options: {
    partSortMode: PartSortMode;
    randomSeed?: number;
    packerOptions: PackOptions;
  },
): { layouts: PotentialBoardLayout[]; leftovers: PartToCut[] } {
  const margin = new Distance(config.margin).m;
  const { packerOptions } = options;
  const unplacedParts = new Set(
    sortPartsForPlacement(
      parts,
      config.precision,
      options.partSortMode,
      options.randomSeed,
    ),
  );
  const leftovers: PartToCut[] = [];
  const layouts: PotentialBoardLayout[] = [];

  while (unplacedParts.size > 0) {
    const unplacedPartsArray = [...unplacedParts];
    const targetPart = unplacedPartsArray[0];

    const board = stock.find((board) =>
      isValidStock(board, targetPart, config.precision),
    );
    if (board == null) {
      unplacedParts.delete(targetPart);
      leftovers.push(targetPart);
      continue;
    }

    const layout: PotentialBoardLayout = { placements: [], stock: board };
    const boardRect = new Rectangle(
      board,
      margin,
      margin,
      board.width - 2 * margin,
      board.length - 2 * margin,
    );

    const partsToPlace = unplacedPartsArray
      .filter((part) => isValidStock(board, part, config.precision))
      .map((part) => {
        // grainLock='width': pre-rotate so part.width is on Y-axis (with grain)
        if (part.grainLock === 'width') {
          return new Rectangle(part, 0, 0, part.size.length, part.size.width);
        }
        return new Rectangle(part, 0, 0, part.size.width, part.size.length);
      });

    const res = packer.pack(boardRect, partsToPlace, packerOptions);
    if (res.placements.length > 0) {
      layouts.push(layout);
      res.placements.forEach((placement) => {
        layout.placements.push(placement);
        unplacedParts.delete(placement.data);
      });
    } else {
      res.leftovers.forEach((part) => {
        leftovers.push(part);
        unplacedParts.delete(part);
      });
    }
  }

  return { layouts, leftovers };
}

function sortPartsForPlacement(
  parts: PartToCut[],
  precision: number,
  mode: PartSortMode,
  seed: number | undefined,
): PartToCut[] {
  return [...parts].sort((a, b) => {
    // Keep material/thickness grouped so those parts stay together on the same stock.
    const materialCompare = a.material.localeCompare(b.material);
    if (materialCompare !== 0) return materialCompare;

    const thicknessCompare = b.size.thickness - a.size.thickness;
    if (Math.abs(thicknessCompare) > precision) return thicknessCompare;

    const metricCompare =
      getSortMetric(b, mode, seed) - getSortMetric(a, mode, seed);
    if (Math.abs(metricCompare) > precision) return metricCompare;

    if (mode === 'area-random') {
      const randomizedCompare =
        getStableRandomValue(seed ?? 0, b) - getStableRandomValue(seed ?? 0, a);
      if (randomizedCompare !== 0) return randomizedCompare;
    }

    const areaCompare =
      b.size.width * b.size.length - a.size.width * a.size.length;
    if (Math.abs(areaCompare) > precision) return areaCompare;

    return comparePartIdentity(a, b);
  });
}

function getSortMetric(
  part: PartToCut,
  mode: PartSortMode,
  _seed: number | undefined,
): number {
  const longSide = Math.max(part.size.width, part.size.length);
  const shortSide = Math.min(part.size.width, part.size.length);

  if (mode === 'long-side-desc') return longSide;
  if (mode === 'short-side-desc') return shortSide;
  if (mode === 'perimeter-desc')
    return (part.size.width + part.size.length) * 2;
  return part.size.width * part.size.length;
}

function comparePartIdentity(a: PartToCut, b: PartToCut): number {
  const partNumberCompare = a.partNumber - b.partNumber;
  if (partNumberCompare !== 0) return partNumberCompare;

  const instanceCompare = a.instanceNumber - b.instanceNumber;
  if (instanceCompare !== 0) return instanceCompare;

  const sourcePartCompare = (a.sourcePartId ?? '').localeCompare(
    b.sourcePartId ?? '',
  );
  if (sourcePartCompare !== 0) return sourcePartCompare;

  const sourceElementCompare = (a.sourceElementId ?? '').localeCompare(
    b.sourceElementId ?? '',
  );
  if (sourceElementCompare !== 0) return sourceElementCompare;

  return a.name.localeCompare(b.name);
}

function getStableRandomValue(seed: number, part: PartToCut): number {
  const key = [
    seed,
    part.material,
    part.partNumber,
    part.instanceNumber,
    part.name,
    part.sourcePartId ?? '',
    part.sourceElementId ?? '',
  ].join('|');

  let hash = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * Given a layout, return a new layout on a smaller peice of stock, if
 * possible. If a smaller stock cannot be found, return the same layout.
 */
function minimizeLayoutStock(
  config: Config,
  originalLayout: PotentialBoardLayout,
  stock: Stock[],
  packer: Packer<PartToCut>,
  packerOptions: PackOptions,
): PotentialBoardLayout {
  const margin = new Distance(config.margin).m;

  // Get alternative stock, smaller areas first.
  const altStock = stock
    .filter((stock) =>
      isValidStock(originalLayout.stock, stock, config.precision),
    )
    .toSorted((a, b) => a.width * a.length - b.width * b.length);

  for (const smallerStock of altStock) {
    const bin = new Rectangle(
      smallerStock,
      margin,
      margin,
      smallerStock.width - 2 * margin,
      smallerStock.length - 2 * margin,
    );
    const res = packer.pack(bin, [...originalLayout.placements], packerOptions);

    if (res.leftovers.length === 0)
      return { stock: smallerStock, placements: res.placements };
  }

  return originalLayout;
}

interface StockGroup {
  parts: PartToCut[];
  stock: Stock[];
}

/**
 * Group parts by the stock type they match (material + thickness), using the
 * same isValidStock logic that placeAllParts uses to assign parts to boards.
 */
function groupPartsByStock(
  parts: PartToCut[],
  stock: Stock[],
  precision: number,
): StockGroup[] {
  // Collect unique stock types (same material + ~equal thickness)
  const stockTypes: Stock[][] = [];
  for (const s of stock) {
    const match = stockTypes.find(
      (t) =>
        t[0].material === s.material &&
        isNearlyEqual(t[0].thickness, s.thickness, precision),
    );
    if (match) match.push(s);
    else stockTypes.push([s]);
  }

  // Assign each part to its matching stock type in a single pass
  const grouped = new Map<Stock[], PartToCut[]>();
  const unmatched: PartToCut[] = [];

  for (const part of parts) {
    const type = stockTypes.find((t) =>
      t.some((s) => isValidStock(s, part, precision)),
    );
    if (type) {
      let group = grouped.get(type);
      if (!group) {
        group = [];
        grouped.set(type, group);
      }
      group.push(part);
    } else {
      unmatched.push(part);
    }
  }

  const result: StockGroup[] = [...grouped.entries()].map(
    ([groupStock, groupParts]) => ({ parts: groupParts, stock: groupStock }),
  );

  // Unmatched parts still run so they surface as leftovers
  if (unmatched.length > 0) {
    result.push({ parts: unmatched, stock });
  }

  return result;
}

function getPackerOptions(config: Config): PackOptions {
  return {
    allowRotations: true,
    gap: new Distance(config.bladeWidth).m,
    precision: config.precision,
    canRotateRect: (data: unknown) => {
      const part = data as PartToCut;
      return !part.grainLock;
    },
  };
}

function serializeBoardLayoutRectangles(
  layout: PotentialBoardLayout,
  marginM: number,
): BoardLayout {
  return {
    placements: layout.placements.map(serializePartToCutPlacement),
    stock: {
      material: layout.stock.material,
      thicknessM: layout.stock.thickness,
      widthM: layout.stock.width,
      lengthM: layout.stock.length,
      color: layout.stock.color,
    },
    marginM,
  };
}

function serializePartToCutPlacement(
  placement: Rectangle<PartToCut>,
): BoardLayoutPlacement {
  return {
    instanceNumber: placement.data.instanceNumber,
    partNumber: placement.data.partNumber,
    name: placement.data.name,
    material: placement.data.material,
    grainLock: placement.data.grainLock,
    leftM: placement.left,
    rightM: placement.right,
    topM: placement.top,
    bottomM: placement.bottom,
    lengthM: placement.height,
    thicknessM: placement.data.size.thickness,
    widthM: placement.width,
  };
}

function serializePartToCut(part: PartToCut): BoardLayoutLeftover {
  return {
    instanceNumber: part.instanceNumber,
    partNumber: part.partNumber,
    name: part.name,
    material: part.material,
    grainLock: part.grainLock,
    lengthM: part.size.length,
    widthM: part.size.width,
    thicknessM: part.size.thickness,
  };
}
