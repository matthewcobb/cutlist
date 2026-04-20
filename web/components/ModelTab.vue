<script lang="ts" setup>
import type { BoardLayoutLeftover } from 'cutlist';
import { useQuery } from '@tanstack/vue-query';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';

const { activeId, enabledModels } = useProjects();
const { data: boardLayouts } = useBoardLayoutsQuery();
const store = useModelViewerStore();
const { distanceUnit } = useProjectSettings();
const formatDistance = useFormatDistance();

const canvasContainer = ref<HTMLElement>();
const viewer = useThreeViewer(canvasContainer);

// Check if any enabled model has gltfJson stored (via nodePartMap presence)
const hasGltfData = computed(() =>
  enabledModels.value.some((m) => m.nodePartMap && m.nodePartMap.length > 0),
);

const { data: allGltfData } = useQuery({
  queryKey: computed(() => [
    'model-gltf-all',
    activeId.value,
    enabledModels.value.map((m) => m.id).join(','),
  ]),
  queryFn: async () => {
    const results = await Promise.all(
      enabledModels.value.map((model) =>
        $fetch<{
          gltfJson: object | null;
          nodePartMap: { nodeIndex: number; partNumber: number }[] | null;
        }>(`/api/projects/${activeId.value}/models/${model.id}/gltf`),
      ),
    );
    return results.map((r, i) => ({
      modelId: enabledModels.value[i].id,
      ...r,
    }));
  },
  enabled: computed(
    () => activeId.value != null && enabledModels.value.length > 0,
  ),
});

function loadAllModels() {
  const data = allGltfData.value;
  if (!data || !viewer.ready.value) return;

  viewer.clearModels();

  const models = enabledModels.value;
  const offsets = computePartNumberOffsets(models);

  for (let i = 0; i < models.length; i++) {
    const gltfData = data.find((d) => d.modelId === models[i].id);
    if (gltfData?.gltfJson && gltfData.nodePartMap) {
      viewer.loadModel(gltfData.gltfJson, gltfData.nodePartMap, offsets[i]);
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
      <div ref="canvasContainer" class="absolute inset-0 bg-gray-950" />

      <!-- Empty state: no models -->
      <div
        v-if="enabledModels.length === 0"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="bg-black border border-white/15 rounded p-4 text-white/50">
          Import a model in the BOM tab to view it in 3D.
        </p>
      </div>

      <!-- Empty state: models exist but no GLTF stored (pre-feature import) -->
      <div
        v-else-if="!hasGltfData"
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="bg-black border border-white/15 rounded p-4 text-white/50">
          Re-import your model to enable 3D preview.
        </p>
      </div>

      <!-- Part info panel -->
      <div
        v-if="infoPart"
        class="absolute bottom-4 left-4 z-10 bg-black/90 backdrop-blur border border-white/10 rounded-lg p-3 min-w-[200px]"
      >
        <p class="text-teal-400 font-bold text-lg mb-1">
          #{{ infoPart.partNumber }} {{ infoPart.name }}
        </p>
        <table class="text-sm text-white/70">
          <tr>
            <td class="pr-3 text-white/40">Width</td>
            <td>{{ formatDistance(infoPart.widthM) }} {{ distanceUnit }}</td>
          </tr>
          <tr>
            <td class="pr-3 text-white/40">Length</td>
            <td>{{ formatDistance(infoPart.lengthM) }} {{ distanceUnit }}</td>
          </tr>
          <tr>
            <td class="pr-3 text-white/40">Thickness</td>
            <td>
              {{ formatDistance(infoPart.thicknessM) }} {{ distanceUnit }}
            </td>
          </tr>
          <tr>
            <td class="pr-3 text-white/40">Material</td>
            <td>{{ infoPart.material }}</td>
          </tr>
        </table>
      </div>

      <!-- Controls -->
      <div class="absolute bottom-4 right-4 z-10">
        <button
          class="bg-black/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-white/70 hover:text-white text-sm"
          title="Reset camera"
          @click="viewer.fitCamera()"
        >
          <span class="i-heroicons-arrow-path w-4 h-4 inline-block" />
        </button>
      </div>
    </div>
  </ClientOnly>
</template>
