<script lang="ts" setup>
import type { BoardLayout } from 'cutlist';
import { Distance } from 'cutlist';

defineProps<{
  layouts: BoardLayout[];
}>();

const gap = useGetPx()(new Distance('4 in').m);
</script>

<template>
  <ul class="flex m-16" :style="`gap:${gap}`">
    <LayoutListItem
      v-for="(layout, index) of layouts"
      :layout="layout"
      :board-index="index"
    />
  </ul>
</template>
