<script lang="ts" setup>
const items = computed(() => [
  {
    label: 'BOM',
    icon: 'i-lucide-table',
    active: tab.value === 'bom',
    onSelect: () => void (tab.value = 'bom'),
  },
  {
    label: 'Model',
    icon: 'i-lucide-box',
    active: tab.value === 'model',
    onSelect: () => void (tab.value = 'model'),
  },
  {
    label: 'Layout',
    icon: 'i-lucide-eye',
    active: tab.value === 'preview',
    onSelect: () => void (tab.value = 'preview'),
  },
  {
    label: 'Build',
    icon: 'i-lucide-book-open',
    active: tab.value === 'instructions',
    onSelect: () => void (tab.value = 'instructions'),
  },
  {
    label: 'Boards',
    icon: 'i-lucide-layers',
    active: tab.value === 'boards',
    onSelect: () => void (tab.value = 'boards'),
  },
  {
    label: 'Settings',
    icon: 'i-lucide-settings',
    active: tab.value === 'settings',
    onSelect: () => void (tab.value = 'settings'),
  },
]);

const tab = useProjectTab();
</script>

<template>
  <div class="flex flex-col">
    <header class="flex flex-col shrink-0 relative z-10 bg-base">
      <div class="flex items-center border-b border-subtle">
        <UNavigationMenu
          :items="items"
          variant="link"
          highlight
          highlight-color="primary"
          color="neutral"
          class="pl-2 flex-1 min-w-0"
        />
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
      <InstructionsTab
        v-else-if="tab === 'instructions'"
        class="absolute inset-0 overflow-auto"
      />
      <SettingsTab
        v-else-if="tab === 'settings'"
        class="absolute inset-0 overflow-auto p-8"
      />
    </div>
  </div>
</template>
