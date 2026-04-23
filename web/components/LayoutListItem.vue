<script lang="ts" setup>
import type { BoardLayout, BoardLayoutPlacement } from 'cutlist';
import { cycleGrainLock } from '~/utils/grain';

const props = defineProps<{
  layout: BoardLayout;
  boardIndex: number;
}>();

const getPx = useGetPx();
const formatDistance = useFormatDistance();
const { activeId, updatePartGrainLock } = useProjects();

const widthPx = computed(() => getPx(props.layout.stock.widthM));
const heightPx = computed(() => getPx(props.layout.stock.lengthM));

const width = computed(() => formatDistance(props.layout.stock.widthM));
const length = computed(() => formatDistance(props.layout.stock.lengthM));

const colors = computed(() => getMaterialColor(props.layout.stock.color));

const marginPx = computed(() => {
  const m = props.layout.marginM;
  if (!m) return null;
  return getPx(m);
});

const boardStyle = computed(() =>
  [
    `width:${widthPx.value}`,
    `height:${heightPx.value}`,
    `background:${colors.value.board}`,
    `--part-color:${colors.value.part}`,
    `--part-hover:${colors.value.partHover}`,
    `--part-text:${colors.value.text}`,
    `--part-text-hover:${colors.value.textHover}`,
    `--part-grain:${colors.value.grain}`,
  ].join(';'),
);

const board = ref<HTMLDivElement>();
const hoveredIndex = ref<number | null>(null);
provide('layoutHoveredIndex', hoveredIndex);

function hitTest(e: PointerEvent): number | null {
  const el = board.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const u = (e.clientX - rect.left) / rect.width;
  const v = (e.clientY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const { widthM, lengthM } = props.layout.stock;
  const xM = u * widthM;
  const yM = (1 - v) * lengthM;
  const placements = props.layout.placements;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (
      xM >= p.leftM &&
      xM <= p.leftM + p.widthM &&
      yM >= p.bottomM &&
      yM <= p.bottomM + p.lengthM
    ) {
      return i;
    }
  }
  return null;
}

function onPointerMove(e: PointerEvent) {
  hoveredIndex.value = hitTest(e);
}

function onPointerLeave() {
  hoveredIndex.value = null;
}

const CLICK_THRESHOLD = 5;

function onPointerDown(e: PointerEvent) {
  const hit = hitTest(e);
  if (hit == null) return;
  const placement = props.layout.placements[hit];
  const startX = e.clientX;
  const startY = e.clientY;
  document.addEventListener(
    'pointerup',
    (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (Math.hypot(dx, dy) >= CLICK_THRESHOLD) return;
      if (!activeId.value) return;
      updatePartGrainLock(
        activeId.value,
        placement.partNumber,
        cycleGrainLock(placement.grainLock),
      );
    },
    { once: true },
  );
}

const hoveredPlacement = computed<BoardLayoutPlacement | null>(() =>
  hoveredIndex.value != null
    ? (props.layout.placements[hoveredIndex.value] ?? null)
    : null,
);
</script>

<template>
  <li
    class="flex flex-col items-center gap-3 shrink-0 board-li"
    :style="`contain-intrinsic-size:${widthPx} ${heightPx}`"
    :aria-label="`Board ${boardIndex + 1}: ${layout.stock.material} ${width} by ${length}`"
  >
    <span class="text-sm text-muted text-nowrap"
      >{{ width }} &times; {{ length }}</span
    >
    <div
      ref="board"
      class="rounded relative shadow-lg shadow-black/30"
      :style="boardStyle"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @pointerdown="onPointerDown"
    >
      <div
        v-if="marginPx"
        class="absolute border border-dashed border-white/25 rounded-sm pointer-events-none z-10"
        :style="{
          top: marginPx,
          left: marginPx,
          right: marginPx,
          bottom: marginPx,
        }"
      />
      <PartListItem
        v-for="(placement, i) of layout.placements"
        :key="i"
        :placement="placement"
        :index="i"
      />
      <BoardRulerOverlay :layout="layout" :board-index="boardIndex" />
    </div>
    <Teleport to="body">
      <PartDetailsTooltip
        v-if="hoveredPlacement"
        :part="hoveredPlacement"
        class="pointer-events-none"
      />
    </Teleport>
  </li>
</template>

<style scoped>
.board-li {
  content-visibility: auto;
}
</style>
