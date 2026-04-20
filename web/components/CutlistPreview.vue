<script lang="ts" setup>
const { data, error } = useBoardLayoutsQuery();

const container = ref<HTMLDivElement>();
const { scale, resetZoom, zoomIn, zoomOut } = usePanZoom(container);
</script>

<template>
  <div class="relative h-full overflow-hidden">
    <!-- Cutlist Preview -->
    <div class="absolute inset-0 overflow-none flex bg-gray-950">
      <p v-if="error" class="m-auto text-red-400">{{ error }}</p>

      <template v-else-if="data">
        <p
          v-if="data.layouts.length === 0"
          class="m-auto bg-black border border-white/15 rounded p-4 text-white/50"
        >
          No board layouts found
        </p>
        <div v-else ref="container" class="canvas-plane">
          <div class="canvas-grid" />
          <LayoutList :layouts="data.layouts" />
        </div>
      </template>
    </div>

    <!-- Settings toolbar -->
    <div
      class="absolute top-3 left-3 z-10 bg-black/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2"
    >
      <PreviewToolbar />
    </div>

    <!-- Controls -->
    <div class="absolute bottom-4 right-4 flex gap-4 z-10">
      <RulerToggle class="bg-black rounded" />
      <ScaleController
        v-if="scale != null"
        class="bg-black rounded"
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
  --dot-color: rgba(255, 255, 255, 0.08);
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
