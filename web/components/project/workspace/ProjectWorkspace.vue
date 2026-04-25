<script lang="ts" setup>
const tab = useProjectTab();
const { activeProject } = useProjects();
</script>

<template>
  <div class="flex flex-col">
    <ProjectWorkspaceNav />

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

    <ProjectWorkspaceModals />
  </div>
</template>
