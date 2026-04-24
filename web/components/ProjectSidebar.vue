<script lang="ts" setup>
const { showConfirm, pendingGrainLock, confirmChange, cancelChange } =
  useGrainLockConfirm();

const items = computed(() => [
  {
    label: 'BOM',
    icon: 'i-lucide-table',
    active: tab.value === 'bom',
    onSelect: () => void (tab.value = 'bom'),
  },
  {
    label: 'Layout',
    icon: 'i-lucide-layers',
    active: tab.value === 'layout',
    onSelect: () => void (tab.value = 'layout'),
  },
  {
    label: 'Model',
    icon: 'i-lucide-box',
    active: tab.value === 'model',
    onSelect: () => void (tab.value = 'model'),
  },
  {
    label: 'Build',
    icon: 'i-lucide-book-open',
    active: tab.value === 'instructions',
    onSelect: () => void (tab.value = 'instructions'),
  },
  {
    label: 'Stock',
    icon: 'i-lucide-warehouse',
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
const { activeProject } = useProjects();
const { isComputing } = useBoardLayoutsQuery();
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
        <Transition
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-150"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <span
            v-if="isComputing"
            class="shrink-0 flex items-center gap-1.5 mr-3 text-xs text-muted"
            title="Recomputing layouts"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-3.5 h-3.5 animate-spin text-teal-400"
            />
            <span class="hidden sm:inline">Updating&hellip;</span>
          </span>
        </Transition>
        <ExportPdfButton class="shrink-0 mr-2" />
      </div>
    </header>

    <div class="relative flex-1 min-h-0">
      <template v-if="activeProject">
        <BomTab v-if="tab === 'bom'" class="absolute inset-0 overflow-auto" />
        <ModelTab v-else-if="tab === 'model'" class="absolute inset-0" />
        <StockTab
          v-else-if="tab === 'boards'"
          class="absolute inset-0 overflow-auto"
        />
        <CutlistPreview v-else-if="tab === 'layout'" class="absolute inset-0" />
        <InstructionsTab
          v-else-if="tab === 'instructions'"
          class="absolute inset-0 overflow-auto"
        />
        <SettingsTab
          v-else-if="tab === 'settings'"
          class="absolute inset-0 overflow-auto p-8"
        />
      </template>
    </div>

    <GrainLockConfirmModal
      :open="showConfirm"
      :grain-lock="pendingGrainLock"
      @confirm="confirmChange"
      @cancel="cancelChange"
    />
  </div>
</template>
