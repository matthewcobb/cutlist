import type { ColorInfo, NodePartMapping, Part } from '~/utils/modelTypes';
import { DEFAULT_SETTINGS } from '~/utils/settings';
import type { IdbProject, PartOverride } from '~/composables/useIdb';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { loadProject } from '~/composables/useModelHydration';
import { maybeSeedDemo } from '~/composables/useDemoSeed';
import { useManualParts } from '~/composables/useManualParts';

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

async function init(idb: ReturnType<typeof useIdb>) {
  await maybeSeedDemo(idb);

  const [list, archived] = await Promise.all([
    idb.getProjectList(),
    idb.getArchivedList(),
  ]);
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
          distanceUnit: DEFAULT_SETTINGS.distanceUnit,
          bladeWidth: DEFAULT_SETTINGS.bladeWidth,
          margin: DEFAULT_SETTINGS.margin,
          optimize: DEFAULT_SETTINGS.optimize,
          showPartNumbers: DEFAULT_SETTINGS.showPartNumbers,
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
    if (id === activeId.value) return;
    navigateTo(`/${id}`);
  }

  async function addModel(projectId: string, model: Model) {
    // Optimistic: add to reactive store without rawSource
    if (activeProjectData.value?.id === projectId) {
      const { rawSource: _r, ...meta } = model;
      activeProjectData.value = {
        ...activeProjectData.value,
        models: [...activeProjectData.value.models, meta],
      };
    }
    // Write to IDB — both GLTF and manual models store their parts at import time
    await idb.createModel({
      id: model.id,
      projectId,
      filename: model.filename,
      source: model.source,
      parts: model.parts,
      colors: model.colors ?? [],
      nodePartMap: model.nodePartMap ?? [],
      enabled: model.enabled,
      rawSource: model.rawSource ?? null,
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

  /**
   * Apply a partial patch to the active project's in-memory record.
   * Used by useProjectSettings to update the reactive state immediately
   * while a debounced IDB write is scheduled separately.
   */
  function patchActiveProject(patch: Partial<IdbProject>) {
    const project = activeProjectData.value;
    if (!project) return;
    activeProjectData.value = { ...project, ...patch };
  }

  // Manual part operations (delegated to useManualParts)
  const { addManualPart, updateManualPart, removeManualPart } = useManualParts({
    activeProjectData,
    idb,
    updateColorMap,
  });

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
    patchActiveProject,
    addManualPart,
    updateManualPart,
    removeManualPart,
    updatePartGrainLock,
    updatePartNameOverride,
    reloadProjectList,
  };
}
