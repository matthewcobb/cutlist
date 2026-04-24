<script lang="ts" setup>
import type { BoardLayoutPlacement } from 'cutlist';

const props = defineProps<{
  placement: BoardLayoutPlacement;
  index: number;
}>();

const hoveredIndex = inject<Ref<number | null>>(
  'layoutHoveredIndex',
  ref(null),
);
const isHovered = computed(() => hoveredIndex.value === props.index);

const toggleGrainLock = inject<(index: number) => void>(
  'layoutToggleGrainLock',
  () => {},
);

function onKeyActivate() {
  toggleGrainLock(props.index);
}

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
</script>

<template>
  <div
    class="absolute cursor-pointer"
    :class="{ 'is-hovered': isHovered }"
    :style="`bottom:${bottom};left:${left}`"
    role="button"
    tabindex="0"
    :aria-label="`Part ${placement.partNumber}: ${placement.name}`"
    @keydown.enter.prevent="onKeyActivate"
    @keydown.space.prevent="onKeyActivate"
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
        <svg
          viewBox="0 0 24 24"
          :style="`width:${fontSize};height:${fontSize}`"
          aria-hidden="true"
        >
          <path
            v-if="placement.grainLock === 'length'"
            fill="currentColor"
            d="m11.95 7.95l-1.414 1.414L8 6.828V20H6V6.828L3.466 9.364L2.05 7.95L7 3zm10 8.1L17 21l-4.95-4.95l1.414-1.414l2.537 2.536L16 4h2v13.172l2.536-2.536z"
          />
          <path
            v-else
            fill="currentColor"
            d="M16.05 12.05L21 17l-4.95 4.95l-1.414-1.415L17.172 18H4v-2h13.172l-2.536-2.535zm-8.1-10l1.414 1.414l-2.536 2.535H20v2H6.828l2.536 2.536L7.95 11.95L3 7z"
          />
        </svg>
      </div>
      <!-- Rotation affordance on hover -->
      <div
        v-if="isHovered"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <svg
          viewBox="0 0 24 24"
          class="rotate-icon"
          :style="`width:${iconSize};height:${iconSize}`"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 4a7.99 7.99 0 0 0-6.616 3.5H8v2H2v-6h2V6a9.98 9.98 0 0 1 8-4c5.523 0 10 4.477 10 10h-2a8 8 0 0 0-8-8m-8 8a8 8 0 0 0 14.616 4.5H16v-2h6v6h-2V18a9.98 9.98 0 0 1-8 4C6.477 22 2 17.523 2 12z"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.part-piece {
  background: var(--part-color, #67787c);
}
.is-hovered .part-piece {
  background: var(--part-hover, #67787c);
}
.part-number {
  color: var(--part-text, #333);
}
.is-hovered .part-number {
  color: var(--part-text-hover, #111);
}
.part-grain {
  color: var(--part-grain, #555);
}
.is-hovered .part-grain {
  color: var(--part-text-hover, #111);
}

.rotate-icon {
  color: var(--part-text-hover, #111);
  animation: gentle-rock 1.8s ease-in-out infinite;
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
