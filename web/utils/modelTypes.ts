/**
 * Shared type definitions for parsed model data.
 *
 * These types are format-agnostic — they describe the common output of both
 * GLTF and COLLADA parsers, consumed by IDB storage, the BOM, the 3D viewer,
 * and the packing engine pipeline.
 */

import type { PartToCut } from 'cutlist';

/**
 * One unmaterialized part. The `colorKey` references a `ColorInfo.key`; the
 * board layout pipeline turns it into a real `material` via the user's color
 * mapping.
 */
export type Part = Omit<PartToCut, 'material'> & { colorKey: string };

export interface ColorInfo {
  /** Material/color group key (material name, hex string, etc.). */
  key: string;
  /** Parsed RGB in 0..1 for swatch rendering. */
  rgb: [number, number, number];
  /** How many parts use this color. */
  count: number;
}

export interface NodePartMapping {
  nodeIndex: number;
  partNumber: number;
  colorHex: string;
}

export interface DeriveResult {
  parts: Part[];
  colors: ColorInfo[];
  nodePartMap: NodePartMapping[];
}
