import type { ColorInfo, NodePartMapping, PartDraft } from '~/utils/parseGltf';
import type { IdbModelMeta } from '~/composables/useIdb';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';

export interface Model {
  id: string;
  filename: string;
  source: 'gltf' | 'manual';
  drafts: PartDraft[];
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
let initialized = false;

function toModel(meta: IdbModelMeta): Model {
  return {
    id: meta.id,
    filename: meta.filename,
    source: meta.source,
    drafts: meta.drafts,
    colors: meta.colors,
    enabled: meta.enabled,
    nodePartMap: meta.nodePartMap ?? undefined,
  };
}

async function init() {
  const idb = useIdb();
  const [list, archived] = await Promise.all([
    idb.getProjectList(),
    idb.getArchivedList(),
  ]);
  projectList.value = list;
  archivedList.value = archived;
  if (list.length > 0 && activeId.value == null) {
    activeId.value = list[0].id;
  }
  if (activeId.value) {
    const full = await idb.getProjectWithModels(activeId.value);
    activeProjectData.value = full
      ? { ...full, models: full.models.map(toModel) }
      : null;
  }
  initialized = true;
}

if (import.meta.client && !initialized) {
  init();
}

// ─── Composable ──────────────────────────────────────────────────────────────

export default function useProjects() {
  const idb = useIdb();

  // Watch activeId changes to reload full project data
  watch(activeId, async (id) => {
    if (!initialized) return;
    if (!id) {
      activeProjectData.value = null;
      return;
    }
    const full = await idb.getProjectWithModels(id);
    activeProjectData.value = full
      ? { ...full, models: full.models.map(toModel) }
      : null;
  });

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
    // Write full model (with gltfJson) to IDB
    await idb.createModel({
      id: model.id,
      projectId,
      filename: model.filename,
      source: model.source,
      drafts: model.drafts,
      colors: model.colors,
      enabled: model.enabled,
      gltfJson: model.gltfJson ?? null,
      nodePartMap: model.nodePartMap ?? null,
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
      ? Math.max(0, ...existing.drafts.map((d) => d.partNumber)) + 1
      : 1;

    const newDrafts: PartDraft[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber: newPartNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      grainLock: data.grainLock,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));

    if (existing) {
      const updatedDrafts = [...existing.drafts, ...newDrafts];
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === existing.id ? { ...m, drafts: updatedDrafts } : m,
        ),
      };
      await idb.updateModel(existing.id, { drafts: updatedDrafts });
    } else {
      const model: Model = {
        id: crypto.randomUUID(),
        filename: 'Manual Parts',
        source: 'manual',
        drafts: newDrafts,
        colors: [],
        enabled: true,
      };
      activeProjectData.value = {
        ...project,
        models: [...project.models, model],
      };
      await idb.createModel({
        id: model.id,
        projectId,
        filename: model.filename,
        source: 'manual',
        drafts: newDrafts,
        colors: [],
        enabled: true,
        gltfJson: null,
        nodePartMap: null,
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

    const remaining = existing.drafts.filter(
      (d) => d.partNumber !== partNumber,
    );
    const updated: PartDraft[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      grainLock: data.grainLock,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));
    const updatedDrafts = [...remaining, ...updated];

    activeProjectData.value = {
      ...project,
      models: project.models.map((m) =>
        m.id === existing.id ? { ...m, drafts: updatedDrafts } : m,
      ),
    };
    await idb.updateModel(existing.id, { drafts: updatedDrafts });

    if (!project.colorMap[data.material]) {
      await updateColorMap(projectId, data.material, data.material);
    }
  }

  async function removeManualPart(projectId: string, partNumber: number) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    const remaining = existing.drafts.filter(
      (d) => d.partNumber !== partNumber,
    );

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
          m.id === existing.id ? { ...m, drafts: remaining } : m,
        ),
      };
      await idb.updateModel(existing.id, { drafts: remaining });
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

  async function updatePartGrainLock(
    projectId: string,
    adjustedPartNumber: number,
    grainLock: 'length' | 'width' | undefined,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const enabled = project.models.filter((m) => m.enabled);
    const offsets = computePartNumberOffsets(enabled);

    for (let i = 0; i < enabled.length; i++) {
      const model = enabled[i];
      const targetPartNumber = adjustedPartNumber - offsets[i];
      if (!model.drafts.some((d) => d.partNumber === targetPartNumber))
        continue;

      const updatedDrafts: PartDraft[] = model.drafts.map((d) =>
        d.partNumber === targetPartNumber ? { ...d, grainLock } : d,
      );
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === model.id ? { ...m, drafts: updatedDrafts } : m,
        ),
      };
      await idb.updateModel(model.id, { drafts: updatedDrafts });
      break;
    }
  }

  return {
    projects,
    activeId,
    activeProject,
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
    updateStock,
    updateDistanceUnit,
    addManualPart,
    updateManualPart,
    removeManualPart,
    updatePartGrainLock,
    reloadProjectList,
  };
}
