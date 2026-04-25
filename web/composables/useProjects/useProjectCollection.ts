/**
 * Project list and archive operations.
 *
 * Owns the project list, the archive list, and lifecycle CRUD that affects
 * either (add/close/restore/delete/clear/rename/reorder). Initial population
 * runs once from `startProjects()`. Sets `activeId` when a project is added or
 * restored so URL sync follows.
 */
import { computed } from 'vue';
import { DEFAULT_SETTINGS } from '~/utils/settings';
import { useIdb } from '~/composables/useIdb';
import { maybeSeedDemo } from '~/composables/useDemoSeed';
import {
  activeId,
  activeProjectData,
  archivedList,
  projectList,
} from './state';
import type { Project } from './types';

async function init(idb: ReturnType<typeof useIdb>) {
  await maybeSeedDemo(idb);

  const [list, archived] = await Promise.all([
    idb.getProjectList(),
    idb.getArchivedList(),
  ]);
  projectList.value = list;
  archivedList.value = archived;
}

let collectionStarted = false;

export function startProjectCollection() {
  if (collectionStarted || !import.meta.client) return;
  collectionStarted = true;
  void init(useIdb());
}

export default function useProjectCollection() {
  const idb = useIdb();

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
      // activeProjectData will be updated by the activeId watcher in
      // useActiveProject.
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
    archivedList,
    addProject,
    closeProject,
    restoreProject,
    permanentlyDeleteProject,
    clearHistory,
    renameProject,
    reorderProjects,
    reloadProjectList,
  };
}
