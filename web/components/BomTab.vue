<script lang="ts" setup>
import { parseGltf } from '~/utils/parseGltf';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import { parseStock } from '~/utils/parseStock';
import { cycleGrainLock } from '~/utils/grain';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import {
  STORAGE_KEYS,
  getLocalStorageJson,
  setLocalStorageJson,
} from '~/utils/localStorage';
import type { ManualPartInput } from '~/composables/useProjects';

const { data } = useBoardLayoutsQuery();
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
const { distanceUnit, stock } = useProjectSettings();
const formatDistance = useFormatDistance();
const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);
const tab = useProjectTab();
const modelViewer = useModelViewerStore();

// ── UI state ─────────────────────────────────────────────────────────────────

const modelsExpanded = ref(true);

// ── Persisted BOM filter/sort state ─────────────────────────────────────────

type SortKey = 'number' | 'name' | 'qty' | 'thickness' | 'width' | 'length';
interface BomFilter {
  search: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
}
const SORT_KEYS = new Set<SortKey>([
  'number',
  'name',
  'qty',
  'thickness',
  'width',
  'length',
]);

function loadBomFilter(): BomFilter {
  if (!activeId.value) return { search: '', sortKey: 'number', sortDir: 'asc' };
  const stored = getLocalStorageJson<Partial<BomFilter>>(
    STORAGE_KEYS.ui.projectBomFilter(activeId.value),
  );
  return {
    search: typeof stored?.search === 'string' ? stored.search : '',
    sortKey: SORT_KEYS.has(stored?.sortKey as SortKey)
      ? (stored!.sortKey as SortKey)
      : 'number',
    sortDir: stored?.sortDir === 'desc' ? 'desc' : 'asc',
  };
}

const restored = loadBomFilter();
const search = ref(restored.search);
const sortKey = ref<SortKey>(restored.sortKey);
const sortDir = ref<'asc' | 'desc'>(restored.sortDir);

watch([search, sortKey, sortDir], () => {
  if (!activeId.value) return;
  setLocalStorageJson(STORAGE_KEYS.ui.projectBomFilter(activeId.value), {
    search: search.value,
    sortKey: sortKey.value,
    sortDir: sortDir.value,
  });
});
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

const manualPartNumbers = computed(() => {
  const models = enabledModels.value;
  const offsets = computePartNumberOffsets(models);
  const set = new Set<number>();
  for (let i = 0; i < models.length; i++) {
    if (models[i].source === 'manual') {
      const seen = new Set<number>();
      for (const part of models[i].parts) {
        if (!seen.has(part.partNumber)) {
          set.add(part.partNumber + offsets[i]);
          seen.add(part.partNumber);
        }
      }
    }
  }
  return set;
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

// ── BOM rows ─────────────────────────────────────────────────────────────────

interface BomRow {
  number: number;
  name: string;
  modelId: string;
  modelName: string;
  qty: number;
  material: string;
  thicknessM: number;
  widthM: number;
  lengthM: number;
  grainLock?: 'length' | 'width';
  leftoverCount: number;
  isManual: boolean;
}

function modelDisplayName(model: {
  filename: string;
  source: 'gltf' | 'manual';
}): string {
  const filename = model.filename.trim();
  if (filename) return filename;
  return model.source === 'manual' ? 'Manual Parts' : 'Model';
}

const modelByPartNumber = computed(() => {
  const models = enabledModels.value;
  const offsets = computePartNumberOffsets(models);
  const map = new Map<number, { id: string; name: string }>();
  for (let i = 0; i < models.length; i++) {
    const label = modelDisplayName(models[i]);
    const seen = new Set<number>();
    for (const part of models[i].parts) {
      if (seen.has(part.partNumber)) continue;
      map.set(part.partNumber + offsets[i], {
        id: models[i].id,
        name: label,
      });
      seen.add(part.partNumber);
    }
  }
  return map;
});

const allRows = computed<BomRow[]>(() => {
  // Use packing engine results when available (authoritative)
  if (data.value != null) {
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
      const model = modelByPartNumber.value.get(part.partNumber);
      return {
        number: part.partNumber,
        name: part.name,
        modelId: model?.id ?? '',
        modelName: model?.name ?? '',
        qty: instanceList.length,
        material: part.material,
        thicknessM: part.thicknessM,
        widthM: part.widthM,
        lengthM: part.lengthM,
        grainLock: part.grainLock,
        leftoverCount: leftoverCounts.get(part.partNumber) ?? 0,
        isManual: manualPartNumbers.value.has(part.partNumber),
      };
    });
  }

  // Fallback: build from raw model parts when engine hasn't run
  const project = activeProject.value;
  if (!project) return [];
  const models = enabledModels.value;
  if (models.length === 0) return [];

  const offsets = computePartNumberOffsets(models);
  const excluded = new Set(project.excludedColors ?? []);
  const groups = new Map<number, BomRow>();

  for (let i = 0; i < models.length; i++) {
    const isManual = models[i].source === 'manual';
    const byPn = new Map<number, (typeof models)[0]['parts'][number][]>();
    for (const part of models[i].parts) {
      if (excluded.has(part.colorKey)) continue;
      const list = byPn.get(part.partNumber) ?? [];
      list.push(part);
      byPn.set(part.partNumber, list);
    }
    for (const [pn, parts] of byPn) {
      groups.set(pn + offsets[i], {
        number: pn + offsets[i],
        name: parts[0].name,
        modelId: models[i].id,
        modelName: modelDisplayName(models[i]),
        material: project.colorMap[parts[0].colorKey] ?? parts[0].colorKey,
        qty: parts.length,
        thicknessM: parts[0].size.thickness,
        widthM: parts[0].size.width,
        lengthM: parts[0].size.length,
        grainLock: parts[0].grainLock,
        leftoverCount: 0,
        isManual,
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.number - b.number);
});

// ── Summary ──────────────────────────────────────────────────────────────────

const totalParts = computed(() => allRows.value.reduce((s, r) => s + r.qty, 0));
const materialNames = computed(() => [
  ...new Set(allRows.value.map((r) => r.material)),
]);
const warningCount = computed(
  () => allRows.value.filter((r) => r.leftoverCount > 0).length,
);

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

// ── Sorting ──────────────────────────────────────────────────────────────────

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

function sortCompare(a: BomRow, b: BomRow): number {
  let cmp = 0;
  switch (sortKey.value) {
    case 'number':
      cmp = a.number - b.number;
      break;
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'qty':
      cmp = a.qty - b.qty;
      break;
    case 'thickness':
      cmp = a.thicknessM - b.thicknessM;
      break;
    case 'width':
      cmp = a.widthM - b.widthM;
      break;
    case 'length':
      cmp = a.lengthM - b.lengthM;
      break;
  }
  return sortDir.value === 'desc' ? -cmp : cmp;
}

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

// ── Filtered + grouped ───────────────────────────────────────────────────────

interface MaterialGroup {
  material: string;
  rows: BomRow[];
  totalParts: number;
}

const filteredGroups = computed<MaterialGroup[]>(() => {
  let filtered = allRows.value;
  const q = search.value.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.modelName.toLowerCase().includes(q) ||
        r.material.toLowerCase().includes(q) ||
        String(r.number).includes(q),
    );
  }
  filtered = [...filtered].sort(sortCompare);

  const map = new Map<string, BomRow[]>();
  for (const row of filtered) {
    const list = map.get(row.material) ?? [];
    list.push(row);
    map.set(row.material, list);
  }
  return [...map.entries()].map(([material, rows]) => ({
    material,
    rows,
    totalParts: rows.reduce((s, r) => s + r.qty, 0),
  }));
});

const showModelColumn = computed(
  () =>
    new Set(allRows.value.map((row) => row.modelId).filter(Boolean)).size > 1,
);
const tableColspan = computed(() => (showModelColumn.value ? 9 : 8));

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

async function handleRemovePart(adjustedPn: number) {
  if (!activeId.value) return;
  await removeManualPart(activeId.value, adjustedPn - manualPartOffset.value);
  if (editingPartNumber.value === adjustedPn) editingPartNumber.value = null;
  if (renamingPartNumber.value === adjustedPn) cancelRenamePart();
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
            class="mx-4 mt-3 mb-2 border border-default rounded-lg bg-base overflow-hidden"
          >
            <button
              type="button"
              class="flex items-center gap-2 w-full p-3 text-left hover:bg-surface transition-colors"
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
                    @click="
                      removeModel(activeProject!.id, model.id);
                      pendingRemoveModelId = null;
                    "
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
              activeProject.models.length === 0 &&
              activeProject.id === activeId &&
              !showAddForm
            "
            class="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center"
          >
            <div
              class="w-14 h-14 rounded-2xl bg-surface border border-subtle flex items-center justify-center cursor-pointer hover:bg-teal-400/10 hover:border-teal-400/20 transition-colors group"
              @click="pickFile"
            >
              <UIcon
                name="i-lucide-upload"
                class="w-6 h-6 text-dim group-hover:text-teal-400/60 transition-colors"
              />
            </div>
            <div class="space-y-1">
              <p class="text-sm font-medium text-muted">No parts yet</p>
              <p class="text-sm text-muted leading-relaxed max-w-[220px]">
                Import a <span class="font-mono text-dim">.gltf</span> model, or
                add parts manually
              </p>
            </div>
            <div class="flex items-center gap-2">
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
                label="Add Part"
                @click="showAddForm = true"
              />
            </div>
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

            <!-- Add Part form -->
            <div v-if="showAddForm" class="px-5 pb-3">
              <ManualPartRow
                :materials="materials"
                @save="handleAddPart"
                @cancel="showAddForm = false"
              />
            </div>

            <!-- Parts table -->
            <table
              v-if="filteredGroups.length > 0"
              class="w-full text-sm border-separate border-spacing-0"
            >
              <thead
                class="sticky top-0 z-10 bg-base shadow-[inset_0_-1px_0_var(--color-mist-800)]"
              >
                <tr>
                  <th
                    class="pl-5 pr-4 py-2.5 text-left text-xs font-medium text-muted tracking-wide cursor-pointer select-none hover:text-body transition-colors w-14"
                    @click="toggleSort('number')"
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
                    @click="toggleSort('name')"
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
                    @click="toggleSort('qty')"
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
                    @click="toggleSort('thickness')"
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
                    @click="toggleSort('width')"
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
                    @click="toggleSort('length')"
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
  </div>
</template>
