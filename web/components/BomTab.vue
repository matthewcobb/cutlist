<script lang="ts" setup>
import type { BoardLayoutLeftover } from 'cutlist';
import { parseGltf } from '~/utils/parseGltf';

const { data } = useBoardLayoutsQuery();
const { activeProject, activeId, addModel, removeModel, toggleModel } =
  useProjects();
const { distanceUnit } = useProjectSettings();
const formatDistance = useFormatDistance();
const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);

function pickFile() {
  fileInput.value?.click();
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  if (!files.length || !activeId.value) return;

  for (const file of files) {
    try {
      const { drafts, colors, gltfJson, nodePartMap } = await parseGltf(file);
      addModel(activeId.value, {
        id: crypto.randomUUID(),
        filename: file.name,
        drafts,
        colors,
        enabled: true,
        gltfJson,
        nodePartMap,
      });
      toast.add({
        title: 'Imported',
        description: `${file.name}: ${drafts.length} parts, ${colors.length} color${colors.length === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      toast.add({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        color: 'red',
      });
    }
  }
}

const rows = computed(() => {
  if (data.value == null) return [];

  const map = [
    ...data.value?.layouts.flatMap((layout) => layout.placements),
    ...data.value?.leftovers,
  ].reduce<Map<number, BoardLayoutLeftover[]>>((acc, part) => {
    const items = acc.get(part.partNumber) ?? [];
    items.push(part);
    acc.set(part.partNumber, items);
    return acc;
  }, new Map());

  return [...map.values()]
    .toSorted((a, b) => a[0].partNumber - b[0].partNumber)
    .map((instanceList) => {
      const part = instanceList[0];
      return {
        '#': part.partNumber,
        'Part Name': part.name,
        QTY: instanceList.length,
        Material: part.material,
        [`Size (${distanceUnit.value})`]: `${formatDistance(part.thicknessM)} × ${formatDistance(part.widthM)} × ${formatDistance(part.lengthM)}`,
      };
    });
});
</script>

<template>
  <div class="absolute inset-0 overflow-auto">
    <input
      ref="fileInput"
      type="file"
      accept=".gltf"
      multiple
      class="hidden"
      @change="onFileChange"
    />

    <!-- Models panel -->
    <div
      v-if="activeProject"
      class="m-2 border border-white/15 rounded-lg p-3 space-y-2 bg-black"
    >
      <p class="text-sm font-medium text-white">Models</p>
      <div
        v-for="model in activeProject.models"
        :key="model.id"
        class="flex items-center gap-2"
      >
        <UCheckbox
          :model-value="model.enabled"
          @update:model-value="toggleModel(activeProject!.id, model.id)"
        />
        <span class="text-sm text-white/80 truncate flex-1">{{
          model.filename
        }}</span>
        <span class="text-xs text-white/40 shrink-0">
          {{ model.drafts.length }} part{{
            model.drafts.length === 1 ? '' : 's'
          }}
        </span>
        <UButton
          size="2xs"
          icon="i-heroicons-x-mark"
          color="white"
          variant="ghost"
          :ui="{ rounded: 'rounded-full' }"
          title="Remove model"
          @click="removeModel(activeProject!.id, model.id)"
        />
      </div>
      <UButton
        size="sm"
        color="white"
        variant="soft"
        icon="i-heroicons-plus"
        label="Import Model"
        @click="pickFile"
      />
    </div>

    <ColorMappingPanel v-if="activeProject" class="m-2" />

    <p v-if="!activeProject" class="text-center p-4 text-white/40">
      Create a project to get started.
    </p>
    <p
      v-else-if="activeProject.models.length === 0"
      class="text-center p-4 text-white/40"
    >
      Import a .gltf model to get started.
    </p>
    <div v-else-if="rows.length > 0">
      <UTable :rows="rows" />
    </div>
  </div>
</template>
