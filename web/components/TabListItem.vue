<script lang="ts" setup>
const props = defineProps<{
  to?: string;
  name?: string;
  hideClose?: boolean;
  active?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const route = useRoute();
const isActive = computed(
  () => props.active ?? (props.to != null && route.path === props.to),
);
</script>

<template>
  <li class="shrink-0" :class="isActive ? 'bg-white/5' : 'bg-black'">
    <component
      :is="to ? resolveComponent('ULink') : 'button'"
      class="px-3 flex shrink-0 h-10 justify-between items-center gap-3 border-r border-white/10 w-full"
      v-bind="to ? { to, active: isActive, activeClass: 'bg-white/5' } : {}"
    >
      <slot />
      <span
        v-if="name"
        class="min-w-[4rem] max-w-[12rem] truncate text-sm font-medium"
        :class="isActive ? 'text-teal-400' : 'text-white/50'"
        >{{ name }}</span
      >
      <UButton
        v-if="!hideClose"
        size="2xs"
        icon="i-heroicons-x-mark"
        color="white"
        variant="soft"
        square
        :ui="{ rounded: 'rounded-full' }"
        title="Close"
        @click.stop.prevent="emit('close')"
      />
    </component>
  </li>
</template>
