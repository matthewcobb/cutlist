<script lang="ts" setup>
import { parseStock } from '~/utils/parseStock';

const {
  activeId,
  allColors,
  updateColorMap,
  toggleColorExcluded,
  activeProject,
} = useProjects();
const { stock } = useProjectSettings();

const expanded = ref(true);

const materialOptions = computed<string[]>(() => {
  if (stock.value == null) return [];
  try {
    return Array.from(
      new Set(parseStock(stock.value).map((s) => s.material)),
    ).sort();
  } catch {
    return [];
  }
});

function setMapping(colorKey: string, material: string) {
  if (activeId.value == null) return;
  updateColorMap(activeId.value, colorKey, material);
}

function isIncluded(colorKey: string): boolean {
  return !(activeProject.value?.excludedColors ?? []).includes(colorKey);
}

function toggleIncluded(colorKey: string) {
  if (activeId.value == null) return;
  toggleColorExcluded(activeId.value, colorKey);
}

function rgbStyle(rgb: [number, number, number]): string {
  const r = Math.round(rgb[0] * 255);
  const g = Math.round(rgb[1] * 255);
  const b = Math.round(rgb[2] * 255);
  return `background: rgb(${r}, ${g}, ${b});`;
}
</script>

<template>
  <div
    v-if="activeProject && allColors.length > 0"
    class="space-y-2 pt-2 border-t border-subtle"
  >
    <button
      type="button"
      class="flex items-center gap-1.5 w-full text-left group"
      :aria-expanded="expanded"
      aria-label="Map colors to stock materials"
      @click="expanded = !expanded"
    >
      <UIcon
        :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="w-4 h-4 text-dim group-hover:text-body transition-colors shrink-0"
      />
      <span class="text-sm font-medium text-white"
        >Map colors to stock materials</span
      >
    </button>
    <template v-if="expanded">
      <p v-if="materialOptions.length === 0" class="text-xs text-amber-400">
        No stock materials defined. Open Settings to add stock first.
      </p>
      <div
        v-for="color in allColors"
        :key="color.key"
        class="flex items-center gap-3"
      >
        <UCheckbox
          :model-value="isIncluded(color.key)"
          @update:model-value="toggleIncluded(color.key)"
        />
        <span
          class="w-6 h-6 shrink-0 rounded border border-default"
          :style="rgbStyle(color.rgb)"
          :title="color.key"
        />
        <span class="text-xs text-teal-400 w-16 shrink-0">
          {{ color.count }} part{{ color.count === 1 ? '' : 's' }}
        </span>
        <USelect
          class="flex-1"
          size="sm"
          :model-value="activeProject.colorMap[color.key] || '__none__'"
          :items="[
            { value: '__none__', label: '— Unmapped —' },
            ...materialOptions.map((m) => ({ value: m, label: m })),
          ]"
          @update:model-value="
            (v: string) => setMapping(color.key, v === '__none__' ? '' : v)
          "
        />
      </div>
    </template>
  </div>
</template>
