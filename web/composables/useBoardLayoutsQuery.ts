import {
  Distance,
  type BoardLayout,
  type BoardLayoutLeftover,
  type ConfigInput,
  type PartToCut,
} from 'cutlist';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import {
  cancelLayouts,
  computeLayouts,
  PART_COUNT_SOFT_LIMIT,
} from '~/composables/useComputationWorker';
import { versionedFingerprint } from '~/utils/fingerprint';
import { LAYOUT_CACHE_VERSION } from '~/utils/versions';

type LayoutResult = {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
};

interface CacheEntry extends LayoutResult {
  fingerprint: string;
}

// Module-level in-memory mirror of the IDB layout cache. Populated lazily on
// first read per project, written on every successful compute.
const layoutCache = new Map<string, CacheEntry>();

export default createSharedComposable(() => {
  const { activeProject, activeId, enabledModels, projectLoading } =
    useProjects();
  const { bladeWidth, optimize, margin, distanceUnit, stock } =
    useProjectSettings();
  const idb = useIdb();

  const parts = computed<PartToCut[] | undefined>(() => {
    const project = activeProject.value;
    const models = enabledModels.value;
    if (!project || models.length === 0) return;

    const merged: PartToCut[] = [];
    const offsets = computePartNumberOffsets(models);
    const excluded = new Set(project.excludedColors ?? []);

    for (let i = 0; i < models.length; i++) {
      for (const part of models[i].parts) {
        if (excluded.has(part.colorKey)) continue;
        merged.push({
          partNumber: part.partNumber + offsets[i],
          instanceNumber: part.instanceNumber,
          name: part.name,
          size: part.size,
          material: project.colorMap[part.colorKey] ?? 'Unknown',
          grainLock: part.grainLock,
        });
      }
    }

    return merged;
  });

  const data = shallowRef<LayoutResult | undefined>();
  const isComputing = ref(false);
  const error = ref<string | null>(null);
  /** Non-blocking warning when part count is high but below hard limit. */
  const partCountWarning = ref<string | null>(null);

  let requestVersion = 0;

  // Restore in-memory cache on project switch. Bumps requestVersion so any
  // in-flight compute from the previous project is discarded when it lands.
  // Does NOT wipe `data` on a miss — we leave the previous layout visible
  // (with an "Updating…" overlay) until the new one is ready.
  watch(activeId, (id) => {
    requestVersion++;
    cancelLayouts();
    if (!id) {
      data.value = undefined;
      isComputing.value = false;
      error.value = null;
      return;
    }
    const mem = layoutCache.get(id);
    if (mem) {
      data.value = { layouts: mem.layouts, leftovers: mem.leftovers };
    }
    isComputing.value = true;
    error.value = null;
  });

  watch(
    [parts, bladeWidth, optimize, margin, distanceUnit, stock],
    async ([partsVal, bw, opt, mg, du, st]) => {
      // Settings still hydrating → show spinner, wait for next tick.
      if (bw == null || opt == null || mg == null || du == null || st == null) {
        if (projectLoading.value || activeId.value) {
          isComputing.value = true;
        } else {
          data.value = undefined;
          isComputing.value = false;
        }
        error.value = null;
        return;
      }

      // No active project / still loading → no layout to show.
      if (partsVal == null) {
        if (projectLoading.value) {
          isComputing.value = true;
        } else {
          data.value = undefined;
          isComputing.value = false;
        }
        error.value = null;
        return;
      }

      const projectId = activeProject.value?.id;
      if (!projectId) return;

      // Empty BOM (no parts, or every part excluded) → skip the worker.
      if (partsVal.length === 0) {
        cancelLayouts();
        requestVersion++;
        data.value = { layouts: [], leftovers: [] };
        isComputing.value = false;
        error.value = null;
        return;
      }

      const config: ConfigInput = {
        bladeWidth: new Distance(bw + du).m,
        margin: new Distance(mg + du).m,
        optimize: opt === 'Auto' ? 'auto' : opt === 'Cuts' ? 'cuts' : 'cnc',
        precision: 1e-5,
      };

      const inputFp = versionedFingerprint({
        parts: partsVal,
        stock: st,
        config,
      });
      const version = ++requestVersion;

      // Cache lookup: mem first, then IDB (populating mem on the way).
      let cached = layoutCache.get(projectId);
      if (!cached) {
        try {
          const stored = await idb.getLayoutCache(projectId);
          if (version !== requestVersion) return;
          if (activeProject.value?.id !== projectId) return;
          if (stored) {
            cached = {
              layouts: stored.layouts,
              leftovers: stored.leftovers,
              fingerprint: stored.fingerprint,
            };
            layoutCache.set(projectId, cached);
          }
        } catch {
          // Cache read is advisory — fall through to compute.
        }
      }

      // Exact fingerprint match → skip the worker entirely.
      if (cached && cached.fingerprint === inputFp) {
        data.value = { layouts: cached.layouts, leftovers: cached.leftovers };
        isComputing.value = false;
        error.value = null;
        return;
      }

      isComputing.value = true;
      error.value = null;

      // Soft warning for large part counts (still proceeds with computation).
      if (partsVal.length > PART_COUNT_SOFT_LIMIT) {
        partCountWarning.value =
          `Large project (${partsVal.length} parts). ` +
          `Layout computation may take longer than usual.`;
      } else {
        partCountWarning.value = null;
      }

      // Show stale cache during recompute if nothing else is visible yet.
      if (cached && !data.value) {
        data.value = { layouts: cached.layouts, leftovers: cached.leftovers };
      }

      try {
        cancelLayouts();
        const result = await computeLayouts(partsVal, st, config);
        // Guard against a newer request (input changed or project switched).
        if (version !== requestVersion) return;
        if (activeProject.value?.id !== projectId) return;

        data.value = result;
        const entry: CacheEntry = {
          layouts: result.layouts,
          leftovers: result.leftovers,
          fingerprint: inputFp,
        };
        layoutCache.set(projectId, entry);
        idb
          .putLayoutCache({
            projectId,
            fingerprint: inputFp,
            cacheVersion: LAYOUT_CACHE_VERSION,
            layouts: result.layouts,
            leftovers: result.leftovers,
          })
          .catch(() => {});
        isComputing.value = false;
      } catch (e) {
        if (
          version === requestVersion &&
          activeProject.value?.id === projectId
        ) {
          error.value = e instanceof Error ? e.message : String(e);
          // Clear stale data so the BOM falls back to showing raw model data
          // instead of outdated packing results that may be missing parts.
          data.value = undefined;
          isComputing.value = false;
        }
      }
    },
    { immediate: true },
  );

  return {
    data,
    isComputing,
    error,
    partCountWarning,
  };
});
