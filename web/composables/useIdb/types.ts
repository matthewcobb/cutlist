/**
 * Type definitions for the IndexedDB persistence layer.
 *
 * Record shapes consumed by every domain module. Kept separate so types can
 * be imported without pulling in the Dexie runtime.
 *
 * The Dexie `CutlistDB` class itself lives in `./db`; schema indexes are
 * declared there via `this.version(N).stores({...})`.
 */

import type { ColorInfo, NodePartMapping, Part } from '~/utils/modelTypes';

export interface IdbProject {
  id: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PartOverride {
  grainLock?: 'length' | 'width';
  name?: string;
}

export interface IdbModel {
  id: string;
  projectId: string;
  filename: string;
  source: 'gltf' | 'collada' | 'manual';
  parts: Part[];
  colors: ColorInfo[];
  /** Maps 3D scene node indices to part numbers. Empty for manual models. */
  nodePartMap: NodePartMapping[];
  enabled: boolean;
  /** Raw GLTF JSON or COLLADA XML string. Null for manual models. Kept for the 3D viewer. */
  rawSource: object | string | null;
  /** Per-part user overrides, keyed by partNumber. Extensible for future fields. */
  partOverrides: Record<number, PartOverride>;
  createdAt: string;
}

/** Model record without rawSource — what we keep in the reactive store. */
export type IdbModelMeta = Omit<IdbModel, 'rawSource'>;

export interface IdbBuildStep {
  id: string;
  projectId: string;
  stepNumber: number;
  title: string;
  /** HTML string — supports rich text with hyperlinks. */
  description: string;
  createdAt: string;
}

export const DEMO_SEEDED_KEY = 'demo-seeded-v1' as const;

export interface IdbDemoSeedRecord {
  key: typeof DEMO_SEEDED_KEY;
  seeded: boolean;
}

/**
 * Union of all record shapes kept in the `meta` store. Discriminated by the
 * `key` field. Extend with additional one-off markers as needed.
 */
export type IdbMetaRecord = IdbDemoSeedRecord;
