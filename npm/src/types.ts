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
}

/**
 * For a material, define a combination of widths, lengths, and thicknesses
 * that can be combined to form multiple stocks.
 */
export const StockMatrix = z.object({
  material: z.string(),
  thickness: z.array(Distance),
  width: z.array(Distance),
  length: z.array(Distance),
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
   * Extra padding to add to the top and right sides of the boards/stock.
   */
  extraSpace: Distance.default('0'),
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
}

export interface BoardLayoutStock {
  material: string;
  widthM: number;
  lengthM: number;
  thicknessM: number;
}

export interface BoardLayoutLeftover {
  partNumber: number;
  instanceNumber: number;
  name: string;
  material: string;
  widthM: number;
  lengthM: number;
  thicknessM: number;
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
