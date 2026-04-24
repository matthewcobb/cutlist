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
import { fingerprint } from '~/utils/fingerprint';
import * as layoutCache from '~/composables/boardLayoutsCache';

type LayoutResult = {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
};

export default createSharedComposable(() => {
  const { activeProject, activeId, enabledModels, projectLoading } =
    useProjects();
  const { bladeWidth, optimize, margin, distanceUnit, stock } =
    useProjectSettings();

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

      const inputFp = fingerprint({
        parts: partsVal,
        stock: st,
        config,
      });
      const version = ++requestVersion;

      const cached = layoutCache.get(projectId);
      const status = layoutCache.classify(cached, inputFp);

      // Exact fingerprint match → skip the worker entirely.
      if (status === 'hit' && cached) {
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
      if (status === 'stale' && cached && !data.value) {
        data.value = { layouts: cached.layouts, leftovers: cached.leftovers };
      }

      try {
        cancelLayouts();
        const result = await computeLayouts(partsVal, st, config);
        // Guard against a newer request (input changed or project switched).
        if (version !== requestVersion) return;
        if (activeProject.value?.id !== projectId) return;

        data.value = result;
        layoutCache.set(projectId, {
          layouts: result.layouts,
          leftovers: result.leftovers,
          fingerprint: inputFp,
        });
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
