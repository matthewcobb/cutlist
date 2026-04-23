import {
  DERIVE_VERSION,
  type ColorInfo,
  type NodePartMapping,
  type Part,
} from '~/utils/parseGltf';
import type { IdbModelMeta, PartOverride } from '~/composables/useIdb';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { importProjectFromFile } from '~/utils/projectImport';
import { DEMO_PROJECT_FILENAME, shouldSeedDemoProject } from '~/utils/demoSeed';
import { deriveModel } from '~/composables/useComputationWorker';

export interface Model {
  id: string;
  filename: string;
  source: 'gltf' | 'manual';
  parts: Part[];
  colors: ColorInfo[];
  enabled: boolean;
  gltfJson?: object;
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
}

interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ArchivedProjectItem {
  id: string;
  name: string;
  archivedAt: string;
}

// ─── Module-level singletons (same pattern as before) ────────────────────────

const activeId = ref<string | null>(null);
const projectList = ref<ProjectListItem[]>([]);
const archivedList = ref<ArchivedProjectItem[]>([]);
const activeProjectData = ref<Project | null>(null);
const projectLoading = ref(false);

async function seedDemoProject(
  idb: ReturnType<typeof useIdb>,
): Promise<string> {
  const base = import.meta.env.BASE_URL ?? '/';
  const url = `${base.endsWith('/') ? base : `${base}/`}${DEMO_PROJECT_FILENAME}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load demo project (${response.status})`);
  }
  const blob = await response.blob();
  const file = new File([blob], DEMO_PROJECT_FILENAME, {
    type: blob.type || 'application/gzip',
  });
  return importProjectFromFile(file, idb);
}

/** Apply partOverrides onto derived parts. */
function applyOverrides(
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
async function hydrateModel(
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

async function loadProject(
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

async function init(idb: ReturnType<typeof useIdb>) {
  let [list, archived] = await Promise.all([
    idb.getProjectList(),
    idb.getArchivedList(),
  ]);

  const demoSeeded = await idb.getDemoSeeded();
  if (
    shouldSeedDemoProject({
      projects: list.length,
      archived: archived.length,
      demoSeeded,
    })
  ) {
    try {
      await seedDemoProject(idb);
      await idb.setDemoSeeded(true);
      [list, archived] = await Promise.all([
        idb.getProjectList(),
        idb.getArchivedList(),
      ]);
    } catch (err) {
      console.warn('Demo project seed failed', err);
    }
  }

  projectList.value = list;
  archivedList.value = archived;
}

if (import.meta.client) {
  const idb = useIdb();

  // Single watcher — loads project data when activeId changes (set by router).
  watch(activeId, async (id) => {
    if (!id) {
      activeProjectData.value = null;
      projectLoading.value = false;
      return;
    }
    if (activeProjectData.value?.id !== id) {
      activeProjectData.value = null;
    }
    projectLoading.value = true;
    const data = await loadProject(idb, id);
    if (activeId.value !== id) return; // stale if user switched again
    if (data) {
      activeProjectData.value = data;
    } else {
      activeId.value = null; // stale URL — back to index
    }
    projectLoading.value = false;
  });

  init(idb);
}

// ─── Composable ──────────────────────────────────────────────────────────────

export default function useProjects() {
  const idb = useIdb();

  // Build a Map matching the old interface
  const projects = computed(() => {
    const map = new Map<string, Project>();
    for (const p of projectList.value) {
      if (
        p.id === activeId.value &&
        activeProjectData.value?.id === activeId.value
      ) {
        map.set(p.id, activeProjectData.value);
      } else {
        map.set(p.id, {
          id: p.id,
          name: p.name,
          models: [],
          colorMap: {},
          excludedColors: [],
          stock: '',
          distanceUnit: 'mm',
        });
      }
    }
    return map;
  });

  const activeProject = computed(() => {
    if (activeId.value == null) return undefined;
    return activeProjectData.value ?? undefined;
  });

  const enabledModels = computed(
    () => activeProject.value?.models.filter((m) => m.enabled) ?? [],
  );

  const manualModel = computed(() =>
    activeProject.value?.models.find((m) => m.source === 'manual'),
  );

  const allColors = computed(() => {
    const counts = new Map<string, ColorInfo>();
    for (const model of enabledModels.value) {
      for (const color of model.colors) {
        const existing = counts.get(color.key);
        if (existing) {
          counts.set(color.key, {
            ...existing,
            count: existing.count + color.count,
          });
        } else {
          counts.set(color.key, { ...color });
        }
      }
    }
    return [...counts.values()];
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  async function addProject(name: string) {
    const project = await idb.createProject(name);
    projectList.value = [
      ...projectList.value,
      { id: project.id, name: project.name, updatedAt: project.updatedAt },
    ];
    activeId.value = project.id;
    activeProjectData.value = { ...project, models: [] };
  }

  async function closeProject(id: string) {
    const item = projectList.value.find((p) => p.id === id);
    const remaining = projectList.value.filter((p) => p.id !== id);
    if (activeId.value === id) {
      const nextId =
        remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      activeId.value = nextId;
      // activeProjectData will be updated by the activeId watcher
    }
    projectList.value = remaining;
    await idb.archiveProject(id);
    const archivedAt = new Date().toISOString();
    archivedList.value = [
      { id, name: item?.name ?? '', archivedAt },
      ...archivedList.value,
    ];
  }

  async function restoreProject(id: string) {
    const item = archivedList.value.find((p) => p.id === id);
    if (!item) return;
    await idb.unarchiveProject(id);
    archivedList.value = archivedList.value.filter((p) => p.id !== id);
    const updatedAt = new Date().toISOString();
    projectList.value = [
      { id, name: item.name, updatedAt },
      ...projectList.value,
    ];
    activeId.value = id;
  }

  async function permanentlyDeleteProject(id: string) {
    archivedList.value = archivedList.value.filter((p) => p.id !== id);
    await idb.deleteProject(id);
  }

  async function clearHistory() {
    const ids = archivedList.value.map((p) => p.id);
    archivedList.value = [];
    await Promise.all(ids.map((id) => idb.deleteProject(id)));
  }

  function setActive(id: string) {
    activeId.value = id;
  }

  async function addModel(projectId: string, model: Model) {
    // Optimistic: add to reactive store without gltfJson
    if (activeProjectData.value?.id === projectId) {
      const { gltfJson: _g, ...meta } = model;
      activeProjectData.value = {
        ...activeProjectData.value,
        models: [...activeProjectData.value.models, meta],
      };
    }
    // Write to IDB (gltfJson stored for GLTF, parts stored for manual)
    await idb.createModel({
      id: model.id,
      projectId,
      filename: model.filename,
      source: model.source,
      parts: model.source === 'manual' ? model.parts : [],
      enabled: model.enabled,
      gltfJson: model.gltfJson ?? null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });
  }

  async function removeModel(projectId: string, modelId: string) {
    if (activeProjectData.value?.id === projectId) {
      activeProjectData.value = {
        ...activeProjectData.value,
        models: activeProjectData.value.models.filter((m) => m.id !== modelId),
      };
    }
    await idb.deleteModel(modelId);
  }

  async function toggleModel(projectId: string, modelId: string) {
    const current = activeProjectData.value?.models.find(
      (m) => m.id === modelId,
    );
    const newEnabled = current ? !current.enabled : true;

    if (activeProjectData.value?.id === projectId) {
      activeProjectData.value = {
        ...activeProjectData.value,
        models: activeProjectData.value.models.map((m) =>
          m.id === modelId ? { ...m, enabled: newEnabled } : m,
        ),
      };
    }
    await idb.updateModel(modelId, { enabled: newEnabled });
  }

  async function updateColorMap(
    id: string,
    colorKey: string,
    material: string,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== id) return;
    const newColorMap = { ...project.colorMap, [colorKey]: material };
    activeProjectData.value = { ...project, colorMap: newColorMap };
    await idb.updateProject(id, { colorMap: newColorMap });
  }

  async function toggleColorExcluded(id: string, colorKey: string) {
    const project = activeProjectData.value;
    if (!project || project.id !== id) return;
    const excluded = project.excludedColors ?? [];
    const newExcluded = excluded.includes(colorKey)
      ? excluded.filter((k) => k !== colorKey)
      : [...excluded, colorKey];
    activeProjectData.value = { ...project, excludedColors: newExcluded };
    await idb.updateProject(id, { excludedColors: newExcluded });
  }

  async function updateStock(projectId: string, stock: string) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;
    activeProjectData.value = { ...project, stock };
    await idb.updateProject(projectId, { stock });
  }

  async function updateDistanceUnit(
    projectId: string,
    distanceUnit: 'in' | 'mm',
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;
    activeProjectData.value = { ...project, distanceUnit };
    await idb.updateProject(projectId, { distanceUnit });
  }

  async function addManualPart(projectId: string, data: ManualPartInput) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    const newPartNumber = existing
      ? Math.max(0, ...existing.parts.map((d) => d.partNumber)) + 1
      : 1;

    const newParts: Part[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber: newPartNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));

    // grainLock goes into partOverrides, not onto the Part
    const newOverrides: Record<number, PartOverride> = {};
    if (data.grainLock) {
      newOverrides[newPartNumber] = { grainLock: data.grainLock };
    }

    if (existing) {
      const updatedParts = [...existing.parts, ...newParts];
      // Merge new overrides with existing (get current from IDB)
      const idbModel = (await idb.getProjectWithModels(projectId))?.models.find(
        (m) => m.id === existing.id,
      );
      const mergedOverrides = {
        ...(idbModel?.partOverrides ?? {}),
        ...newOverrides,
      };
      // Reactive store sees parts with overrides applied
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === existing.id
            ? { ...m, parts: applyOverrides(updatedParts, mergedOverrides) }
            : m,
        ),
      };
      await idb.updateModel(existing.id, {
        parts: updatedParts,
        partOverrides: mergedOverrides,
      });
    } else {
      const modelId = crypto.randomUUID();
      const model: Model = {
        id: modelId,
        filename: 'Manual Parts',
        source: 'manual',
        parts: applyOverrides(newParts, newOverrides),
        colors: [],
        enabled: true,
      };
      activeProjectData.value = {
        ...project,
        models: [...project.models, model],
      };
      await idb.createModel({
        id: modelId,
        projectId,
        filename: model.filename,
        source: 'manual',
        parts: newParts,
        enabled: true,
        gltfJson: null,
        partOverrides: newOverrides,
        createdAt: new Date().toISOString(),
      });
    }

    if (!project.colorMap[data.material]) {
      await updateColorMap(projectId, data.material, data.material);
    }
  }

  async function updateManualPart(
    projectId: string,
    partNumber: number,
    data: ManualPartInput,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    const remaining = existing.parts.filter((d) => d.partNumber !== partNumber);
    const updated: Part[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));
    // Strip overrides from remaining parts (they live in partOverrides)
    const cleanParts = [...remaining, ...updated].map(
      ({ grainLock: _, ...rest }) => rest,
    );

    // Update partOverrides for this part number
    const idbModel = (await idb.getProjectWithModels(projectId))?.models.find(
      (m) => m.id === existing.id,
    );
    const updatedOverrides = { ...(idbModel?.partOverrides ?? {}) };
    if (data.grainLock) {
      updatedOverrides[partNumber] = {
        ...updatedOverrides[partNumber],
        grainLock: data.grainLock,
      };
    } else {
      // Clear grainLock if removed
      if (updatedOverrides[partNumber]) {
        const { grainLock: _, ...rest } = updatedOverrides[partNumber];
        if (Object.keys(rest).length === 0) {
          delete updatedOverrides[partNumber];
        } else {
          updatedOverrides[partNumber] = rest;
        }
      }
    }

    activeProjectData.value = {
      ...project,
      models: project.models.map((m) =>
        m.id === existing.id
          ? { ...m, parts: applyOverrides(cleanParts, updatedOverrides) }
          : m,
      ),
    };
    await idb.updateModel(existing.id, {
      parts: cleanParts,
      partOverrides: updatedOverrides,
    });

    if (!project.colorMap[data.material]) {
      await updateColorMap(projectId, data.material, data.material);
    }
  }

  async function removeManualPart(projectId: string, partNumber: number) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    const remaining = existing.parts.filter((d) => d.partNumber !== partNumber);

    if (remaining.length === 0) {
      activeProjectData.value = {
        ...project,
        models: project.models.filter((m) => m.id !== existing.id),
      };
      await idb.deleteModel(existing.id);
    } else {
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === existing.id ? { ...m, parts: remaining } : m,
        ),
      };
      await idb.updateModel(existing.id, { parts: remaining });
    }
  }

  async function renameProject(id: string, name: string) {
    if (activeProjectData.value?.id === id) {
      activeProjectData.value = { ...activeProjectData.value, name };
    }
    projectList.value = projectList.value.map((p) =>
      p.id === id ? { ...p, name } : p,
    );
    await idb.updateProject(id, { name });
  }

  async function reloadProjectList() {
    const [list, archived] = await Promise.all([
      idb.getProjectList(),
      idb.getArchivedList(),
    ]);
    projectList.value = list;
    archivedList.value = archived;
  }

  function reorderProjects(ids: string[]) {
    const map = new Map(projectList.value.map((p) => [p.id, p]));
    projectList.value = ids.map((id) => map.get(id)!).filter(Boolean);
  }

  /** Shared helper: apply a partial override to a part by adjusted number. */
  async function applyPartOverride(
    projectId: string,
    adjustedPartNumber: number,
    patch: Partial<PartOverride>,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const enabled = project.models.filter((m) => m.enabled);
    const offsets = computePartNumberOffsets(enabled);

    for (let i = 0; i < enabled.length; i++) {
      const model = enabled[i];
      const targetPartNumber = adjustedPartNumber - offsets[i];
      if (!model.parts.some((d) => d.partNumber === targetPartNumber)) continue;

      // Update the reactive store
      const updatedParts: Part[] = model.parts.map((d) =>
        d.partNumber === targetPartNumber ? { ...d, ...patch } : d,
      );
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === model.id ? { ...m, parts: updatedParts } : m,
        ),
      };

      // Persist to partOverrides in IDB
      const existing = await idb.getProjectWithModels(projectId);
      const idbModel = existing?.models.find((m) => m.id === model.id);
      const currentOverrides = { ...(idbModel?.partOverrides ?? {}) };
      const merged = { ...currentOverrides[targetPartNumber], ...patch };
      // Strip undefined values so cleared overrides don't linger
      const cleaned = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined),
      ) as PartOverride;
      if (Object.keys(cleaned).length === 0) {
        delete currentOverrides[targetPartNumber];
      } else {
        currentOverrides[targetPartNumber] = cleaned;
      }
      await idb.updateModel(model.id, { partOverrides: currentOverrides });
      break;
    }
  }

  async function updatePartGrainLock(
    projectId: string,
    adjustedPartNumber: number,
    grainLock: 'length' | 'width' | undefined,
  ) {
    await applyPartOverride(projectId, adjustedPartNumber, { grainLock });
  }

  async function updatePartNameOverride(
    projectId: string,
    adjustedPartNumber: number,
    name: string,
  ) {
    const nextName = name.trim();
    if (!nextName) return;
    await applyPartOverride(projectId, adjustedPartNumber, { name: nextName });
  }

  return {
    projects,
    activeId,
    activeProject,
    projectLoading,
    archivedList,
    enabledModels,
    manualModel,
    allColors,
    addProject,
    closeProject,
    restoreProject,
    permanentlyDeleteProject,
    clearHistory,
    renameProject,
    reorderProjects,
    setActive,
    addModel,
    removeModel,
    toggleModel,
    updateColorMap,
    toggleColorExcluded,
    updateStock,
    updateDistanceUnit,
    addManualPart,
    updateManualPart,
    removeManualPart,
    updatePartGrainLock,
    updatePartNameOverride,
    reloadProjectList,
  };
}
