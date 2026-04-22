<script lang="ts" setup>
import type { BoardLayoutPlacement } from 'cutlist';

const props = defineProps<{
  part: BoardLayoutPlacement;
}>();

const { x, y } = useGlobalMouse();
</script>

<template>
  <div
    v-if="x != 0 && y != 0"
    class="fixed w-px h-px z-50"
    :style="`left:${x}px;top:${y}px`"
  >
    <PartDetails
      class="translate-x-[-50%] translate-y-8 p-2 bg-elevated border border-default rounded shadow-xl w-max min-w-[256px] text-white"
      :part="part"
      :placement="part"
    />
  </div>
</template>
