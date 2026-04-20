<script lang="ts" setup>
import { parseGltf } from '~/utils/parseGltf';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';

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

async function importFiles(files: File[]) {
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

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  await importFiles(files);
}

// ── Drag & drop ───────────────────────────────────────────────────────────────

const isDragging = ref(false);

function onDragOver(e: DragEvent) {
  if (!activeId.value) return;
  if (e.dataTransfer?.items.length) {
    e.preventDefault();
    isDragging.value = true;
  }
}

function onDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Element | null;
  const current = e.currentTarget as Element;
  if (!related || !current.contains(related)) {
    isDragging.value = false;
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
    f.name.endsWith('.gltf'),
  );
  await importFiles(files);
}

// ── BOM rows ──────────────────────────────────────────────────────────────────

const rows = computed(() => {
  if (data.value == null) return [];

  return groupPartsByNumber(
    data.value.layouts.flatMap((l) => l.placements),
    data.value.leftovers,
  ).map((instanceList) => {
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
  <div
    class="absolute inset-0 overflow-auto"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".gltf"
      multiple
      class="hidden"
      @change="onFileChange"
    />

    <!-- Drag overlay -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isDragging"
        class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 border-2 border-dashed border-teal-400/50 rounded-lg m-1 pointer-events-none"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-teal-400/10 flex items-center justify-center"
        >
          <UIcon
            name="i-heroicons-arrow-down-tray"
            class="w-7 h-7 text-teal-400"
          />
        </div>
        <p class="text-sm font-semibold text-teal-400">
          Drop .gltf file to import
        </p>
      </div>
    </Transition>

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
        color="primary"
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

    <!-- Empty state: no models -->
    <div
      v-else-if="
        activeProject.models.length === 0 && activeProject.id === activeId
      "
      class="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <div
        class="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center cursor-pointer hover:bg-teal-500/8 hover:border-teal-400/20 transition-colors group"
        @click="pickFile"
      >
        <UIcon
          name="i-heroicons-arrow-up-tray"
          class="w-6 h-6 text-white/20 group-hover:text-teal-400/60 transition-colors"
        />
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-white/50">No models imported</p>
        <p class="text-xs text-white/25 leading-relaxed max-w-[200px]">
          Drop a <span class="font-mono text-white/35">.gltf</span> file here or
          use Import Model above
        </p>
      </div>
    </div>

    <div v-else-if="rows.length > 0">
      <UTable :rows="rows" />
    </div>
  </div>
</template>
