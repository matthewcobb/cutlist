<script lang="ts" setup>
const props = defineProps<{
  to?: string;
  name?: string;
  hideClose?: boolean;
  active?: boolean;
  editing?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  rename: [name: string];
}>();

const route = useRoute();
const isActive = computed(
  () => props.active ?? (props.to != null && route.path === props.to),
);

const renameInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.editing,
  (v) => {
    if (v) nextTick(() => renameInput.value?.select());
  },
);
</script>

<template>
  <li
    class="shrink-0 min-w-[8rem]"
    :class="isActive ? 'bg-white/5' : 'bg-black'"
  >
    <component
      :is="to ? resolveComponent('ULink') : 'button'"
      class="px-3 flex shrink-0 h-10 justify-start items-center gap-3 border-r border-white/10 w-full"
      v-bind="to ? { to, active: isActive, activeClass: 'bg-white/5' } : {}"
    >
      <slot />
      <input
        v-if="editing"
        ref="renameInput"
        class="max-w-[12rem] text-sm font-medium bg-transparent text-teal-400 outline-none border-b border-teal-400/50"
        :value="name"
        @keydown.enter.stop="
          emit('rename', ($event.target as HTMLInputElement).value)
        "
        @keydown.escape.stop="emit('rename', name ?? '')"
        @blur="emit('rename', ($event.target as HTMLInputElement).value)"
        @click.stop
        @dblclick.stop
      />
      <span
        v-else-if="name"
        class="max-w-[12rem] truncate text-sm font-medium"
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
        class="ml-auto"
        :ui="{ rounded: 'rounded-full' }"
        title="Close"
        @click.stop.prevent="emit('close')"
      />
    </component>
  </li>
</template>
