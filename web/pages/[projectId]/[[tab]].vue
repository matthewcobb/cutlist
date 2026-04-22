<script lang="ts" setup>
const route = useRoute();
const { activeId } = useProjects();
const tab = useProjectTab();

// Set state from route params on mount
const projectId = route.params.projectId as string;
if (projectId && projectId !== activeId.value) {
  activeId.value = projectId;
}

const routeTab = route.params.tab as string | undefined;
if (routeTab) {
  tab.value = routeTab as typeof tab.value;
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-base">
    <ProjectTabBar class="shrink-0 border-b border-subtle" />

    <ClientOnly>
      <ProjectSidebar class="flex-1 min-w-0 bg-base relative z-10" />
    </ClientOnly>
  </div>
</template>
