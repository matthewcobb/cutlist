<script lang="ts" setup>
const { activeProject, activeId, renameProject, closeProject } = useProjects();
const { distanceUnit } = useProjectSettings();

const projectName = ref('');
watch(
  () => activeProject.value?.name,
  (name) => {
    if (name) projectName.value = name;
  },
  { immediate: true },
);

function saveProjectName() {
  const name = projectName.value.trim();
  if (!name || !activeId.value || name === activeProject.value?.name) return;
  renameProject(activeId.value, name);
}

const showDeleteConfirm = ref(false);
function deleteProject() {
  if (!activeId.value) return;
  closeProject(activeId.value);
  showDeleteConfirm.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">
        Project
      </h3>
      <UFormField label="Project name">
        <UInput
          v-model="projectName"
          @blur="saveProjectName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </UFormField>

      <UFormField label="Units">
        <USelect
          v-model="distanceUnit"
          :items="[
            { label: 'Millimeters (mm)', value: 'mm' },
            { label: 'Inches (in)', value: 'in' },
          ]"
        />
      </UFormField>
    </div>

    <div class="flex flex-col gap-4 border-t border-subtle pt-8">
      <h3 class="text-sm font-medium text-muted uppercase tracking-wide">
        Danger Zone
      </h3>
      <div
        class="flex items-center justify-between p-4 rounded-lg border border-red-900/50 bg-red-950/50"
      >
        <div>
          <p class="text-sm font-medium text-white">Delete project</p>
          <p class="text-sm text-muted">This cannot be undone.</p>
        </div>
        <UButton
          v-if="!showDeleteConfirm"
          color="error"
          variant="outline"
          @click="showDeleteConfirm = true"
        >
          Delete
        </UButton>
        <div v-else class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showDeleteConfirm = false"
            >Cancel</UButton
          >
          <UButton color="error" @click="deleteProject">Confirm Delete</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
