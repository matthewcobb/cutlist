/**
 * Model hydration — reconstructs runtime Model objects from IDB metadata.
 *
 * Both GLTF and manual models store their parts directly in IDB, so
 * hydration is a simple read + override-apply step.
 */

import type { Part } from '~/utils/modelTypes';
import type { IdbModelMeta, PartOverride } from '~/composables/useIdb';
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

/** Build a Model from IDB metadata. */
export function hydrateModel(meta: IdbModelMeta): Model {
  return {
    id: meta.id,
    filename: meta.filename,
    source: meta.source,
    parts: applyOverrides(meta.parts, meta.partOverrides),
    colors: meta.colors,
    enabled: meta.enabled,
    nodePartMap: meta.nodePartMap,
  };
}

/** Load a project from IDB and hydrate all its models. */
export async function loadProject(
  idb: ReturnType<typeof useIdb>,
  id: string,
): Promise<Project | null> {
  const full = await idb.getProjectWithModels(id);
  if (!full) return null;
  const models = full.models.map(hydrateModel);
  return { ...full, models };
}
