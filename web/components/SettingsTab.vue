<script lang="ts" setup>
import { Distance } from 'cutlist';

const { activeProject, activeId, renameProject, closeProject } = useProjects();
const {
  bladeWidth,
  distanceUnit,
  extraSpace,
  optimize,
  showPartNumbers,
  isLoading,
  changes,
  resetSettings: resetLocal,
} = useProjectSettings();

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

// Convert values when units change
watch(distanceUnit, (newUnit, oldUnit) => {
  if (!newUnit || !oldUnit) return;

  const convertDistance = (value: Ref<string | number | undefined>) => {
    if (value.value == null) return;
    const dist = new Distance(value.value + oldUnit);
    value.value = roundDistance(dist[newUnit], newUnit);
  };
  convertDistance(bladeWidth);
  convertDistance(extraSpace);
});

function roundDistance(value: number, unit: 'in' | 'm' | 'mm') {
  if (unit === 'mm') return Number(value.toFixed(3));
  if (unit === 'm') return Number(value.toFixed(5));
  return Number(value.toFixed(5));
}

const saveStatus = ref<
  | {
      kind: 'success' | 'error';
      text: string;
    }
  | undefined
>();
let saveStatusTimeout: ReturnType<typeof setTimeout> | undefined;

function setSaveStatus(kind: 'success' | 'error', text: string) {
  saveStatus.value = { kind, text };
  if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
  saveStatusTimeout = setTimeout(() => {
    saveStatus.value = undefined;
  }, 5000);
}

onBeforeUnmount(() => {
  if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
});

const { mutate: _save, isPending: isSaving } = useSetSettingsMutation();
function save() {
  saveStatus.value = undefined;
  _save(
    {
      changes: toRaw(changes.value),
    },
    {
      onSuccess() {
        setSaveStatus('success', 'Settings saved.');
      },
      onError(error: any) {
        setSaveStatus(
          'error',
          error?.data?.statusMessage ??
            error?.statusMessage ??
            'Failed to save settings.',
        );
      },
    },
  );
}

const { mutate: _reset, isPending: isResetting } = useDeleteSettingsMutation();
function reset() {
  _reset(undefined, {
    onSettled: () => resetLocal(),
  });
}
</script>

<template>
  <div v-if="!isLoading" class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <h3 class="text-sm font-medium text-white/60 uppercase tracking-wide">
        Project
      </h3>
      <UFormGroup label="Project name">
        <UInput
          v-model="projectName"
          @blur="saveProjectName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </UFormGroup>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="save">
      <h3 class="text-sm font-medium text-white/60 uppercase tracking-wide">
        Cutlist Settings
      </h3>
      <div
        v-if="saveStatus"
        class="shrink-0 p-4 rounded-lg border"
        :class="
          saveStatus.kind === 'success'
            ? 'bg-teal-950 border-teal-700 text-teal-300'
            : 'bg-red-950 border-red-700 text-red-300'
        "
      >
        <p class="whitespace-pre-wrap">{{ saveStatus.text }}</p>
      </div>

      <UFormGroup label="Distance unit">
        <USelect v-model="distanceUnit" :options="['in', 'm', 'mm']" />
      </UFormGroup>

      <UFormGroup :label="`Blade width (${distanceUnit}):`">
        <UInput v-model="bladeWidth" type="number" min="0" step="0.00001" />
      </UFormGroup>

      <UFormGroup :label="`Extra space (${distanceUnit}):`">
        <UInput v-model="extraSpace" type="number" />
      </UFormGroup>

      <UFormGroup label="Optimize for:">
        <USelect v-model="optimize" :options="['Auto', 'Cuts', 'CNC']" />
      </UFormGroup>

      <UCheckbox
        v-model="showPartNumbers"
        label="Show part numbers in preview"
      />

      <div class="flex flex-row-reverse gap-4">
        <UButton type="submit" :loading="isSaving">Save Changes</UButton>
        <UButton color="gray" :loading="isResetting" @click="reset"
          >Reset</UButton
        >
      </div>
    </form>

    <div class="flex flex-col gap-4 border-t border-white/10 pt-8">
      <h3 class="text-sm font-medium text-white/60 uppercase tracking-wide">
        Danger Zone
      </h3>
      <div
        class="flex items-center justify-between p-4 rounded-lg border border-red-900/50 bg-red-950/20"
      >
        <div>
          <p class="text-sm font-medium text-white">Delete project</p>
          <p class="text-sm text-white/50">This cannot be undone.</p>
        </div>
        <UButton
          v-if="!showDeleteConfirm"
          color="red"
          variant="outline"
          @click="showDeleteConfirm = true"
        >
          Delete
        </UButton>
        <div v-else class="flex gap-2">
          <UButton
            color="gray"
            variant="ghost"
            @click="showDeleteConfirm = false"
            >Cancel</UButton
          >
          <UButton color="red" @click="deleteProject">Confirm Delete</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
