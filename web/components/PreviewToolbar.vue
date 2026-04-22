<script lang="ts" setup>
const {
  bladeWidth,
  extraSpace,
  optimize,
  showPartNumbers,
  isLoading,
  changes,
} = useProjectSettings();

useUnitConverter();

const { mutate: save } = useSetSettingsMutation();

// Auto-save when any setting changes (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | undefined;
watch(
  changes,
  (val) => {
    if (!val || Object.keys(val).length === 0) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      save({ changes: toRaw(val) });
    }, 1000);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout);
});
</script>

<template>
  <div v-if="!isLoading" class="flex items-center gap-3 flex-wrap">
    <div class="flex items-center gap-1.5">
      <label class="text-xs text-muted whitespace-nowrap">Optimize</label>
      <USelect
        v-model="optimize"
        :items="['Auto', 'Cuts', 'CNC']"
        size="xs"
        class="w-20"
      />
    </div>

    <div class="flex items-center gap-1.5">
      <label class="text-xs text-muted whitespace-nowrap">Blade</label>
      <UInput
        v-model="bladeWidth"
        type="number"
        min="0"
        step="0.00001"
        size="xs"
        class="w-20"
      />
    </div>

    <div class="flex items-center gap-1.5">
      <label class="text-xs text-muted whitespace-nowrap">Extra</label>
      <UInput v-model="extraSpace" type="number" size="xs" class="w-20" />
    </div>

    <label class="flex items-center gap-1.5 cursor-pointer">
      <UCheckbox v-model="showPartNumbers" />
      <span class="text-xs text-muted whitespace-nowrap">Part #s</span>
    </label>
  </div>
</template>
