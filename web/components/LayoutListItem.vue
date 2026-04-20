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

const thickness = computed(() => formatDistance(props.layout.stock.thicknessM));
const width = computed(() => formatDistance(props.layout.stock.widthM));
const length = computed(() => formatDistance(props.layout.stock.lengthM));
</script>

<template>
  <li class="flex flex-col items-center gap-4 shrink-0">
    <p class="text-center">
      <span class="font-bold text-nowrap text-teal-400">{{
        layout.stock.material
      }}</span>
      <br />
      <span class="text-xs text-nowrap text-white/40"
        >{{ thickness }} &times; {{ width }} &times; {{ length }}</span
      >
    </p>
    <div
      class="bg-black rounded relative ring-1 ring-white/20 ring-inset"
      :style="`width:${widthPx};height:${heightPx}`"
    >
      <PartListItem
        v-for="placement of layout.placements"
        :placement="placement"
      />
      <BoardRulerOverlay :layout="layout" :board-index="boardIndex" />
    </div>
  </li>
</template>
