import {
  Distance,
  type BoardLayout,
  type BoardLayoutLeftover,
  type ConfigInput,
  type PartToCut,
} from 'cutlist';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import {
  computeLayouts,
  computingProjects,
  PART_COUNT_SOFT_LIMIT,
} from '~/composables/useComputationWorker';
import { fingerprint } from '~/utils/fingerprint';
import * as layoutCache from '~/composables/boardLayoutsCache';

type LayoutResult = {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
};

const EMPTY_RESULT: LayoutResult = { layouts: [], leftovers: [] };

/**
 * Reactive derivation of cut-layout results for the active project.
 *
 * The worker is fire-and-forget: results land in `layoutCache` keyed by
 * projectId regardless of which project is currently active. `data`,
 * `isComputing`, `error` and `partCountWarning` are pure computeds over the
 * active project id, the cache and the worker's `computingProjects` set.
 * One watcher dispatches new computations when inputs change — no cancel,
 * no project-switch watcher, no navigation guards.
 */
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

  /** Fully-hydrated worker inputs for the active project, or undefined. */
  const activeInputs = computed(() => {
    const pid = activeId.value;
    const partsVal = parts.value;
    const bw = bladeWidth.value;
    const opt = optimize.value;
    const mg = margin.value;
    const du = distanceUnit.value;
    const st = stock.value;
    if (!pid || partsVal == null) return undefined;
    if (bw == null || opt == null || mg == null || du == null || st == null) {
      return undefined;
    }
    const config: ConfigInput = {
      bladeWidth: new Distance(bw + du).m,
      margin: new Distance(mg + du).m,
      optimize: opt === 'Auto' ? 'auto' : 'cnc',
      precision: 1e-5,
    };
    return {
      projectId: pid,
      parts: partsVal,
      stock: st,
      config,
      fingerprint: fingerprint({ parts: partsVal, stock: st, config }),
    };
  });

  const errorByProject = shallowRef(new Map<string, string>());

  function setError(pid: string, msg: string | null): void {
    const has = errorByProject.value.has(pid);
    if (msg == null && !has) return;
    const next = new Map(errorByProject.value);
    if (msg == null) next.delete(pid);
    else next.set(pid, msg);
    errorByProject.value = next;
  }

  const data = computed<LayoutResult | undefined>(() => {
    const pid = activeId.value;
    if (!pid) return undefined;

    const cached = layoutCache.get(pid);
    if (cached) return { layouts: cached.layouts, leftovers: cached.leftovers };

    // Project fully loaded but nothing to pack (no enabled models, or every
    // part excluded). Synthesise an empty result so the UI can render an
    // empty state instead of spinning forever.
    const project = activeProject.value;
    if (project && !projectLoading.value) {
      const partsVal = parts.value;
      if (partsVal == null || partsVal.length === 0) return EMPTY_RESULT;
    }

    return undefined;
  });

  const isComputing = computed(() => {
    const pid = activeId.value;
    if (!pid) return false;
    if (computingProjects.value.has(pid)) return true;
    // No active project record yet → still hydrating.
    return projectLoading.value || !activeProject.value;
  });

  const error = computed<string | null>(() => {
    const pid = activeId.value;
    if (!pid) return null;
    return errorByProject.value.get(pid) ?? null;
  });

  const partCountWarning = computed<string | null>(() => {
    const inputs = activeInputs.value;
    if (!inputs || inputs.parts.length <= PART_COUNT_SOFT_LIMIT) return null;
    return (
      `Large project (${inputs.parts.length} parts). ` +
      `Layout computation may take longer than usual.`
    );
  });

  watch(
    activeInputs,
    (inputs) => {
      if (!inputs) return;
      const { projectId, fingerprint: fp } = inputs;

      const cached = layoutCache.get(projectId);
      if (cached?.fingerprint === fp) return;

      setError(projectId, null);

      computeLayouts(projectId, inputs.parts, inputs.stock, inputs.config)
        .then((result) => {
          layoutCache.set(projectId, {
            layouts: result.layouts,
            leftovers: result.leftovers,
            fingerprint: fp,
          });
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setError(projectId, err.message || String(err));
          // Drop any stale cache so BOM falls back to raw model data.
          layoutCache.remove(projectId);
        });
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
