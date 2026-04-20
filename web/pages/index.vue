<script lang="ts" setup>
const { activeProject } = useProjects();
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-black">
    <ProjectTabBar class="shrink-0 border-b border-white/10" />

    <ClientOnly>
      <ProjectSidebar
        v-if="activeProject"
        class="flex-1 min-w-0 bg-black relative z-10"
      />
      <div v-else class="flex-1 flex items-center justify-center text-white/40">
        <p>Open a .gltf file to get started</p>
      </div>
    </ClientOnly>
  </div>
</template>
