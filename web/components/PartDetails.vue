<script lang="ts" setup>
import type { BoardLayoutLeftover, BoardLayoutPlacement } from 'cutlist';

const props = defineProps<{
  part: BoardLayoutLeftover;
  placement?: BoardLayoutPlacement;
}>();

const formatDistance = useFormatDistance();

const width = computed(() => formatDistance(props.part.widthM));
const length = computed(() => formatDistance(props.part.lengthM));
const thickness = computed(() => formatDistance(props.part.thicknessM));

const top = computed(() => formatDistance(props.placement?.topM));
const left = computed(() => formatDistance(props.placement?.leftM));
const right = computed(() => formatDistance(props.placement?.rightM));
const bottom = computed(() => formatDistance(props.placement?.bottomM));
</script>

<template>
  <div>
    <h3 class="text-lg text-primary">
      {{ part.partNumber }}.{{ part.instanceNumber }} {{ part.name }}
    </h3>
    <table class="font-mono">
      <tr>
        <td class="text-white/40">Width</td>
        <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
        <td>{{ width }}</td>
      </tr>
      <tr>
        <td class="text-white/40">Length</td>
        <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
        <td>{{ length }}</td>
      </tr>
      <tr>
        <td class="text-white/40">Thick</td>
        <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
        <td>{{ thickness }}</td>
      </tr>
      <template v-if="placement">
        <tr>
          <td class="text-white/40">Left</td>
          <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
          <td>{{ left }}</td>
        </tr>
        <tr>
          <td class="text-white/40">Top</td>
          <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
          <td>{{ top }}</td>
        </tr>
        <tr>
          <td class="text-white/40">Right</td>
          <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
          <td>{{ right }}</td>
        </tr>
        <tr>
          <td class="text-white/40">Bottom</td>
          <td class="text-white/40 whitespace-pre">{{ ' = ' }}</td>
          <td>{{ bottom }}</td>
        </tr>
      </template>
    </table>
  </div>
</template>
