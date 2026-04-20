<script lang="ts" setup>
import type { RulerMeasurement } from '~/composables/useRulerStore';
import { PX_PER_M } from '~/composables/useGetPx';

const props = defineProps<{
  measurement: RulerMeasurement;
  boardWidthM: number;
  boardLengthM: number;
}>();

const emit = defineEmits<{
  remove: [];
  updateOffset: [offsetM: number];
}>();

const formatDistance = useFormatDistance();

const ARROW_SIZE = 6;
const EXT_OVERSHOOT = 8;

const distanceM = computed(() =>
  Math.abs(props.measurement.anchorB - props.measurement.anchorA),
);
const label = computed(() => formatDistance(distanceM.value) ?? '');
const minPx = computed(
  () =>
    Math.min(props.measurement.anchorA, props.measurement.anchorB) * PX_PER_M,
);
const maxPx = computed(
  () =>
    Math.max(props.measurement.anchorA, props.measurement.anchorB) * PX_PER_M,
);
const midPx = computed(() => (minPx.value + maxPx.value) / 2);
const offsetPx = computed(() => props.measurement.offsetM * PX_PER_M);
const isX = computed(() => props.measurement.axis === 'x');

// Arrow point helpers
function arrowH(tipX: number, y: number, direction: 1 | -1) {
  const bx = tipX - direction * ARROW_SIZE;
  return `${tipX},${y} ${bx},${y - ARROW_SIZE / 2} ${bx},${y + ARROW_SIZE / 2}`;
}
function arrowV(x: number, tipY: number, direction: 1 | -1) {
  const by = tipY - direction * ARROW_SIZE;
  return `${x},${tipY} ${x - ARROW_SIZE / 2},${by} ${x + ARROW_SIZE / 2},${by}`;
}

// --- Drag logic ---
let dragging = false;

function onPointerDown(e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  (e.target as SVGElement).closest('g')?.setPointerCapture(e.pointerId);
  dragging = true;
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  const svgEl = (e.target as SVGElement).closest('svg');
  if (!svgEl) return;
  const rect = svgEl.getBoundingClientRect();

  if (isX.value) {
    const fracY = (rect.bottom - e.clientY) / rect.height;
    const newOffsetM = fracY * props.boardLengthM;
    if (newOffsetM < -0.02 || newOffsetM > props.boardLengthM + 0.02) {
      emit('remove');
      dragging = false;
      return;
    }
    emit('updateOffset', newOffsetM);
  } else {
    const fracX = (e.clientX - rect.left) / rect.width;
    const newOffsetM = fracX * props.boardWidthM;
    if (newOffsetM < -0.02 || newOffsetM > props.boardWidthM + 0.02) {
      emit('remove');
      dragging = false;
      return;
    }
    emit('updateOffset', newOffsetM);
  }
}

function onPointerUp() {
  dragging = false;
}
</script>

<template>
  <g
    class="dimension-annotation cursor-grab active:cursor-grabbing"
    style="pointer-events: all"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <template v-if="isX">
      <!-- Extension lines (vertical from each anchor to dimension line) -->
      <line
        :x1="minPx"
        :y1="0"
        :x2="minPx"
        :y2="offsetPx + EXT_OVERSHOOT"
        stroke="currentColor"
        stroke-width="1"
        stroke-opacity="0.4"
      />
      <line
        :x1="maxPx"
        :y1="0"
        :x2="maxPx"
        :y2="offsetPx + EXT_OVERSHOOT"
        stroke="currentColor"
        stroke-width="1"
        stroke-opacity="0.4"
      />
      <!-- Dimension line -->
      <line
        :x1="minPx"
        :y1="offsetPx"
        :x2="maxPx"
        :y2="offsetPx"
        stroke="currentColor"
        stroke-width="2"
      />
      <!-- Arrowheads -->
      <polygon :points="arrowH(minPx, offsetPx, -1)" fill="currentColor" />
      <polygon :points="arrowH(maxPx, offsetPx, 1)" fill="currentColor" />
      <!-- Label (counter-flip Y so text reads correctly) -->
      <text
        :x="midPx"
        :y="offsetPx"
        text-anchor="middle"
        :transform="`scale(1,-1) translate(0,${-2 * offsetPx})`"
        dy="-6"
        fill="currentColor"
        font-size="14"
        font-family="ui-monospace, monospace"
      >
        {{ label }}
      </text>
    </template>

    <template v-else>
      <!-- Extension lines (horizontal from each anchor to dimension line) -->
      <line
        :x1="0"
        :y1="minPx"
        :x2="offsetPx + EXT_OVERSHOOT"
        :y2="minPx"
        stroke="currentColor"
        stroke-width="1"
        stroke-opacity="0.4"
      />
      <line
        :x1="0"
        :y1="maxPx"
        :x2="offsetPx + EXT_OVERSHOOT"
        :y2="maxPx"
        stroke="currentColor"
        stroke-width="1"
        stroke-opacity="0.4"
      />
      <!-- Dimension line -->
      <line
        :x1="offsetPx"
        :y1="minPx"
        :x2="offsetPx"
        :y2="maxPx"
        stroke="currentColor"
        stroke-width="2"
      />
      <!-- Arrowheads -->
      <polygon :points="arrowV(offsetPx, minPx, -1)" fill="currentColor" />
      <polygon :points="arrowV(offsetPx, maxPx, 1)" fill="currentColor" />
      <!-- Label (counter-flip Y + rotate for vertical reading) -->
      <text
        :x="offsetPx"
        :y="midPx"
        text-anchor="middle"
        :transform="`rotate(-90,${offsetPx},${midPx}) scale(1,-1) translate(0,${-2 * midPx})`"
        dy="-6"
        fill="currentColor"
        font-size="14"
        font-family="ui-monospace, monospace"
      >
        {{ label }}
      </text>
    </template>
  </g>
</template>

<style scoped>
.dimension-annotation {
  color: #10b981;
}
</style>
