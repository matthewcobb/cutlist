import type { IdbBuildStep } from '~/composables/useIdb';
import {
  nextStepNumber,
  removeStep as removeStepOrdered,
  moveStep as moveStepOrdered,
} from '~/utils/buildStepOrder';

// ─── Module-level state ───────────────────────────────────────────────────────

const buildSteps = ref<IdbBuildStep[]>([]);
let loadedForId: string | null = null;

// ─── Composable ───────────────────────────────────────────────────────────────

export default function useBuildSteps() {
  const idb = useIdb();
  const { activeId } = useProjects();

  watch(
    activeId,
    async (id) => {
      if (!id) {
        buildSteps.value = [];
        loadedForId = null;
        return;
      }
      if (id === loadedForId) return;
      buildSteps.value = await idb.getBuildSteps(id);
      loadedForId = id;
    },
    { immediate: true },
  );

  async function addStep() {
    const projectId = activeId.value;
    if (!projectId) return;
    const step: IdbBuildStep = {
      id: crypto.randomUUID(),
      projectId,
      stepNumber: nextStepNumber(buildSteps.value),
      title: '',
      description: '',
      partRefs: [],
      createdAt: new Date().toISOString(),
    };
    buildSteps.value = [...buildSteps.value, step];
    await idb.createBuildStep(step);
    return step.id;
  }

  async function updateStep(
    id: string,
    patch: Partial<Pick<IdbBuildStep, 'title' | 'description' | 'partRefs'>>,
  ) {
    buildSteps.value = buildSteps.value.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    );
    await idb.updateBuildStep(id, patch);
  }

  async function removeStep(id: string) {
    if (!buildSteps.value.find((s) => s.id === id)) return;
    const remaining = removeStepOrdered(buildSteps.value, id);
    buildSteps.value = remaining;
    await idb.deleteBuildStep(id);
    await Promise.all(
      remaining.map((s) =>
        idb.updateBuildStep(s.id, { stepNumber: s.stepNumber }),
      ),
    );
  }

  async function moveStep(id: string, direction: 'up' | 'down') {
    const renumbered = moveStepOrdered(buildSteps.value, id, direction);
    if (renumbered === buildSteps.value) return; // no-op (out of bounds)
    buildSteps.value = renumbered;
    await Promise.all(
      renumbered.map((s) =>
        idb.updateBuildStep(s.id, { stepNumber: s.stepNumber }),
      ),
    );
  }

  /** Load steps from IDB for a given projectId (used after import). */
  async function reloadSteps(projectId: string) {
    buildSteps.value = await idb.getBuildSteps(projectId);
    loadedForId = projectId;
  }

  return {
    buildSteps,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    reloadSteps,
  };
}
