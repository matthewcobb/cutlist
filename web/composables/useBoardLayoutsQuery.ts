import {
  Distance,
  type BoardLayout,
  type BoardLayoutLeftover,
  type ConfigInput,
  type PartToCut,
} from 'cutlist';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { computeLayouts } from '~/composables/useComputationWorker';

type LayoutResult = {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
};

// Module-level cache: show the last result for a project while the worker
// recomputes. Keyed by project ID — always overwritten when the worker
// finishes, so it's stale-while-revalidate, not a source of truth.
const layoutCache = new Map<string, LayoutResult>();

export default function () {
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

  let requestVersion = 0;

  // Restore cached layouts immediately when the active project changes,
  // before parts/settings have had a chance to populate. This prevents
  // the blank flash during project switching.
  watch(activeId, (id) => {
    if (!id) {
      data.value = undefined;
      isComputing.value = false;
      return;
    }
    const cached = layoutCache.get(id);
    if (cached) {
      data.value = cached;
      isComputing.value = true;
    } else {
      data.value = undefined;
      isComputing.value = true;
    }
  });

  watch(
    [parts, bladeWidth, optimize, margin, distanceUnit, stock],
    async ([partsVal, bw, opt, mg, du, st]) => {
      if (
        partsVal == null ||
        bw == null ||
        opt == null ||
        mg == null ||
        du == null ||
        st == null
      ) {
        // Don't clear data while the project is loading — keep showing
        // cached layouts or the previous result until the new one arrives.
        if (projectLoading.value || activeId.value) {
          isComputing.value = true;
        } else {
          data.value = undefined;
          isComputing.value = false;
        }
        error.value = null;
        return;
      }

      const projectId = activeProject.value?.id;
      const version = ++requestVersion;
      isComputing.value = true;
      error.value = null;

      // Show cached result while the worker recomputes
      if (projectId && !data.value) {
        const cached = layoutCache.get(projectId);
        if (cached) data.value = cached;
      }

      const config: ConfigInput = {
        bladeWidth: new Distance(bw + du).m,
        margin: new Distance(mg + du).m,
        optimize: opt === 'Auto' ? 'auto' : opt === 'Cuts' ? 'cuts' : 'cnc',
        precision: 1e-5,
      };

      try {
        const result = await computeLayouts(partsVal, st, config);
        // Only apply if this is still the latest request
        if (version === requestVersion) {
          data.value = result;
          if (projectId) layoutCache.set(projectId, result);
          isComputing.value = false;
        }
      } catch (e) {
        if (version === requestVersion) {
          error.value = e instanceof Error ? e.message : String(e);
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
  };
}
