<script lang="ts" setup>
import { parseGltf } from '~/utils/parseGltf';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import { parseStock } from '~/utils/parseStock';
import type { ManualPartInput } from '~/composables/useProjects';

const { data } = useBoardLayoutsQuery();
const {
  activeProject,
  activeId,
  manualModel,
  addModel,
  removeModel,
  toggleModel,
  addManualPart,
  updateManualPart,
  removeManualPart,
} = useProjects();
const { distanceUnit, stock } = useProjectSettings();
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

// ── Manual parts ─────────────────────────────────────────────────────────────

const materials = computed(() => {
  if (!stock.value) return [];
  try {
    return parseStock(stock.value).map((s) => s.material);
  } catch {
    return [];
  }
});

const manualPartGroups = computed(() => {
  const model = manualModel.value;
  if (!model) return [];
  const map = new Map<number, typeof model.drafts>();
  for (const draft of model.drafts) {
    const list = map.get(draft.partNumber) ?? [];
    list.push(draft);
    map.set(draft.partNumber, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([partNumber, drafts]) => ({
      partNumber,
      name: drafts[0].name,
      qty: drafts.length,
      widthMm: Math.round(drafts[0].size.width * 1000),
      lengthMm: Math.round(drafts[0].size.length * 1000),
      thicknessMm: Math.round(drafts[0].size.thickness * 1000),
      material: drafts[0].colorKey,
    }));
});

const pendingRemoveModelId = ref<string | null>(null);

const showAddForm = ref(false);
const editingPartNumber = ref<number | null>(null);

function startEdit(partNumber: number) {
  editingPartNumber.value = partNumber;
  showAddForm.value = false;
}

function cancelEdit() {
  editingPartNumber.value = null;
}

async function handleAddPart(data: ManualPartInput) {
  if (!activeId.value) return;
  await addManualPart(activeId.value, data);
}

async function handleUpdatePart(partNumber: number, data: ManualPartInput) {
  if (!activeId.value) return;
  await updateManualPart(activeId.value, partNumber, data);
  editingPartNumber.value = null;
}

async function handleRemovePart(partNumber: number) {
  if (!activeId.value) return;
  await removeManualPart(activeId.value, partNumber);
  if (editingPartNumber.value === partNumber) editingPartNumber.value = null;
}

// ── BOM rows ─────────────────────────────────────────────────────────────────

const columns = computed(() => [
  { key: 'number', label: '#' },
  { key: 'name', label: 'Part Name' },
  { key: 'qty', label: 'QTY' },
  { key: 'material', label: 'Material' },
  { key: 'size', label: `Size (${distanceUnit.value})` },
  { key: 'warning', label: '' },
]);

const rows = computed(() => {
  if (data.value == null) return [];

  const leftoverCounts = new Map<number, number>();
  for (const l of data.value.leftovers) {
    leftoverCounts.set(
      l.partNumber,
      (leftoverCounts.get(l.partNumber) ?? 0) + 1,
    );
  }

  return groupPartsByNumber(
    data.value.layouts.flatMap((l) => l.placements),
    data.value.leftovers,
  ).map((instanceList) => {
    const part = instanceList[0];
    return {
      number: part.partNumber,
      name: part.name,
      qty: instanceList.length,
      material: part.material,
      size: `${formatDistance(part.thicknessM)} × ${formatDistance(part.widthM)} × ${formatDistance(part.lengthM)}`,
      leftoverCount: leftoverCounts.get(part.partNumber) ?? 0,
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
          <UIcon name="i-lucide-download" class="w-7 h-7 text-teal-400" />
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
        v-for="model in activeProject.models.filter(
          (m) => m.source !== 'manual',
        )"
        :key="model.id"
        class="flex items-center gap-2"
      >
        <UCheckbox
          :model-value="model.enabled"
          @update:model-value="toggleModel(activeProject!.id, model.id)"
        />
        <span class="text-sm text-body truncate flex-1">{{
          model.filename
        }}</span>
        <span class="text-xs text-muted shrink-0">
          {{ model.drafts.length }} part{{
            model.drafts.length === 1 ? '' : 's'
          }}
        </span>
        <template v-if="pendingRemoveModelId === model.id">
          <UButton
            size="2xs"
            color="gray"
            variant="ghost"
            label="Cancel"
            @click="pendingRemoveModelId = null"
          />
          <UButton
            size="2xs"
            color="red"
            variant="solid"
            label="Remove"
            @click="
              removeModel(activeProject!.id, model.id);
              pendingRemoveModelId = null;
            "
          />
        </template>
        <UButton
          v-else
          size="2xs"
          icon="i-lucide-x"
          color="white"
          variant="ghost"
          :ui="{ rounded: 'rounded-full' }"
          title="Remove model"
          @click="pendingRemoveModelId = model.id"
        />
      </div>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        label="Import Model"
        @click="pickFile"
      />
      <ColorMappingPanel v-if="activeProject" />
    </div>

    <!-- Manual Parts panel -->
    <div
      v-if="activeProject"
      class="m-2 border border-white/15 rounded-lg p-3 space-y-2 bg-black"
    >
      <p class="text-sm font-medium text-white">Manual Parts</p>

      <!-- Existing manual parts -->
      <div
        v-for="group in manualPartGroups"
        :key="group.partNumber"
        class="space-y-1.5"
      >
        <div
          v-if="editingPartNumber !== group.partNumber"
          class="flex items-center gap-2"
        >
          <span class="text-xs text-muted shrink-0 w-5 text-right"
            >#{{ group.partNumber }}</span
          >
          <span class="text-sm text-body truncate flex-1">{{
            group.name
          }}</span>
          <span class="text-xs text-muted shrink-0">×{{ group.qty }}</span>
          <span class="text-xs text-muted shrink-0 hidden sm:inline">
            {{ group.thicknessMm }}×{{ group.widthMm }}×{{ group.lengthMm }}mm
          </span>
          <span class="text-xs text-muted shrink-0">{{ group.material }}</span>
          <UButton
            size="2xs"
            icon="i-lucide-square-pen"
            color="white"
            variant="ghost"
            :ui="{ rounded: 'rounded-full' }"
            title="Edit part"
            @click="startEdit(group.partNumber)"
          />
          <UButton
            size="2xs"
            icon="i-lucide-x"
            color="white"
            variant="ghost"
            :ui="{ rounded: 'rounded-full' }"
            title="Remove part"
            @click="handleRemovePart(group.partNumber)"
          />
        </div>
        <ManualPartRow
          v-else
          :materials="materials"
          :initial="{
            partNumber: group.partNumber,
            name: group.name,
            widthMm: group.widthMm,
            lengthMm: group.lengthMm,
            thicknessMm: group.thicknessMm,
            qty: group.qty,
            material: group.material,
          }"
          @save="(data) => handleUpdatePart(group.partNumber, data)"
          @cancel="cancelEdit"
        />
      </div>

      <!-- Add form -->
      <ManualPartRow
        v-if="showAddForm"
        :materials="materials"
        @save="handleAddPart"
        @cancel="showAddForm = false"
      />

      <UButton
        v-if="!showAddForm"
        size="sm"
        color="white"
        variant="soft"
        icon="i-lucide-plus"
        label="Add Part"
        @click="
          showAddForm = true;
          editingPartNumber = null;
        "
      />
    </div>

    <p v-if="!activeProject" class="text-center p-4 text-muted">
      Create a project to get started.
    </p>

    <!-- Empty state: no models and no manual parts -->
    <div
      v-else-if="
        activeProject.models.length === 0 && activeProject.id === activeId
      "
      class="flex flex-col items-center justify-center gap-4 px-6 py-4 text-center"
    >
      <div
        class="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center cursor-pointer hover:bg-teal-500/8 hover:border-teal-400/20 transition-colors group"
        @click="pickFile"
      >
        <UIcon
          name="i-lucide-upload"
          class="w-6 h-6 text-white/20 group-hover:text-teal-400/60 transition-colors"
        />
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-muted">No parts yet</p>
        <p class="text-sm text-muted leading-relaxed max-w-[200px]">
          Import a <span class="font-mono text-dim">.gltf</span> model, or add
          parts manually above
        </p>
      </div>
    </div>

    <div v-else-if="rows.length > 0">
      <UTable :rows="rows" :columns="columns">
        <template #warning-data="{ row }">
          <span
            v-if="row.leftoverCount > 0"
            class="inline-flex items-center gap-1.5 text-xs text-amber-500/80"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="w-3.5 h-3.5 shrink-0"
            />
            {{
              row.leftoverCount === row.qty
                ? 'No board found'
                : `${row.leftoverCount}/${row.qty} no board`
            }}
          </span>
        </template>
      </UTable>
    </div>
  </div>
</template>
