<script lang="ts" setup>
const { isRulerActive, toggleRuler } = useRulerStore();
</script>

<template>
  <div class="flex">
    <UButton
      :title="isRulerActive ? 'Disable ruler (Esc)' : 'Measure distance'"
      square
      size="lg"
      :color="isRulerActive ? 'primary' : 'neutral'"
      :variant="isRulerActive ? 'solid' : 'ghost'"
      @click="toggleRuler"
    >
      <svg
        class="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <!-- Ruler icon -->
        <rect x="3" y="7" width="18" height="10" rx="1" />
        <line x1="7" y1="7" x2="7" y2="11" />
        <line x1="11" y1="7" x2="11" y2="13" />
        <line x1="15" y1="7" x2="15" y2="11" />
        <line x1="19" y1="7" x2="19" y2="11" />
      </svg>
    </UButton>
  </div>
</template>
