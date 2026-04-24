<script lang="ts" setup>
const {
  bladeWidth,
  distanceUnit,
  margin,
  optimize,
  showPartNumbers,
  isLoading,
} = useProjectSettings();

useUnitConverter();
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
      <label class="text-xs text-muted whitespace-nowrap"
        >Blade ({{ distanceUnit }})</label
      >
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
      <label class="text-xs text-muted whitespace-nowrap"
        >Margin ({{ distanceUnit }})</label
      >
      <UInput
        v-model="margin"
        type="number"
        min="0"
        step="0.00001"
        size="xs"
        class="w-20"
      />
    </div>

    <label class="flex items-center gap-1.5 cursor-pointer">
      <UCheckbox v-model="showPartNumbers" />
      <span class="text-xs text-muted whitespace-nowrap">Part #s</span>
    </label>
  </div>
</template>
