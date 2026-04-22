<script lang="ts" setup>
const props = defineProps<{
  scale: number;
}>();

const emit = defineEmits<{
  zoomOut: [];
  zoomIn: [];
  resetZoom: [];
}>();

const percent = computed(() => `${Math.round(props.scale * 100)}%`);
</script>

<template>
  <div class="flex gap-1">
    <UButton
      title="Zoom out"
      square
      size="lg"
      color="neutral"
      variant="ghost"
      icon="i-lucide-minus"
      @click="emit('zoomOut')"
    />
    <UButton
      :title="`${percent} - Click to reset to 100%`"
      class="w-20 justify-center text-teal-400"
      size="lg"
      color="neutral"
      variant="ghost"
      @click="emit('resetZoom')"
    >
      {{ percent }}
    </UButton>
    <UButton
      title="Zoom in"
      square
      size="lg"
      color="neutral"
      variant="ghost"
      icon="i-lucide-plus"
      @click="emit('zoomIn')"
    />
  </div>
</template>
