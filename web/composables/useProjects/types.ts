import type { ColorInfo, NodePartMapping, Part } from '~/utils/modelTypes';

export interface Model {
  id: string;
  filename: string;
  source: 'gltf' | 'collada' | 'manual';
  parts: Part[];
  colors: ColorInfo[];
  enabled: boolean;
  rawSource?: object | string;
  nodePartMap?: NodePartMapping[];
}

export interface ManualPartInput {
  name: string;
  widthMm: number;
  lengthMm: number;
  thicknessMm: number;
  qty: number;
  material: string;
  grainLock?: 'length' | 'width';
}

export interface Project {
  id: string;
  name: string;
  models: Model[];
  colorMap: Record<string, string>;
  /** Color keys excluded from BOM (unchecked in mapping panel). */
  excludedColors: string[];
  /** Per-project stock definition (YAML string). */
  stock: string;
  /** Per-project distance unit. */
  distanceUnit: 'in' | 'mm';
  /** Per-project saw blade width, in the project's distanceUnit. */
  bladeWidth: number;
  /** Per-project margin/offset for the packing algorithm. */
  margin: number;
  /** Per-project packing strategy hint. */
  optimize: 'Auto' | 'CNC';
  /** Whether to render part numbers in visualizations. */
  showPartNumbers: boolean;
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ArchivedProjectItem {
  id: string;
  name: string;
  archivedAt: string;
}
