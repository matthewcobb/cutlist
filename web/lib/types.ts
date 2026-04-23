import { z } from 'zod';
import type { Rectangle } from './geometry';

/**
 * A number in meters or a string with unit suffix ("1in").
 */
const Distance = z.union([z.number(), z.string()]);
type Distance = z.infer<typeof Distance>;

export const SearchPass = z.union([
  z.literal('cuts-shelf-area'),
  z.literal('cuts-shelf-long-side'),
  z.literal('cuts-shelf-short-side'),
  z.literal('cuts-guillotine-bssf-area'),
  z.literal('cuts-guillotine-bssf-long-side'),
  z.literal('cuts-guillotine-bssf-short-side'),
  z.literal('cuts-guillotine-baf-area'),
  z.literal('cuts-guillotine-baf-long-side'),
  z.literal('cuts-guillotine-blsf-long-side'),
  z.literal('cnc-area'),
  z.literal('cnc-perimeter'),
  z.literal('cnc-random-a'),
  z.literal('cnc-random-b'),
  z.literal('cnc-random-c'),
]);
export type SearchPass = z.infer<typeof SearchPass>;

/**
 * Contains the material and dimensions for a single panel or board.
 */
export interface Stock {
  /**
   * The material name, matching what is set in Onshape.
   */
  material: string;
  /**
   * In meters
   */
  thickness: number;
  /**
   * In meters
   */
  width: number;
  /**
   * In meters
   */
  length: number;
  /**
   * Whether this material has a grain direction. When false, parts of this
   * material always rotate freely regardless of their grainLock setting.
   */
  hasGrain: boolean;
  /** Display color for board previews (hex string). */
  color?: string;
}

/**
 * A board size — width × length plus the thicknesses available in that size.
 */
export const StockSize = z.object({
  width: Distance,
  length: Distance,
  thickness: z.array(Distance),
});
export type StockSize = z.infer<typeof StockSize>;

/**
 * For a material, define board sizes and the thicknesses available in each.
 */
export const StockMatrix = z.object({
  material: z.string(),
  /**
   * Unit for numeric dimensions. When a dimension is a plain number, it is
   * interpreted in this unit. String dimensions (e.g. "18mm") carry their own
   * unit and ignore this field. Defaults to 'mm'.
   */
  unit: z.enum(['mm', 'in']).default('mm'),
  /**
   * Available board sizes. Each entry is a specific width × length pair with
   * its own set of available thicknesses.
   */
  sizes: z.array(StockSize),
  /**
   * Whether this material has a grain direction. Set to false for sheet goods
   * like MDF where orientation doesn't matter. Defaults to true.
   */
  hasGrain: z.boolean().default(true),
  /** Display color for board previews (hex string, e.g. "#d2b996"). */
  color: z.string().optional(),
});
export type StockMatrix = z.infer<typeof StockMatrix>;

/**
 * Part info, material, and size. Everything needed to know how to layout the board on stock.
 */
export interface PartToCut {
  partNumber: number;
  instanceNumber: number;
  name: string;
  material: string;
  sourcePartId?: string;
  sourceElementId?: string;
  /**
   * Locks the part to a specific grain orientation. Only takes effect when the
   * matched stock material has `hasGrain` enabled.
   * - `'length'`: part's length dimension runs with the grain (↕ in layout)
   * - `'width'`: part's width dimension runs with the grain (↔ in layout)
   * - `undefined`: free rotation — optimizer chooses best orientation
   */
  grainLock?: 'length' | 'width';
  size: {
    /**
     * In meters
     */
    width: number;
    /**
     * In meters
     */
    length: number;
    /**
     * In meters
     */
    thickness: number;
  };
}

/**
 * Options for generating the board layouts.
 */
export const Config = z.object({
  /**
   * The blade kerf, usually around 0.125 inches.
   */
  bladeWidth: Distance.default('0.125in'),
  /**
   * The optimization method when laying out the parts on the stock.
   * - `"auto"`: Run multiple deterministic passes and keep the best layout
   *   based on board count, waste, then cut complexity.
   * - `"cnc"`: Pack as many parts onto each peice of stock as possible.
   *   Layouts may require non-guillotine cuts (plunge/jigsaw), so this is best
   *   for CNC routers and other tools that can cut anywhere on a sheet.
   * - `"cuts"`: Generate strictly guillotine (edge-to-edge) board layouts that
   *   are easy to cut out with a table/circular/track saw.
   */
  optimize: z
    .union([z.literal('auto'), z.literal('cnc'), z.literal('cuts')])
    .default('auto'),
  /**
   * Board margin — inset from all edges where parts will not be placed.
   * Useful for clamping area, trimming damaged edges, or out-of-square stock.
   */
  margin: Distance.default('0'),
  /**
   * Maximum time budget for the multi-pass optimizer.
   */
  maxSearchMs: z.number().positive().default(8000),
  /**
   * Optional pass override for the multi-pass optimizer.
   */
  searchPasses: z.array(SearchPass).optional(),
  precision: z.number().default(1e-5),
});
export type Config = z.infer<typeof Config>;
export type ConfigInput = z.input<typeof Config>;

/**
 * JSON friendly object containing boards and part placements.
 */
export interface BoardLayout {
  stock: BoardLayoutStock;
  placements: BoardLayoutPlacement[];
  /** Board margin in meters (inset from all edges). 0 when no margin is set. */
  marginM: number;
}

export interface BoardLayoutStock {
  material: string;
  widthM: number;
  lengthM: number;
  thicknessM: number;
  color?: string;
}

export interface BoardLayoutLeftover {
  partNumber: number;
  instanceNumber: number;
  name: string;
  material: string;
  widthM: number;
  lengthM: number;
  thicknessM: number;
  grainLock?: 'length' | 'width';
}

export interface BoardLayoutPlacement extends BoardLayoutLeftover {
  leftM: number;
  rightM: number;
  topM: number;
  bottomM: number;
}

/**
 * Intermediate type for storing the board layout with the rectangle class. Not
 * JSON friendly. This gets converted into `BoardLayout`, which doesn't contain
 * any classes, and is save to convert to and from JSON.
 */
export interface PotentialBoardLayout {
  stock: Stock;
  placements: Rectangle<PartToCut>[];
}
