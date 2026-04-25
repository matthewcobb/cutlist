<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false });

const { addProject } = useProjects();
const projectName = ref('');

watch(open, (v) => {
  if (v) projectName.value = '';
});

async function createProject() {
  const name = projectName.value.trim();
  if (!name) return;
  await addProject(name);
  open.value = false;
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="New Project"
    description="Create a new project"
  >
    <template #content>
      <div class="p-6 space-y-4 bg-elevated border border-default rounded-lg">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">New Project</h3>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="rounded-full"
            @click="open = false"
          />
        </div>
        <UInput
          v-model="projectName"
          placeholder="Project name"
          class="w-full"
          autofocus
          @keydown.enter="createProject"
        />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">
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
    </template>
  </UModal>
</template>
