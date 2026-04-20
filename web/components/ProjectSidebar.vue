<script lang="ts" setup>
import type { HorizontalNavigationLink } from '#ui/types';

const { data: boardLayouts } = useBoardLayoutsQuery();

const warningsBadge = computed(() => {
  const leftovers = boardLayouts.value?.leftovers ?? [];
  if (leftovers.length === 0) return;
  return leftovers.length;
});

const links = computed<HorizontalNavigationLink[]>(() => [
  {
    label: 'BOM',
    icon: 'i-heroicons-table-cells',
    active: tab.value === 'bom',
    click: () => void (tab.value = 'bom'),
  },
  {
    label: 'Model',
    icon: 'i-heroicons-cube-transparent',
    active: tab.value === 'model',
    click: () => void (tab.value = 'model'),
  },
  {
    label: 'Boards',
    icon: 'i-fluent-emoji-high-contrast-wood',
    active: tab.value === 'boards',
    click: () => void (tab.value = 'boards'),
  },
  {
    label: 'Preview',
    icon: 'i-heroicons-eye',
    active: tab.value === 'preview',
    click: () => void (tab.value = 'preview'),
  },
  {
    label: 'Warnings',
    icon: 'i-heroicons-exclamation-triangle',
    active: tab.value === 'warnings',
    badge: warningsBadge.value
      ? {
          color: 'amber',
          label: String(warningsBadge.value),
        }
      : undefined,
    click: () => void (tab.value = 'warnings'),
  },
  {
    label: 'Settings',
    icon: 'i-heroicons-cog-6-tooth',
    active: tab.value === 'settings',
    click: () => void (tab.value = 'settings'),
  },
]);

const tab = useProjectTab();
</script>

<template>
  <div class="flex flex-col">
    <header class="flex flex-col shrink-0 relative z-10 bg-black">
      <div class="flex items-center border-b border-white/10">
        <UHorizontalNavigation :links="links" class="pl-2 flex-1 min-w-0" />
        <ExportPdfButton class="shrink-0 mr-2" />
      </div>
    </header>

    <div class="relative flex-1 min-h-0">
      <BomTab v-if="tab === 'bom'" class="absolute inset-0 overflow-auto" />
      <ModelTab v-else-if="tab === 'model'" class="absolute inset-0" />
      <StockTab
        v-else-if="tab === 'boards'"
        class="absolute inset-0 overflow-auto"
      />
      <CutlistPreview v-else-if="tab === 'preview'" class="absolute inset-0" />
      <WarningsTab
        v-else-if="tab === 'warnings'"
        class="absolute inset-0 overflow-auto p-8"
      />
      <SettingsTab
        v-else-if="tab === 'settings'"
        class="absolute inset-0 overflow-auto p-8"
      />
    </div>
  </div>
</template>
