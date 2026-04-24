/**
 * Type definitions for the IndexedDB persistence layer.
 *
 * Record shapes consumed by every domain module. Kept separate so types can
 * be imported without pulling in the Dexie runtime.
 *
 * The Dexie `CutlistDB` class itself lives in `./db`; schema indexes are
 * declared there via `this.version(N).stores({...})`.
 */

import type { ColorInfo, NodePartMapping, Part } from '~/utils/parseGltf';

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

/**
 * Cached output of `deriveFromGltf` for a GLTF model. Keyed by DERIVE_VERSION
 * — stale entries (lower version) are ignored and re-derived.
 */
export interface DerivedCache {
  version: number;
  parts: Part[];
  colors: ColorInfo[];
  nodePartMap: NodePartMapping[];
}

export interface IdbModel {
  id: string;
  projectId: string;
  filename: string;
  source: 'gltf' | 'manual';
  /** Source of truth for manual models. GLTF models re-derive from gltfJson on load. */
  parts: Part[];
  enabled: boolean;
  /** Raw GLTF JSON. Null for manual models. */
  gltfJson: object | null;
  /** Per-part user overrides, keyed by partNumber. Extensible for future fields. */
  partOverrides: Record<number, PartOverride>;
  /** Cached derive output for GLTF models. Undefined until first derive. */
  derivedCache?: DerivedCache;
  createdAt: string;
}

/** Model record without gltfJson — what we keep in the reactive store. */
export type IdbModelMeta = Omit<IdbModel, 'gltfJson'>;

export interface IdbBuildStep {
  id: string;
  projectId: string;
  stepNumber: number;
  title: string;
  description: string;
  /** Stable references using modelId + draft partNumber. */
  partRefs: Array<{ modelId: string; partNumber: number }>;
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
