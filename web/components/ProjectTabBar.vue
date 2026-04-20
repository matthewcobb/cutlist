<script lang="ts" setup>
const { projects, activeId, addProject, closeProject, setActive } =
  useProjects();

const showModal = ref(false);
const projectName = ref('');

function openNewProject() {
  projectName.value = '';
  showModal.value = true;
}

function createProject() {
  const name = projectName.value.trim();
  if (!name) return;
  addProject(name);
  showModal.value = false;
}
</script>

<template>
  <div class="flex items-stretch bg-black min-h-10">
    <TabList class="flex-1 min-w-0">
      <TabListItem
        v-for="[id, project] in projects"
        :key="id"
        :name="project.name"
        :active="id === activeId"
        @click="setActive(id)"
        @close="closeProject(id)"
      />
    </TabList>

    <button
      class="shrink-0 px-3 flex items-center border-l border-white/10 text-white/40 hover:text-teal-400 transition-colors"
      title="New project"
      @click="openNewProject"
    >
      <UIcon name="i-heroicons-plus" class="w-5 h-5" />
    </button>

    <UModal
      v-model="showModal"
      :ui="{ overlay: { background: 'bg-black/75' }, background: 'bg-black' }"
    >
      <div class="p-6 space-y-4 bg-black border border-white/15 rounded-lg">
        <h3 class="text-lg font-medium text-white">New Project</h3>
        <UInput
          v-model="projectName"
          placeholder="Project name"
          autofocus
          @keydown.enter="createProject"
        />
        <div class="flex justify-end gap-2">
          <UButton color="white" variant="ghost" @click="showModal = false">
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!projectName.trim()"
            @click="createProject"
          >
            Create
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
