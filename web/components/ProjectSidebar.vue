<script lang="ts" setup>
import type { HorizontalNavigationLink } from '#ui/types';

const links = computed<HorizontalNavigationLink[]>(() => [
  {
    label: 'BOM',
    icon: 'i-lucide-table',
    active: tab.value === 'bom',
    click: () => void (tab.value = 'bom'),
  },
  {
    label: 'Model',
    icon: 'i-lucide-box',
    active: tab.value === 'model',
    click: () => void (tab.value = 'model'),
  },
  {
    label: 'Boards',
    icon: 'i-lucide-layers',
    active: tab.value === 'boards',
    click: () => void (tab.value = 'boards'),
  },
  {
    label: 'Layout',
    icon: 'i-lucide-eye',
    active: tab.value === 'preview',
    click: () => void (tab.value = 'preview'),
  },
  {
    label: 'Build',
    icon: 'i-lucide-book-open',
    active: tab.value === 'instructions',
    click: () => void (tab.value = 'instructions'),
  },
  {
    label: 'Settings',
    icon: 'i-lucide-settings',
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
        <UHorizontalNavigation
          :links="links"
          :ui="{
            before:
              'before:absolute before:inset-x-0 before:inset-y-2 before:inset-px before:rounded-md hover:before:!bg-transparent dark:hover:before:!bg-transparent',
            inactive:
              'text-white/50 hover:text-white/80 hover:after:bg-white/20',
            active: 'text-teal-400 after:!bg-teal-400 after:rounded-full',
          }"
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
