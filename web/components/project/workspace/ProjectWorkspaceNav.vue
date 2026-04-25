<script lang="ts" setup>
import { PROJECT_TABS } from '~/utils/projectTabs';

const tab = useProjectTab();
const { isComputing } = useBoardLayoutsQuery();

const items = computed(() =>
  PROJECT_TABS.map((definition) => ({
    label: definition.label,
    icon: definition.icon,
    active: tab.value === definition.id,
    onSelect: () => void (tab.value = definition.id),
  })),
);
</script>

<template>
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
</template>
