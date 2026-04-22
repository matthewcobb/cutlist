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
      <span class="text-xl font-bold text-nowrap text-teal-400">{{
        layout.stock.material
      }}</span>
      <br />
      <span class="text-base text-nowrap text-muted"
        >{{ thickness }} &times; {{ width }} &times; {{ length }}</span
      >
    </p>
    <div
      class="bg-mist-700 rounded relative shadow-lg shadow-black/30"
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
