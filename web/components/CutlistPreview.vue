<script lang="ts" setup>
const { data, isComputing, error } = useBoardLayoutsQuery();

const container = ref<HTMLDivElement>();
const { scale, resetZoom, zoomIn, zoomOut } = usePanZoom(container);

const formatDistance = useFormatDistance();

function stockKey(stock: {
  material: string;
  thicknessM: number;
  widthM: number;
  lengthM: number;
}) {
  return `${stock.material}__${stock.thicknessM}__${stock.widthM}__${stock.lengthM}`;
}

const stockOptions = computed(() => {
  if (!data.value) return [];
  const seen = new Set<string>();
  const options: { label: string; value: string }[] = [];
  for (const layout of data.value.layouts) {
    const key = stockKey(layout.stock);
    if (!seen.has(key)) {
      seen.add(key);
      const thickness = formatDistance(layout.stock.thicknessM);
      options.push({
        label: `${thickness} ${layout.stock.material}`,
        value: key,
      });
    }
  }
  return options;
});

const ALL = '__all__';
const selectedStock = ref(ALL);

watch(stockOptions, (opts) => {
  if (
    selectedStock.value !== ALL &&
    !opts.some((o) => o.value === selectedStock.value)
  ) {
    selectedStock.value = ALL;
  }
});

const filteredLayouts = computed(() => {
  if (!data.value) return [];
  if (selectedStock.value === ALL) return data.value.layouts;
  return data.value.layouts.filter(
    (l) => stockKey(l.stock) === selectedStock.value,
  );
});

const filteredLeftovers = computed(() => {
  if (!data.value) return [];
  const leftovers = data.value.leftovers;
  if (selectedStock.value === ALL) return leftovers;
  return leftovers.filter((l) => {
    const key = `${l.material}__${l.thicknessM}`;
    return selectedStock.value.startsWith(key);
  });
});
</script>

<template>
  <div class="relative h-full overflow-hidden">
    <!-- Cutlist Preview -->
    <div class="absolute inset-0 overflow-none flex bg-mist-900 shadow-lg">
      <p v-if="error" class="m-auto text-red-400">{{ error }}</p>

      <template v-else-if="data">
        <p
          v-if="filteredLayouts.length === 0"
          class="m-auto bg-base border border-default rounded p-4 text-muted"
        >
          No board layouts found
        </p>
        <div v-else ref="container" class="canvas-plane">
          <div class="canvas-grid" />
          <LayoutList
            :layouts="filteredLayouts"
            :leftovers="filteredLeftovers"
          />
        </div>
      </template>

      <div
        v-else-if="isComputing"
        class="m-auto flex items-center gap-2 text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="w-5 h-5 animate-spin" />
        <span class="text-sm">Computing layouts&hellip;</span>
      </div>
    </div>

    <!-- Settings toolbar -->
    <div
      class="absolute top-3 left-3 z-10 bg-overlay backdrop-blur border border-subtle rounded-lg px-3 py-2"
    >
      <PreviewToolbar />
    </div>

    <!-- Stock filter -->
    <div
      v-if="stockOptions.length > 1"
      class="absolute top-3 right-3 z-10 bg-overlay backdrop-blur border border-subtle rounded-lg px-3 py-2 flex items-center gap-2"
    >
      <label class="text-xs text-muted whitespace-nowrap">Stock</label>
      <USelect
        v-model="selectedStock"
        :items="[{ label: 'All', value: ALL }, ...stockOptions]"
        size="xs"
        class="w-36"
      />
    </div>

    <!-- Controls -->
    <div class="absolute bottom-4 right-4 flex gap-3 z-10">
      <RulerToggle
        class="bg-overlay backdrop-blur border border-subtle rounded-lg"
      />
      <ScaleController
        v-if="scale != null"
        class="bg-overlay backdrop-blur border border-subtle rounded-lg px-1"
        :scale="scale"
        @reset-zoom="resetZoom"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-plane {
  position: relative;
}

.canvas-grid {
  --dot-color: #394447;
  --dot-size: 1px;
  --dot-gap: 24px;
  position: absolute;
  inset: -300vmax;
  pointer-events: none;
  background-size: var(--dot-gap) var(--dot-gap);
  background-image: radial-gradient(
    circle,
    var(--dot-color) var(--dot-size),
    transparent var(--dot-size)
  );
}
</style>
