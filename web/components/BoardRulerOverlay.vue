<script lang="ts" setup>
import type { BoardLayout } from 'cutlist';
import type { SnapEdge } from '~/composables/useRulerStore';
import { PX_PER_M } from '~/composables/useGetPx';

const props = defineProps<{
  layout: BoardLayout;
  boardIndex: number;
}>();

const {
  isRulerActive,
  pendingClick,
  startMeasurement,
  completeMeasurement,
  removeMeasurement,
  updateMeasurementOffset,
  getMeasurementsForBoard,
} = useRulerStore();

const snapEdges = useSnapEdges(
  () => props.layout,
  () => props.boardIndex,
);
const boardMeasurements = getMeasurementsForBoard(props.boardIndex);

const widthM = computed(() => props.layout.stock.widthM);
const lengthM = computed(() => props.layout.stock.lengthM);
const widthPx = computed(() => widthM.value * PX_PER_M);
const heightPx = computed(() => lengthM.value * PX_PER_M);

const SNAP_THRESHOLD_PX = 15;

function findNearestEdge(
  xM: number,
  yM: number,
  edges: SnapEdge[],
  thresholdM: number,
): SnapEdge | null {
  let best: SnapEdge | null = null;
  let bestDist = Infinity;
  for (const edge of edges) {
    const dist =
      edge.axis === 'x'
        ? Math.abs(xM - edge.positionM)
        : Math.abs(yM - edge.positionM);
    if (dist < bestDist && dist < thresholdM) {
      bestDist = dist;
      best = edge;
    }
  }
  return best;
}

function handleBoardClick(event: MouseEvent) {
  if (!isRulerActive.value) return;

  const el = event.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const fracX = (event.clientX - rect.left) / rect.width;
  const fracY = (rect.bottom - event.clientY) / rect.height;
  const xM = fracX * widthM.value;
  const yM = fracY * lengthM.value;

  const thresholdM = SNAP_THRESHOLD_PX / (rect.width / widthM.value);
  const nearest = findNearestEdge(xM, yM, snapEdges.value, thresholdM);
  if (!nearest) return;

  if (!pendingClick.value) {
    startMeasurement(nearest);
  } else {
    const defaultOffset = nearest.axis === 'x' ? yM : xM;
    completeMeasurement(nearest, defaultOffset);
  }
}
</script>

<template>
  <svg
    class="absolute inset-0 overflow-visible z-10"
    :class="{
      'pointer-events-none': !isRulerActive && boardMeasurements.length === 0,
    }"
    :style="
      isRulerActive ? 'pointer-events: all; cursor: crosshair' : undefined
    "
    :width="widthPx"
    :height="heightPx"
    :viewBox="`0 0 ${widthPx} ${heightPx}`"
    @mousedown.stop
    @click.stop="handleBoardClick"
  >
    <!-- Transparent hit area so clicks register on empty space -->
    <rect
      v-if="isRulerActive"
      x="0"
      y="0"
      :width="widthPx"
      :height="heightPx"
      fill="transparent"
    />
    <g :transform="`scale(1,-1) translate(0,-${heightPx})`">
      <!-- Pending first-click guide line -->
      <template v-if="pendingClick && pendingClick.boardIndex === boardIndex">
        <line
          v-if="pendingClick.edge.axis === 'x'"
          :x1="pendingClick.edge.positionM * PX_PER_M"
          y1="0"
          :x2="pendingClick.edge.positionM * PX_PER_M"
          :y2="heightPx"
          stroke="#10b981"
          stroke-width="2"
          stroke-dasharray="6,4"
          class="pointer-events-none"
        />
        <line
          v-else
          x1="0"
          :y1="pendingClick.edge.positionM * PX_PER_M"
          :x2="widthPx"
          :y2="pendingClick.edge.positionM * PX_PER_M"
          stroke="#10b981"
          stroke-width="2"
          stroke-dasharray="6,4"
          class="pointer-events-none"
        />
      </template>

      <!-- Dimension annotations -->
      <DimensionAnnotation
        v-for="m in boardMeasurements"
        :key="m.id"
        :measurement="m"
        :board-width-m="widthM"
        :board-length-m="lengthM"
        @remove="removeMeasurement(m.id)"
        @update-offset="(offset) => updateMeasurementOffset(m.id, offset)"
      />
    </g>
  </svg>
</template>
