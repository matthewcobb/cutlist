<script lang="ts" setup>
import type { BoardLayoutLeftover } from 'cutlist';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    showOpenButton?: boolean;
  }>(),
  {
    compact: false,
    showOpenButton: false,
  },
);
const emit = defineEmits<{
  expand: [];
}>();

const { activeId, enabledModels: allEnabledModels } = useProjects();
const enabledModels = computed(() =>
  allEnabledModels.value.filter((m) => m.source !== 'manual'),
);
const { data: boardLayouts } = useBoardLayoutsQuery();
const store = useModelViewerStore();
const formatDistance = useFormatDistance();
const idb = useIdb();

const canvasContainer = ref<HTMLElement>();
const viewer = useThreeViewer(canvasContainer);

// Model switcher — always show exactly one model
const focusedModelIdx = ref(0);

watch(activeId, () => {
  focusedModelIdx.value = 0;
});

watch(
  () => enabledModels.value.length,
  (newLen) => {
    if (focusedModelIdx.value >= newLen)
      focusedModelIdx.value = Math.max(0, newLen - 1);
  },
);

const displayModels = computed(() => {
  const m = enabledModels.value[focusedModelIdx.value];
  return m ? [m] : enabledModels.value;
});

const hasGltfData = computed(() =>
  enabledModels.value.some((m) => m.source === 'gltf'),
);

const hasOnlyManualModels = computed(
  () =>
    enabledModels.value.length > 0 &&
    enabledModels.value.every((m) => m.source === 'manual'),
);

const allGltfData = ref<Map<string, object> | null>(null);

async function loadGltfData() {
  if (!activeId.value || displayModels.value.length === 0) {
    allGltfData.value = null;
    return;
  }
  const entries = await Promise.all(
    displayModels.value.map(async (m) => {
      const gltfJson = await idb.getModelGltf(m.id);
      return [m.id, gltfJson] as const;
    }),
  );
  allGltfData.value = new Map(
    entries.filter(([, json]) => json != null) as [string, object][],
  );
}

watch(
  [activeId, () => displayModels.value.map((m) => m.id).join(',')],
  loadGltfData,
  { immediate: true },
);

function loadAllModels() {
  const data = allGltfData.value;
  if (!data || !viewer.ready.value) return;

  viewer.clearModels();

  // Use offsets from ALL enabled models so part numbers stay consistent with BOM
  const allOffsets = computePartNumberOffsets(enabledModels.value);
  const models = displayModels.value;

  for (const model of models) {
    const modelIdx = enabledModels.value.findIndex((m) => m.id === model.id);
    const offset = modelIdx >= 0 ? allOffsets[modelIdx] : 0;
    const gltfJson = data.get(model.id);
    if (gltfJson && model.nodePartMap) {
      viewer.loadModel(gltfJson, model.nodePartMap, offset);
    }
  }
}

watch(allGltfData, loadAllModels);
watch(
  () => viewer.ready.value,
  (isReady) => {
    if (isReady) loadAllModels();
  },
);

function findPart(partNum: number | null): BoardLayoutLeftover | undefined {
  if (partNum == null || !boardLayouts.value) return;
  return [
    ...boardLayouts.value.layouts.flatMap((l) => l.placements),
    ...boardLayouts.value.leftovers,
  ].find((p) => p.partNumber === partNum);
}

const infoPart = computed(
  () =>
    findPart(store.selectedPartNumber.value) ??
    findPart(store.hoveredPartNumber.value),
);
</script>

<template>
  <ClientOnly>
    <div class="relative h-full overflow-hidden">
      <!-- 3D Canvas -->
      <div ref="canvasContainer" class="absolute inset-0 bg-mist-950" />

      <!-- Empty state: no models -->
      <div
        v-if="enabledModels.length === 0"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="bg-base border border-default rounded p-4 text-muted">
          Import a model in the BOM tab to view it in 3D.
        </p>
      </div>

      <!-- Empty state: only manual parts, no GLTF -->
      <div
        v-else-if="hasOnlyManualModels"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="bg-base border border-default rounded p-4 text-muted">
          Parts were added manually — no 3D model to view.
        </p>
      </div>

      <!-- Empty state: models exist but no GLTF stored (pre-feature import) -->
      <div
        v-else-if="!hasGltfData"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="bg-base border border-default rounded p-4 text-muted">
          Re-import your model to enable 3D preview.
        </p>
      </div>

      <!-- Model switcher (only when multiple enabled models) -->
      <div v-if="enabledModels.length > 1" class="absolute top-4 left-4 z-10">
        <select
          :value="focusedModelIdx === null ? '' : String(focusedModelIdx)"
          class="model-select bg-overlay backdrop-blur border border-subtle rounded-lg px-3 py-2 text-sm text-body hover:text-hi cursor-pointer appearance-none pr-8 focus:outline-none focus:border-default"
          @change="
            (e) => {
              focusedModelIdx = Number((e.target as HTMLSelectElement).value);
            }
          "
        >
          <option
            v-for="(m, i) in enabledModels"
            :key="m.id"
            :value="String(i)"
            style="background: #161b1d; color: #e3e7e8"
          >
            {{ m.filename }}
          </option>
        </select>
      </div>

      <div
        v-if="props.showOpenButton"
        class="absolute top-4 right-4 z-10 bg-overlay backdrop-blur border border-subtle rounded-lg p-1"
      >
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-expand"
          label="Open model view"
          @click="emit('expand')"
        />
      </div>

      <!-- Part info panel -->
      <div
        v-if="infoPart"
        class="absolute bottom-4 left-4 z-10 bg-overlay backdrop-blur border border-subtle rounded-lg p-3 min-w-[200px]"
      >
        <p class="text-teal-400 font-bold text-lg mb-1">
          #{{ infoPart.partNumber }} {{ infoPart.name }}
        </p>
        <table class="text-sm text-body">
          <tbody>
            <tr>
              <td class="pr-3 text-muted">Width</td>
              <td>{{ formatDistance(infoPart.widthM) }}</td>
            </tr>
            <tr>
              <td class="pr-3 text-muted">Length</td>
              <td>{{ formatDistance(infoPart.lengthM) }}</td>
            </tr>
            <tr>
              <td class="pr-3 text-muted">Thickness</td>
              <td>
                {{ formatDistance(infoPart.thicknessM) }}
              </td>
            </tr>
            <tr>
              <td class="pr-3 text-muted">Material</td>
              <td>{{ infoPart.material }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bottom-right controls -->
      <div
        v-if="!props.compact"
        class="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2"
      >
        <!-- Mouse controls legend -->
        <div
          class="bg-overlay backdrop-blur border border-subtle rounded-lg px-3 py-2.5 flex flex-col gap-2"
        >
          <!-- Left drag → Orbit -->
          <div class="flex items-center gap-2.5">
            <svg
              width="18"
              height="24"
              viewBox="0 0 18 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="shrink-0 text-muted"
            >
              <rect
                x="1"
                y="5"
                width="16"
                height="18"
                rx="8"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <path
                d="M1 13h7V5a8 8 0 0 0-7 8Z"
                fill="currentColor"
                fill-opacity="0.5"
              />
              <line
                x1="9"
                y1="5"
                x2="9"
                y2="13"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <rect
                x="7"
                y="8"
                width="4"
                height="5"
                rx="2"
                fill="currentColor"
                fill-opacity="0.3"
              />
            </svg>
            <span class="text-xs text-muted">Drag</span>
            <span class="text-xs text-body ml-auto pl-3">Orbit</span>
          </div>
          <!-- Scroll → Zoom -->
          <div class="flex items-center gap-2.5">
            <svg
              width="18"
              height="24"
              viewBox="0 0 18 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="shrink-0 text-muted"
            >
              <rect
                x="1"
                y="5"
                width="16"
                height="18"
                rx="8"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <line
                x1="9"
                y1="5"
                x2="9"
                y2="13"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <rect
                x="7"
                y="8"
                width="4"
                height="5"
                rx="2"
                fill="currentColor"
              />
            </svg>
            <span class="text-xs text-muted">Scroll</span>
            <span class="text-xs text-body ml-auto pl-3">Zoom</span>
          </div>
          <!-- Right drag → Pan -->
          <div class="flex items-center gap-2.5">
            <svg
              width="18"
              height="24"
              viewBox="0 0 18 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="shrink-0 text-muted"
            >
              <rect
                x="1"
                y="5"
                width="16"
                height="18"
                rx="8"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <path
                d="M17 13H9V5a8 8 0 0 1 8 8Z"
                fill="currentColor"
                fill-opacity="0.5"
              />
              <line
                x1="9"
                y1="5"
                x2="9"
                y2="13"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <rect
                x="7"
                y="8"
                width="4"
                height="5"
                rx="2"
                fill="currentColor"
                fill-opacity="0.3"
              />
            </svg>
            <span class="text-xs text-muted">Drag</span>
            <span class="text-xs text-body ml-auto pl-3">Pan</span>
          </div>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.model-select {
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca8ab' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
</style>
