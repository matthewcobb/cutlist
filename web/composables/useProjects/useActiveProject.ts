/**
 * Active project state and hydration.
 *
 * Owns the `activeId` watcher that loads the active project from IndexedDB
 * via `loadProject`. Exposes the read-only `activeProject` plus derived
 * accessors (`enabledModels`, `manualModel`, `allColors`) and
 * `patchActiveProject` for in-place reactive mutations.
 */
import { computed, watch } from 'vue';
import type { ColorInfo } from '~/utils/modelTypes';
import type { IdbProject } from '~/composables/useIdb';
import { useIdb } from '~/composables/useIdb';
import { loadProject } from '~/composables/useModelHydration';
import { activeId, activeProjectData, projectLoading } from './state';

let watcherStarted = false;

export function startActiveProjectWatcher() {
  if (watcherStarted || !import.meta.client) return;
  watcherStarted = true;

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
}

export default function useActiveProject() {
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

  return {
    activeId,
    activeProject,
    projectLoading,
    enabledModels,
    manualModel,
    allColors,
    patchActiveProject,
  };
}
