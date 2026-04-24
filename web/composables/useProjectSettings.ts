/**
 * Per-project packing settings backed by the active project record in IDB.
 *
 * Each setting is a writable computed that reads `activeProject.value?.<field>`
 * and routes writes through a shared debounced writer so rapid edits (e.g.
 * dragging a number input) collapse into a single `idb.updateProject` call.
 * Local reactive state is updated synchronously via `patchActiveProject` so
 * the UI sees the new value on the next tick, even before persistence lands.
 */

import type { IdbProject } from '~/composables/useIdb';

const DEBOUNCE_MS = 300;

// Pending patches keyed by project id, so edits made against one project
// while the user navigates away still persist against the original project.
const pendingPatches = new Map<string, Partial<IdbProject>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushPending(idb: ReturnType<typeof useIdb>) {
  flushTimer = null;
  const entries = [...pendingPatches.entries()];
  pendingPatches.clear();
  for (const [id, patch] of entries) {
    try {
      await idb.updateProject(id, patch);
    } catch (err) {
      console.error('[useProjectSettings] updateProject failed', err);
    }
  }
}

function scheduleFlush(idb: ReturnType<typeof useIdb>) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushPending(idb);
  }, DEBOUNCE_MS);
}

// Best-effort flush when the user closes the tab mid-debounce. IDB writes
// issued synchronously from the handler are held open by the browser long
// enough to complete in practice; worst case they're dropped, which matches
// pre-unload-handler behaviour.
if (import.meta.client) {
  window.addEventListener('beforeunload', () => {
    if (!flushTimer) return;
    clearTimeout(flushTimer);
    flushTimer = null;
    void flushPending(useIdb());
  });
}

export default createSharedComposable(() => {
  const { activeProject, patchActiveProject } = useProjects();
  const idb = useIdb();

  const isLoading = computed(() => activeProject.value === undefined);

  function queueWrite(patch: Partial<IdbProject>) {
    const project = activeProject.value;
    if (!project) return;
    patchActiveProject(patch);
    const pending = pendingPatches.get(project.id) ?? {};
    Object.assign(pending, patch);
    pendingPatches.set(project.id, pending);
    scheduleFlush(idb);
  }

  const bladeWidth = computed<number | undefined>({
    get: () => activeProject.value?.bladeWidth,
    set: (value) => {
      if (value == null) return;
      queueWrite({ bladeWidth: value });
    },
  });

  const margin = computed<number | undefined>({
    get: () => activeProject.value?.margin,
    set: (value) => {
      if (value == null) return;
      queueWrite({ margin: value });
    },
  });

  const optimize = computed<'Auto' | 'CNC' | undefined>({
    get: () => activeProject.value?.optimize,
    set: (value) => {
      if (value == null) return;
      queueWrite({ optimize: value });
    },
  });

  const showPartNumbers = computed<boolean | undefined>({
    get: () => activeProject.value?.showPartNumbers,
    set: (value) => {
      if (value == null) return;
      queueWrite({ showPartNumbers: value });
    },
  });

  const stock = computed<string | undefined>({
    get: () => activeProject.value?.stock,
    set: (value) => {
      if (value == null) return;
      queueWrite({ stock: value });
    },
  });

  const distanceUnit = computed<'in' | 'mm' | undefined>({
    get: () => activeProject.value?.distanceUnit,
    set: (value) => {
      if (value == null) return;
      queueWrite({ distanceUnit: value });
    },
  });

  return {
    bladeWidth,
    margin,
    optimize,
    showPartNumbers,
    stock,
    distanceUnit,
    isLoading,
  };
});
