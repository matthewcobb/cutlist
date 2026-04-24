<script lang="ts" setup>
import { parseGltf } from '~/utils/parseGltf';
import { parseStock } from '~/utils/parseStock';
import { cycleGrainLock } from '~/utils/grain';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { STORAGE_KEYS } from '~/utils/localStorage';
import type { ManualPartInput } from '~/composables/useProjects';
import type { BomRow } from '~/composables/useBomRows';
import type { SortKey } from '~/composables/useBomFilter';

const {
  activeProject,
  activeId,
  enabledModels,
  manualModel,
  addModel,
  removeModel,
  toggleModel,
  addManualPart,
  updateManualPart,
  removeManualPart,
  updatePartGrainLock,
  updatePartNameOverride,
} = useProjects();
const { undo } = useUndo();
const { distanceUnit, stock } = useProjectSettings();
const formatDistance = useFormatDistance();
const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);
const tab = useProjectTab();
const modelViewer = useModelViewerStore();

// ── BOM rows & filter (extracted composables) ────────────────────────────────

const {
  allRows,
  totalParts,
  materialNames,
  warningCount,
  showModelColumn,
  manualPartNumbers,
} = useBomRows();
const { search, sortKey, sortDir, toggleSort, filteredGroups } = useBomFilter(
  activeId,
  allRows,
);

// ── UI state ─────────────────────────────────────────────────────────────────

const modelsExpanded = ref(true);
const showAddForm = ref(false);
const editingPartNumber = ref<number | null>(null);
const renamingPartNumber = ref<number | null>(null);
const partNameDraft = ref('');
const partNameInput = ref<HTMLInputElement | null>(null);
function onPartNameInputMounted(el: unknown) {
  const input = el as HTMLInputElement | null;
  partNameInput.value = input;
  input?.select();
}
const pendingRemoveModelId = ref<string | null>(null);
const splitContainer = ref<HTMLDivElement | null>(null);

// ── File import ──────────────────────────────────────────────────────────────

function pickFile() {
  fileInput.value?.click();
}

async function importFiles(files: File[]) {
  if (!files.length || !activeId.value) return;
  for (const file of files) {
    try {
      const result = await parseGltf(file);
      addModel(activeId.value, {
        id: crypto.randomUUID(),
        filename: file.name,
        source: 'gltf',
        parts: result.parts,
        colors: result.colors,
        enabled: true,
        gltfJson: result.gltfJson,
        nodePartMap: result.nodePartMap,
      });
      toast.add({
        title: 'Imported',
        description: `${file.name}: ${result.parts.length} parts, ${result.colors.length} color${result.colors.length === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      toast.add({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        color: 'error',
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

// ── Drag & drop ──────────────────────────────────────────────────────────────

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

// ── Materials list ───────────────────────────────────────────────────────────

const materials = computed(() => {
  if (!stock.value) return [];
  try {
    return parseStock(stock.value).map((s) => s.material);
  } catch {
    return [];
  }
});

// ── Manual part tracking ─────────────────────────────────────────────────────

const manualPartOffset = computed(() => {
  const models = enabledModels.value;
  const offsets = computePartNumberOffsets(models);
  for (let i = 0; i < models.length; i++) {
    if (models[i].source === 'manual') return offsets[i];
  }
  return 0;
});

const manualPartInfoMap = computed(() => {
  const model = manualModel.value;
  if (!model)
    return new Map<number, ManualPartInput & { partNumber: number }>();
  const groups = new Map<number, (typeof model.parts)[number][]>();
  for (const part of model.parts) {
    const list = groups.get(part.partNumber) ?? [];
    list.push(part);
    groups.set(part.partNumber, list);
  }
  const result = new Map<number, ManualPartInput & { partNumber: number }>();
  for (const [pn, parts] of groups) {
    result.set(pn, {
      partNumber: pn,
      name: parts[0].name,
      widthMm: Math.round(parts[0].size.width * 1000),
      lengthMm: Math.round(parts[0].size.length * 1000),
      thicknessMm: Math.round(parts[0].size.thickness * 1000),
      qty: parts.length,
      material: parts[0].colorKey,
      grainLock: parts[0].grainLock,
    });
  }
  return result;
});

function getManualEditInfo(adjustedPn: number) {
  return manualPartInfoMap.value.get(adjustedPn - manualPartOffset.value);
}

const gltfModels = computed(
  () => activeProject.value?.models.filter((m) => m.source !== 'manual') ?? [],
);
const totalModelParts = computed(() =>
  gltfModels.value.reduce((s, m) => s + m.parts.length, 0),
);
const hasModelPreview = computed(() =>
  enabledModels.value.some((m) => m.source !== 'manual'),
);
const {
  panelWidth: previewPanelWidth,
  isResizing: isResizingPreview,
  startResize: startPreviewResize,
} = usePersistedSplitPanel(splitContainer, hasModelPreview, {
  storageKey: () =>
    STORAGE_KEYS.ui.projectBomPreviewWidth(activeId.value ?? '__none__'),
  minPanelWidthPx: 280,
  minMainWidthPx: 420,
  defaultPanelRatio: 1 / 2,
});
const highlightedPartNumber = computed(
  () =>
    modelViewer.hoveredPartNumber.value ?? modelViewer.selectedPartNumber.value,
);

// ── Compact dimension format ─────────────────────────────────────────────────

function formatDim(m: number | undefined | null): string {
  const s = formatDistance(m);
  if (!s) return '';
  return distanceUnit.value === 'mm' ? s.replace(/mm$/, '') : s;
}

const tableColspan = computed(() => (showModelColumn.value ? 9 : 8));

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('button,input,textarea,select,a,[role="button"],label'),
  );
}

function onRowClick(row: BomRow, event: MouseEvent) {
  if (isInteractiveTarget(event.target)) return;
  modelViewer.selectedPartNumber.value = row.number;
}

function onRowEnter(row: BomRow) {
  modelViewer.hoveredPartNumber.value = row.number;
}

function onRowLeave(row: BomRow) {
  if (modelViewer.hoveredPartNumber.value === row.number) {
    modelViewer.hoveredPartNumber.value = null;
  }
}

function clearBomHover() {
  modelViewer.hoveredPartNumber.value = null;
}

function openModelTab() {
  tab.value = 'model';
}

// ── Manual part actions ──────────────────────────────────────────────────────

function startEditManualPart(adjustedPn: number) {
  editingPartNumber.value = adjustedPn;
  renamingPartNumber.value = null;
  showAddForm.value = false;
}

function startRenamePart(row: BomRow) {
  renamingPartNumber.value = row.number;
  partNameDraft.value = row.name;
  editingPartNumber.value = null;
}

function cancelRenamePart() {
  renamingPartNumber.value = null;
  partNameDraft.value = '';
}

async function saveRenamePart(row: BomRow) {
  if (renamingPartNumber.value !== row.number) return;
  if (!activeId.value) return;
  const nextName = partNameDraft.value.trim();
  if (!nextName) {
    toast.add({
      title: 'Name required',
      description: 'Part name cannot be empty.',
      color: 'error',
    });
    return;
  }
  if (nextName !== row.name) {
    await updatePartNameOverride(activeId.value, row.number, nextName);
  }
  cancelRenamePart();
}

async function handleAddPart(input: ManualPartInput) {
  if (!activeId.value) return;
  await addManualPart(activeId.value, input);
  showAddForm.value = false;
}

async function handleUpdatePart(adjustedPn: number, input: ManualPartInput) {
  if (!activeId.value) return;
  await updateManualPart(
    activeId.value,
    adjustedPn - manualPartOffset.value,
    input,
  );
  editingPartNumber.value = null;
}

async function handleRemoveModel(modelId: string) {
  if (!activeId.value || !activeProject.value) return;
  const model = activeProject.value.models.find((m) => m.id === modelId);
  const filename = model?.filename ?? 'model';
  await removeModel(activeId.value, modelId);
  pendingRemoveModelId.value = null;
  toast.add({
    title: 'Model removed',
    description: filename,
    duration: 5000,
    actions: [
      {
        label: 'Undo',
        color: 'primary' as const,
        onClick: () => {
          undo();
        },
      },
    ],
  });
}

async function handleRemovePart(adjustedPn: number) {
  if (!activeId.value) return;
  const partName =
    manualPartInfoMap.value.get(adjustedPn - manualPartOffset.value)?.name ??
    'part';
  await removeManualPart(activeId.value, adjustedPn - manualPartOffset.value);
  if (editingPartNumber.value === adjustedPn) editingPartNumber.value = null;
  if (renamingPartNumber.value === adjustedPn) cancelRenamePart();
  toast.add({
    title: 'Part removed',
    description: partName,
    duration: 5000,
    actions: [
      {
        label: 'Undo',
        color: 'primary' as const,
        onClick: () => {
          undo();
        },
      },
    ],
  });
}

onUnmounted(() => {
  clearBomHover();
});
</script>

<template>
  <div
    class="absolute inset-0 overflow-hidden"
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
      aria-label="Import GLTF model files"
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
        class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-overlay border-2 border-dashed border-teal-400/50 rounded-lg m-1 pointer-events-none"
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

    <div ref="splitContainer" class="absolute inset-0 flex min-h-0 min-w-0">
      <div
        class="relative flex-1 min-h-0 min-w-0 overflow-auto"
        @mouseleave="clearBomHover"
      >
        <template v-if="activeProject">
          <!-- ─── Collapsible Models Panel ──────────────────────────────────── -->
          <div
            v-if="activeProject.models.length > 0"
            class="mx-4 mt-3 mb-2 border border-default rounded-lg bg-base overflow-hidden"
          >
            <button
              type="button"
              class="flex items-center gap-2 w-full p-3 text-left hover:bg-surface transition-colors"
              :aria-expanded="modelsExpanded"
              aria-label="Toggle models panel"
              @click="modelsExpanded = !modelsExpanded"
            >
              <UIcon
                :name="
                  modelsExpanded
                    ? 'i-lucide-chevron-down'
                    : 'i-lucide-chevron-right'
                "
                class="w-4 h-4 text-dim shrink-0"
              />
              <span class="text-sm font-medium text-hi">Models</span>
              <span
                v-if="gltfModels.length > 0"
                class="text-xs text-muted ml-auto"
              >
                {{ gltfModels.length }} model{{
                  gltfModels.length === 1 ? '' : 's'
                }}
                &middot; {{ totalModelParts }} part{{
                  totalModelParts === 1 ? '' : 's'
                }}
              </span>
            </button>

            <div
              v-if="modelsExpanded"
              class="px-3 pb-3 space-y-2 border-t border-subtle"
            >
              <div
                v-for="model in gltfModels"
                :key="model.id"
                class="flex items-center gap-2 first:mt-2"
              >
                <UCheckbox
                  :model-value="model.enabled"
                  @update:model-value="toggleModel(activeProject!.id, model.id)"
                />
                <span class="text-sm text-body truncate flex-1">{{
                  model.filename
                }}</span>
                <span class="text-xs text-muted shrink-0">
                  {{ model.parts.length }} part{{
                    model.parts.length === 1 ? '' : 's'
                  }}
                </span>
                <template v-if="pendingRemoveModelId === model.id">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    label="Cancel"
                    @click="pendingRemoveModelId = null"
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="solid"
                    label="Remove"
                    @click="handleRemoveModel(model.id)"
                  />
                </template>
                <UButton
                  v-else
                  size="xs"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  class="rounded-full"
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
              <ColorMappingPanel />
            </div>
          </div>

          <!-- ─── Empty state ───────────────────────────────────────────────── -->
          <div
            v-if="
              activeProject.models.length === 0 && activeProject.id === activeId
            "
            class="px-6 py-6 pb-24 space-y-6 max-w-lg mx-auto"
          >
            <!-- Heading + actions -->
            <div class="text-center space-y-3">
              <div
                class="w-14 h-14 rounded-2xl bg-surface border border-subtle flex items-center justify-center mx-auto cursor-pointer hover:bg-teal-400/10 hover:border-teal-400/20 transition-colors group"
                @click="pickFile"
              >
                <UIcon
                  name="i-lucide-package-open"
                  class="w-6 h-6 text-dim group-hover:text-teal-400/60 transition-colors"
                />
              </div>
              <div class="space-y-1">
                <p class="text-base font-semibold text-hi">
                  Drag your .gltf model here
                </p>
                <p class="text-sm text-muted leading-relaxed">
                  Optimised for Onshape, but any GLTF export will work. Import a
                  model to automatically generate your cut list, or add parts
                  manually.
                </p>
              </div>
              <div class="flex items-center justify-center gap-2">
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-upload"
                  label="Import Model"
                  @click="pickFile"
                />
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-plus"
                  label="Add Part Manually"
                  @click="showAddForm = true"
                />
              </div>
            </div>

            <!-- Workflow steps -->
            <ol class="space-y-4 list-none pl-0">
              <li class="flex gap-3">
                <span
                  class="shrink-0 w-6 h-6 rounded-full bg-teal-400/15 text-teal-400 text-xs font-bold flex items-center justify-center mt-0.5"
                  >1</span
                >
                <div>
                  <p class="text-sm font-medium text-body">
                    Build your model in Onshape
                  </p>
                  <p class="text-sm text-muted leading-relaxed mt-0.5">
                    Model each part at its real-world dimensions. Assign a
                    unique appearance colour to each material&nbsp;&mdash; e.g.
                    oak parts one colour, plywood another.
                  </p>
                </div>
              </li>
              <li class="flex gap-3">
                <span
                  class="shrink-0 w-6 h-6 rounded-full bg-teal-400/15 text-teal-400 text-xs font-bold flex items-center justify-center mt-0.5"
                  >2</span
                >
                <div>
                  <p class="text-sm font-medium text-body">Export as GLTF</p>
                  <p class="text-sm text-muted leading-relaxed mt-0.5">
                    In Onshape, choose
                    <span class="font-semibold text-body"
                      >File &rarr; Export</span
                    >, set format to
                    <span class="font-mono text-dim">GLTF</span>, and download.
                  </p>
                  <img
                    src="/onshape-export.png"
                    alt="Onshape export dialog showing GLTF format selected"
                    class="mt-2 rounded-lg border border-subtle w-full"
                  />
                </div>
              </li>
              <li class="flex gap-3">
                <span
                  class="shrink-0 w-6 h-6 rounded-full bg-teal-400/15 text-teal-400 text-xs font-bold flex items-center justify-center mt-0.5"
                  >3</span
                >
                <div>
                  <p class="text-sm font-medium text-body">
                    Import to Cutlist Studio
                  </p>
                  <p class="text-sm text-muted leading-relaxed mt-0.5">
                    Drop the
                    <span class="font-mono text-dim">.gltf</span> file below or
                    click Import. Map each colour to a stock material, and the
                    optimiser will generate your board layouts.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <!-- ─── Main BOM content ──────────────────────────────────────────── -->
          <template v-else>
            <!-- Summary bar -->
            <div
              v-if="allRows.length > 0"
              class="flex items-center gap-2 px-5 pt-2 pb-1 text-xs text-muted"
            >
              <span
                >{{ totalParts }} part{{ totalParts === 1 ? '' : 's' }}</span
              >
              <span class="text-dim">&middot;</span>
              <span
                >{{ materialNames.length }} material{{
                  materialNames.length === 1 ? '' : 's'
                }}</span
              >
              <template v-if="warningCount > 0">
                <span class="text-dim">&middot;</span>
                <span class="text-amber-500"
                  >{{ warningCount }} warning{{
                    warningCount === 1 ? '' : 's'
                  }}</span
                >
              </template>
            </div>

            <!-- Toolbar: search + add part -->
            <div class="flex items-center gap-2 px-5 pb-3">
              <UInput
                v-model="search"
                placeholder="Filter parts..."
                icon="i-lucide-search"
                size="sm"
                class="flex-1"
              />
              <UButton
                size="sm"
                variant="soft"
                color="neutral"
                icon="i-lucide-plus"
                label="Add Part"
                @click="
                  showAddForm = true;
                  editingPartNumber = null;
                "
              />
            </div>

            <!-- Parts table -->
            <table
              v-if="filteredGroups.length > 0"
              class="w-full text-sm border-separate border-spacing-0"
              aria-label="Bill of materials"
            >
              <thead
                class="sticky top-0 z-10 bg-base shadow-[inset_0_-1px_0_var(--color-mist-800)]"
              >
                <tr>
                  <th
                    class="pl-5 pr-4 py-2.5 text-left text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-14"
                    :aria-sort="
                      sortKey === 'number'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('number')"
                    @keydown.enter.prevent="toggleSort('number')"
                    @keydown.space.prevent="toggleSort('number')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center gap-0.5">
                      #
                      <UIcon
                        v-if="sortKey === 'number'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    class="px-4 py-2.5 text-left text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors"
                    :aria-sort="
                      sortKey === 'name'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('name')"
                    @keydown.enter.prevent="toggleSort('name')"
                    @keydown.space.prevent="toggleSort('name')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center gap-0.5">
                      Name
                      <UIcon
                        v-if="sortKey === 'name'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    v-if="showModelColumn"
                    class="px-4 py-2.5 text-left text-xs font-medium text-muted tracking-wide w-48"
                  >
                    Model
                  </th>
                  <th
                    class="px-4 py-2.5 text-right text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-14"
                    :aria-sort="
                      sortKey === 'qty'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('qty')"
                    @keydown.enter.prevent="toggleSort('qty')"
                    @keydown.space.prevent="toggleSort('qty')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center justify-end gap-0.5">
                      QTY
                      <UIcon
                        v-if="sortKey === 'qty'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    class="px-4 py-2.5 text-right text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-18"
                    :aria-sort="
                      sortKey === 'thickness'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('thickness')"
                    @keydown.enter.prevent="toggleSort('thickness')"
                    @keydown.space.prevent="toggleSort('thickness')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center justify-end gap-0.5">
                      T
                      <UIcon
                        v-if="sortKey === 'thickness'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    class="px-4 py-2.5 text-right text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-22"
                    :aria-sort="
                      sortKey === 'width'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('width')"
                    @keydown.enter.prevent="toggleSort('width')"
                    @keydown.space.prevent="toggleSort('width')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center justify-end gap-0.5">
                      W
                      <UIcon
                        v-if="sortKey === 'width'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    class="px-4 py-2.5 text-right text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-22"
                    :aria-sort="
                      sortKey === 'length'
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    "
                    @click="toggleSort('length')"
                    @keydown.enter.prevent="toggleSort('length')"
                    @keydown.space.prevent="toggleSort('length')"
                    tabindex="0"
                    role="columnheader"
                  >
                    <span class="inline-flex items-center justify-end gap-0.5">
                      L
                      <UIcon
                        v-if="sortKey === 'length'"
                        :name="
                          sortDir === 'asc'
                            ? 'i-lucide-chevron-up'
                            : 'i-lucide-chevron-down'
                        "
                        class="w-3 h-3 text-teal-400"
                      />
                    </span>
                  </th>
                  <th
                    class="px-4 py-2.5 text-left text-xs font-medium text-muted tracking-wide w-16"
                  >
                    Grain
                  </th>
                  <th class="pr-5 w-28"></th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="(group, gi) in filteredGroups"
                  :key="group.material"
                >
                  <!-- Material group header -->
                  <tr>
                    <td
                      :colspan="tableColspan"
                      :class="['px-5 pb-1.5', gi === 0 ? 'pt-3' : 'pt-5']"
                    >
                      <div
                        class="flex items-center gap-2.5 pb-1.5 border-b border-subtle"
                      >
                        <span class="text-sm font-semibold text-body">{{
                          group.material
                        }}</span>
                        <span class="text-xs text-muted"
                          >{{ group.totalParts }} part{{
                            group.totalParts === 1 ? '' : 's'
                          }}</span
                        >
                      </div>
                    </td>
                  </tr>

                  <!-- Data rows -->
                  <template v-for="row in group.rows" :key="row.number">
                    <!-- Inline edit form for manual parts -->
                    <tr v-if="row.isManual && editingPartNumber === row.number">
                      <td :colspan="tableColspan" class="px-4 py-1.5">
                        <ManualPartRow
                          :materials="materials"
                          :initial="getManualEditInfo(row.number)"
                          @save="
                            (d: ManualPartInput) =>
                              handleUpdatePart(row.number, d)
                          "
                          @cancel="editingPartNumber = null"
                        />
                      </td>
                    </tr>

                    <!-- Normal data row -->
                    <tr
                      v-else
                      class="group/row transition-colors text-[13px] cursor-pointer"
                      :class="[
                        row.leftoverCount > 0
                          ? 'bg-amber-500/[0.06] hover:bg-amber-500/10'
                          : 'hover:bg-surface',
                        highlightedPartNumber === row.number
                          ? 'bg-teal-500/12 ring-1 ring-inset ring-teal-400/40'
                          : '',
                      ]"
                      @mouseenter="onRowEnter(row)"
                      @mouseleave="onRowLeave(row)"
                      @click="onRowClick(row, $event)"
                    >
                      <td class="pl-5 pr-4 py-2.5 text-muted tabular-nums">
                        {{ row.number }}
                      </td>
                      <td class="px-4 py-2.5 text-body font-medium">
                        <div
                          v-if="renamingPartNumber === row.number"
                          class="max-w-[16rem]"
                        >
                          <input
                            :ref="onPartNameInputMounted"
                            v-model="partNameDraft"
                            class="w-full text-[13px] font-medium bg-transparent text-teal-400 outline-none border-b border-teal-400/50"
                            @keydown.enter.prevent="saveRenamePart(row)"
                            @keydown.esc.prevent="cancelRenamePart"
                            @blur="saveRenamePart(row)"
                            @click.stop
                            @dblclick.stop
                          />
                        </div>
                        <span
                          v-else
                          class="cursor-text"
                          :title="
                            row.isManual
                              ? 'Double click to edit part'
                              : 'Double click to rename part'
                          "
                          @dblclick="
                            row.isManual
                              ? startEditManualPart(row.number)
                              : startRenamePart(row)
                          "
                        >
                          {{ row.name }}
                        </span>
                      </td>
                      <td
                        v-if="showModelColumn"
                        class="px-4 py-2.5 text-muted truncate max-w-[14rem]"
                        :title="row.modelName"
                      >
                        {{ row.modelName }}
                      </td>
                      <td class="px-4 py-2.5 text-right text-body tabular-nums">
                        {{ row.qty }}
                      </td>
                      <td
                        class="px-4 py-2.5 text-right text-muted tabular-nums"
                      >
                        {{ formatDim(row.thicknessM) }}
                      </td>
                      <td class="px-4 py-2.5 text-right text-body tabular-nums">
                        {{ formatDim(row.widthM) }}
                      </td>
                      <td class="px-4 py-2.5 text-right text-body tabular-nums">
                        {{ formatDim(row.lengthM) }}
                      </td>
                      <td class="px-4 py-2.5">
                        <button
                          v-if="activeId"
                          type="button"
                          :aria-label="
                            row.grainLock === 'length'
                              ? 'Grain locked to length. Click to lock width.'
                              : row.grainLock === 'width'
                                ? 'Grain locked to width. Click to unlock.'
                                : 'Grain unlocked. Click to lock grain.'
                          "
                          :title="
                            row.grainLock === 'length'
                              ? 'Length with grain (\u2195) \u2014 click to lock width'
                              : row.grainLock === 'width'
                                ? 'Width with grain (\u2194) \u2014 click to unlock'
                                : 'Free rotation \u2014 click to lock grain'
                          "
                          :class="[
                            'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
                            row.grainLock
                              ? 'text-teal-400 hover:text-teal-300'
                              : 'text-dim hover:text-muted',
                          ]"
                          @click="
                            updatePartGrainLock(
                              activeId!,
                              row.number,
                              cycleGrainLock(row.grainLock),
                            )
                          "
                        >
                          <UIcon
                            :name="
                              row.grainLock
                                ? 'i-lucide-lock'
                                : 'i-lucide-lock-open'
                            "
                            class="w-3.5 h-3.5 shrink-0"
                          />
                          <UIcon
                            v-if="row.grainLock === 'length'"
                            name="i-ri-arrow-up-down-line"
                            class="w-3.5 h-3.5 shrink-0"
                          />
                          <UIcon
                            v-else-if="row.grainLock === 'width'"
                            name="i-ri-arrow-left-right-line"
                            class="w-3.5 h-3.5 shrink-0"
                          />
                        </button>
                      </td>
                      <td class="pr-5 pl-4 py-2.5">
                        <div class="flex items-center justify-end gap-1.5">
                          <template v-if="renamingPartNumber === row.number">
                            <UButton
                              size="xs"
                              color="primary"
                              variant="soft"
                              label="Save"
                              @mousedown.prevent
                              @click="saveRenamePart(row)"
                            />
                            <UButton
                              size="xs"
                              color="neutral"
                              variant="ghost"
                              label="Cancel"
                              @mousedown.prevent
                              @click="cancelRenamePart"
                            />
                          </template>
                          <template v-else>
                            <span
                              v-if="row.leftoverCount > 0"
                              class="inline-flex items-center gap-1 text-xs text-amber-500"
                              :title="
                                row.leftoverCount === row.qty
                                  ? 'No board found for this part'
                                  : `${row.leftoverCount} of ${row.qty} could not be placed`
                              "
                            >
                              <UIcon
                                name="i-lucide-triangle-alert"
                                class="w-3.5 h-3.5 shrink-0"
                              />
                              <span class="hidden sm:inline whitespace-nowrap">
                                {{
                                  row.leftoverCount === row.qty
                                    ? 'No board'
                                    : `${row.leftoverCount}/${row.qty}`
                                }}
                              </span>
                            </span>
                            <UButton
                              v-if="!row.isManual"
                              size="xs"
                              icon="i-lucide-square-pen"
                              color="neutral"
                              variant="ghost"
                              class="rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity"
                              title="Rename part"
                              @click="startRenamePart(row)"
                            />
                            <template v-if="row.isManual">
                              <UButton
                                size="xs"
                                icon="i-lucide-square-pen"
                                color="neutral"
                                variant="ghost"
                                class="rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity"
                                title="Edit part"
                                @click="startEditManualPart(row.number)"
                              />
                              <UButton
                                size="xs"
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                class="rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity"
                                title="Remove part"
                                @click="handleRemovePart(row.number)"
                              />
                            </template>
                          </template>
                        </div>
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>

            <!-- No search results -->
            <div
              v-else-if="allRows.length > 0 && search.trim()"
              class="flex flex-col items-center gap-2 py-8 text-sm text-muted"
            >
              <UIcon name="i-lucide-search-x" class="w-5 h-5 text-dim" />
              No parts matching "{{ search }}"
            </div>
          </template>
        </template>

        <p v-else class="text-center p-4 text-muted">
          Create a project to get started.
        </p>
      </div>

      <template v-if="activeProject && hasModelPreview">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panel"
          class="relative w-3 shrink-0 cursor-col-resize select-none group"
          @mousedown="startPreviewResize"
        >
          <div
            class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-mist-700/55 transition-colors"
            :class="
              isResizingPreview
                ? 'bg-teal-400/85'
                : 'group-hover:bg-teal-400/65'
            "
          />
          <div
            class="absolute top-1/2 left-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mist-700/60 transition-colors"
            :class="
              isResizingPreview
                ? 'bg-teal-400/90'
                : 'group-hover:bg-teal-400/70'
            "
          />
        </div>

        <aside
          class="relative shrink-0 min-h-0 bg-mist-950 shadow-[-1px_0_0_0_rgba(57,68,71,0.35)]"
          :style="{ width: `${previewPanelWidth}px` }"
          @mouseleave="clearBomHover"
        >
          <ModelTab compact show-open-button @expand="openModelTab" />
        </aside>
      </template>
    </div>

    <!-- Add Part modal -->
    <UModal v-model:open="showAddForm">
      <template #content>
        <div
          class="p-6 flex flex-col gap-4 bg-elevated border border-default rounded-lg"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-hi">Add Part</h2>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="rounded-full"
              @click="showAddForm = false"
            />
          </div>
          <ManualPartRow
            :materials="materials"
            @save="handleAddPart"
            @cancel="showAddForm = false"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
