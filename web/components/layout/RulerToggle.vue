<script lang="ts" setup>
const { isRulerActive, toggleRuler } = useRulerStore();
</script>

<template>
  <div class="flex items-center gap-2">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 translate-x-2"
      leave-to-class="opacity-0 translate-x-2"
    >
      <span
        v-if="isRulerActive"
        class="text-xs text-teal-400 whitespace-nowrap bg-teal-400/10 backdrop-blur border border-teal-400/25 rounded-lg px-2 py-1.5"
      >
        Pan locked &middot; <kbd class="text-teal-400/60">Esc</kbd> to exit
      </span>
    </Transition>
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
