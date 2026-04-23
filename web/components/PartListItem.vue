<script lang="ts" setup>
import type { BoardLayoutPlacement } from 'cutlist';
import { useElementHover } from '@vueuse/core';
import { cycleGrainLock } from '~/utils/grain';

const props = defineProps<{
  placement: BoardLayoutPlacement;
}>();

const container = ref<HTMLDivElement>();
const isHovered = useElementHover(container);

const getPx = useGetPx();

const width = computed(() => getPx(props.placement.widthM));
const height = computed(() => getPx(props.placement.lengthM));
const left = computed(() => getPx(props.placement.leftM));
const bottom = computed(() => getPx(props.placement.bottomM));

const fontSize = computed(() =>
  getPx(
    Math.min(
      props.placement.widthM / 2,
      0.0254, // 1 in to m
    ),
  ),
);

/** Icon size scales with the smaller part dimension, clamped 14–28px */
const iconSize = computed(() => {
  const minDimM = Math.min(props.placement.widthM, props.placement.lengthM);
  const raw = parseFloat(getPx(minDimM * 0.45));
  return `${Math.max(14, Math.min(28, raw))}px`;
});

const { showPartNumbers } = useProjectSettings();
const { activeId, updatePartGrainLock } = useProjects();

function onClickGrainLock() {
  if (!activeId.value) return;
  updatePartGrainLock(
    activeId.value,
    props.placement.partNumber,
    cycleGrainLock(props.placement.grainLock),
  );
}

const CLICK_THRESHOLD = 5;

function onPointerDown(e: PointerEvent) {
  const startX = e.clientX;
  const startY = e.clientY;
  document.addEventListener(
    'pointerup',
    (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (Math.hypot(dx, dy) < CLICK_THRESHOLD) onClickGrainLock();
    },
    { once: true },
  );
}
</script>

<template>
  <div
    ref="container"
    class="absolute cursor-pointer group"
    :style="`bottom:${bottom};left:${left}`"
    @pointerdown="onPointerDown"
  >
    <div
      class="overflow-hidden relative rounded-xs part-piece transition-colors"
      :style="`width:${width};height:${height}`"
    >
      <p
        v-if="showPartNumbers"
        class="w-full text-clip part-number text-right p-px font-semibold"
        :style="`font-size:${fontSize};line-height:${fontSize}`"
      >
        {{ placement.partNumber }}
      </p>
      <!-- Grain lock indicator (always visible when locked) -->
      <div
        v-if="placement.grainLock"
        class="absolute bottom-0.5 left-0.5 flex items-center gap-px part-grain"
      >
        <UIcon
          :name="
            placement.grainLock === 'length'
              ? 'i-ri-arrow-up-down-line'
              : 'i-ri-arrow-left-right-line'
          "
          :style="`width:${fontSize};height:${fontSize}`"
        />
      </div>
      <!-- Rotation affordance on hover -->
      <div
        class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
      >
        <UIcon
          name="i-ri-loop-left-line"
          class="rotate-icon drop-shadow-md"
          :style="`width:${iconSize};height:${iconSize}`"
        />
      </div>
    </div>
    <Teleport to="body">
      <PartDetailsTooltip
        v-if="isHovered"
        :part="placement"
        class="pointer-events-none"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.part-piece {
  background: var(--part-color, #67787c);
}
.group:hover .part-piece {
  background: var(--part-hover, #67787c);
}
.part-number {
  color: var(--part-text, #333);
}
.group:hover .part-number {
  color: var(--part-text-hover, #111);
}
.part-grain {
  color: var(--part-grain, #555);
}
.group:hover .part-grain {
  color: var(--part-text-hover, #111);
}

.rotate-icon {
  color: var(--part-text, #333);
  animation: gentle-rock 1.8s ease-in-out infinite;
}
.group:hover .rotate-icon {
  color: var(--part-text-hover, #111);
}

@keyframes gentle-rock {
  0%,
  100% {
    transform: rotate(0deg);
  }
  40% {
    transform: rotate(35deg);
  }
  60% {
    transform: rotate(25deg);
  }
}
</style>
