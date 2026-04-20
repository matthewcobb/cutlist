<script lang="ts" setup>
import type { BoardLayoutPlacement } from 'cutlist';
import { useElementHover } from '@vueuse/core';

const props = defineProps<{
  placement: BoardLayoutPlacement;
}>();

const container = ref<HTMLDivElement>();
const isHovered = useElementHover(container);

const getPx = useGetPx();

const width = computed(() => getPx(props.placement.widthM));
const height = computed(() => getPx(props.placement.lengthM));
const left = computed(() => getPx(props.placement.leftM));
const bottom = computed(() => getPx(props.placement.bottomM));

const fontSize = computed(() =>
  getPx(
    Math.min(
      props.placement.widthM / 2,
      0.0254, // 1 in to m
    ),
  ),
);

const { showPartNumbers } = useProjectSettings();
</script>

<template>
  <div
    ref="container"
    class="absolute cursor-pointer group"
    :style="`bottom:${bottom};left:${left}`"
  >
    <UPlaceholder
      class="overflow-hidden"
      :color="isHovered ? 'primary' : 'white'"
      :style="`width:${width};height:${height}`"
    >
      <p
        v-if="showPartNumbers"
        class="w-full text-clip text-white/40 group-hover:text-teal-400 text-right p-px"
        :style="`font-size:${fontSize};line-height:${fontSize}`"
      >
        {{ placement.partNumber }}
      </p>
    </UPlaceholder>
    <Teleport to="body">
      <PartDetailsTooltip
        v-if="isHovered"
        :part="placement"
        class="pointer-events-none"
      />
    </Teleport>
  </div>
</template>
