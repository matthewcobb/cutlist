<script lang="ts" setup>
import { type BoardLayout } from 'cutlist';

const props = defineProps<{
  layout: BoardLayout;
  boardIndex: number;
}>();

const getPx = useGetPx();
const formatDistance = useFormatDistance();

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
</script>

<template>
  <li class="flex flex-col items-center gap-3 shrink-0">
    <span class="text-sm text-muted text-nowrap"
      >{{ width }} &times; {{ length }}</span
    >
    <div class="rounded relative shadow-lg shadow-black/30" :style="boardStyle">
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
        v-for="placement of layout.placements"
        :placement="placement"
      />
      <BoardRulerOverlay :layout="layout" :board-index="boardIndex" />
    </div>
  </li>
</template>
