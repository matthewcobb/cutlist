<script lang="ts" setup>
defineProps<{
  color?: 'white' | 'primary';
}>();
</script>

<template>
  <div
    class="border rounded relative"
    :class="{
      'border-white/15 bg-gray-900': color == null || color === 'white',
      'border-teal-400 bg-teal-950': color === 'primary',
    }"
  >
    <slot />
  </div>
</template>
