<script lang="ts" setup>
const { activeId, allColors, updateColorMap, activeProject } = useProjects();
const { stock } = useProjectSettings();
const parseStock = useParseStock();

const materialOptions = computed<string[]>(() => {
  if (stock.value == null) return [];
  try {
    const parsed = parseStock(stock.value);
    const names = Array.from(new Set(parsed.map((s) => s.material))).sort();
    return names;
  } catch {
    return [];
  }
});

function setMapping(colorKey: string, material: string) {
  if (activeId.value == null) return;
  updateColorMap(activeId.value, colorKey, material);
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
    class="border border-white/15 rounded-lg p-3 space-y-2 bg-black"
  >
    <p class="text-sm font-medium text-white">Map colors to stock materials</p>
    <p v-if="materialOptions.length === 0" class="text-xs text-amber-400">
      No stock materials defined. Open Settings to add stock first.
    </p>
    <div
      v-for="color in allColors"
      :key="color.key"
      class="flex items-center gap-3"
    >
      <span
        class="w-6 h-6 shrink-0 rounded border border-white/15"
        :style="rgbStyle(color.rgb)"
        :title="color.key"
      />
      <span class="text-xs text-teal-400 w-16 shrink-0">
        {{ color.count }} part{{ color.count === 1 ? '' : 's' }}
      </span>
      <USelect
        class="flex-1"
        size="sm"
        :model-value="activeProject.colorMap[color.key] ?? ''"
        :options="[
          { value: '', label: '— Unmapped —' },
          ...materialOptions.map((m) => ({ value: m, label: m })),
        ]"
        value-attribute="value"
        option-attribute="label"
        @update:model-value="(v: string) => setMapping(color.key, v)"
      />
    </div>
  </div>
</template>
