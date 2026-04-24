/**
 * Model hydration — reconstructs runtime Model objects from IDB metadata.
 *
 * Pure functions with no reactive state dependency. They take IDB data in
 * and return hydrated Model objects out.
 */

import { DERIVE_VERSION, type Part } from '~/utils/parseGltf';
import type { IdbModelMeta, PartOverride } from '~/composables/useIdb';
import { deriveModel } from '~/composables/useComputationWorker';
import type { Model, Project } from '~/composables/useProjects';

/** Apply partOverrides onto derived parts. */
export function applyOverrides(
  parts: Part[],
  overrides: Record<number, PartOverride>,
): Part[] {
  if (Object.keys(overrides).length === 0) return parts;
  return parts.map((p) => {
    const o = overrides[p.partNumber];
    return o ? { ...p, ...o } : p;
  });
}

/** Build a Model from IDB metadata. GLTF models re-derive from stored gltfJson. */
export async function hydrateModel(
  meta: IdbModelMeta,
  idb: ReturnType<typeof useIdb>,
): Promise<Model> {
  // Manual models: stored parts are the source of truth
  if (meta.source === 'manual') {
    return {
      id: meta.id,
      filename: meta.filename,
      source: meta.source,
      parts: applyOverrides(meta.parts, meta.partOverrides),
      colors: [],
      enabled: meta.enabled,
    };
  }

  // GLTF models: use cached derive if version matches, otherwise re-derive
  // in the worker and persist the result for next time.
  const cached = meta.derivedCache;
  if (cached && cached.version === DERIVE_VERSION) {
    return {
      id: meta.id,
      filename: meta.filename,
      source: meta.source,
      parts: applyOverrides(cached.parts, meta.partOverrides),
      colors: cached.colors,
      enabled: meta.enabled,
      nodePartMap: cached.nodePartMap,
    };
  }

  const gltfJson = await idb.getModelGltf(meta.id);
  if (!gltfJson) {
    return {
      id: meta.id,
      filename: meta.filename,
      source: meta.source,
      parts: applyOverrides(meta.parts, meta.partOverrides),
      colors: [],
      enabled: meta.enabled,
    };
  }

  try {
    const derived = await deriveModel(gltfJson);
    // Persist for subsequent loads. Swallow IDB errors — cache is advisory.
    idb
      .updateModel(meta.id, {
        derivedCache: {
          version: DERIVE_VERSION,
          parts: derived.parts,
          colors: derived.colors,
          nodePartMap: derived.nodePartMap,
        },
      })
      .catch(() => {});
    return {
      id: meta.id,
      filename: meta.filename,
      source: meta.source,
      parts: applyOverrides(derived.parts, meta.partOverrides),
      colors: derived.colors,
      enabled: meta.enabled,
      nodePartMap: derived.nodePartMap,
    };
  } catch {
    return {
      id: meta.id,
      filename: meta.filename,
      source: meta.source,
      parts: applyOverrides(meta.parts, meta.partOverrides),
      colors: [],
      enabled: meta.enabled,
    };
  }
}

/** Load a project from IDB and hydrate all its models. */
export async function loadProject(
  idb: ReturnType<typeof useIdb>,
  id: string,
): Promise<Project | null> {
  const full = await idb.getProjectWithModels(id);
  if (!full) return null;
  const models = await Promise.all(
    full.models.map((meta) => hydrateModel(meta, idb)),
  );
  return { ...full, models };
}
