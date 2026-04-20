<script lang="ts" setup>
import type { BoardLayoutLeftover } from 'cutlist';

const props = defineProps<{
  part: BoardLayoutLeftover;
}>();
const formatDistance = useFormatDistance();

const width = computed(() => formatDistance(props.part.widthM));
const length = computed(() => formatDistance(props.part.lengthM));
const thickness = computed(() => formatDistance(props.part.thicknessM));
</script>

<template>
  <li>
    <span class="text-teal-400 font-semibold"
      >{{ part.partNumber }}.{{ part.instanceNumber }} {{ part.name }}</span
    >
    <span class="text-white/70"> &bull; No suitable board found.</span>

    <br />
    <span class="text-white/40">Material: {{ part.material }}</span>
    <br />
    <span class="text-white/40"
      >Size: {{ thickness }} &times; {{ width }} &times; {{ length }}</span
    >
  </li>
</template>
