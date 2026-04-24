/**
 * Type definitions for the IndexedDB persistence layer.
 *
 * Schema shape is consumed by `db.ts` (upgrade path + typed idb handle) and
 * by every domain module. Kept separate so types can be imported without
 * pulling in runtime side effects.
 */

import type { DBSchema } from 'idb';
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import type { ColorInfo, NodePartMapping, Part } from '~/utils/parseGltf';
import type { CutlistSettings } from '~/utils/settings';

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

/**
 * Persisted layout result for a project. Keyed by projectId; `fingerprint`
 * hashes the packing inputs (parts + stock + config) so a mismatch triggers
 * recompute. Written by the layout worker path, read on project switch.
 *
 * The `cacheVersion` field records which LAYOUT_CACHE_VERSION produced this
 * entry. On read, entries with a mismatched version are treated as cache misses.
 */
export interface IdbLayoutCache {
  projectId: string;
  fingerprint: string;
  /** The LAYOUT_CACHE_VERSION that produced this cache entry. */
  cacheVersion: number;
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
}

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

export interface IdbSettingsRecord {
  key: 'global-settings';
  settings: CutlistSettings;
}

export interface IdbSchemaVersionRecord {
  key: 'schema-version';
  version: number;
}

export const DEMO_SEEDED_KEY = 'demo-seeded-v1' as const;

export interface IdbDemoSeedRecord {
  key: typeof DEMO_SEEDED_KEY;
  seeded: boolean;
}

export interface CutlistDb extends DBSchema {
  projects: {
    key: string;
    value: IdbProject;
    indexes: { updatedAt: string };
  };
  models: {
    key: string;
    value: IdbModel;
    indexes: { projectId: string };
  };
  settings: {
    key: string;
    value: IdbSettingsRecord | IdbSchemaVersionRecord | IdbDemoSeedRecord;
  };
  buildSteps: {
    key: string;
    value: IdbBuildStep;
    indexes: { projectId: string };
  };
  layoutCache: {
    key: string;
    value: IdbLayoutCache;
  };
}
