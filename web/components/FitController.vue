<script lang="ts" setup>
const isExpanded = useIsExpanded();
</script>

<template>
  <div class="flex">
    <UButton
      title="Expand Preview"
      square
      size="lg"
      color="gray"
      :icon="isExpanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
      @click="isExpanded = !isExpanded"
    />
  </div>
</template>
