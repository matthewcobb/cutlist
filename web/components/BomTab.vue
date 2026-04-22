<script lang="ts" setup>
import { parseGltf } from '~/utils/parseGltf';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import { parseStock } from '~/utils/parseStock';
import { cycleGrainLock } from '~/utils/grain';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
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
} = useProjects();
const { distanceUnit, stock } = useProjectSettings();
const formatDistance = useFormatDistance();
const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);

// ── UI state ─────────────────────────────────────────────────────────────────

const modelsExpanded = ref(true);
const search = ref('');
const sortKey = ref<
  'number' | 'name' | 'qty' | 'thickness' | 'width' | 'length'
>('number');
const sortDir = ref<'asc' | 'desc'>('asc');
const showAddForm = ref(false);
const editingPartNumber = ref<number | null>(null);
const pendingRemoveModelId = ref<string | null>(null);

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
  qty: number;
  material: string;
  thicknessM: number;
  widthM: number;
  lengthM: number;
  grainLock?: 'length' | 'width';
  leftoverCount: number;
  isManual: boolean;
}

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
      return {
        number: part.partNumber,
        name: part.name,
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

// ── Compact dimension format ─────────────────────────────────────────────────

function formatDim(m: number | undefined | null): string {
  const s = formatDistance(m);
  if (!s) return '';
  return distanceUnit.value === 'mm' ? s.replace(/mm$/, '') : s;
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function toggleSort(key: typeof sortKey.value) {
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

// ── Manual part actions ──────────────────────────────────────────────────────

function startEditManualPart(adjustedPn: number) {
  editingPartNumber.value = adjustedPn;
  showAddForm.value = false;
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
}
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
          <span v-if="gltfModels.length > 0" class="text-xs text-muted ml-auto">
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
            Import a <span class="font-mono text-dim">.gltf</span> model, or add
            parts manually
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
          <span>{{ totalParts }} part{{ totalParts === 1 ? '' : 's' }}</span>
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
                  colspan="8"
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
                  <td colspan="8" class="px-4 py-1.5">
                    <ManualPartRow
                      :materials="materials"
                      :initial="getManualEditInfo(row.number)"
                      @save="
                        (d: ManualPartInput) => handleUpdatePart(row.number, d)
                      "
                      @cancel="editingPartNumber = null"
                    />
                  </td>
                </tr>

                <!-- Normal data row -->
                <tr
                  v-else
                  class="group/row transition-colors text-[13px]"
                  :class="
                    row.leftoverCount > 0
                      ? 'bg-amber-500/[0.06] hover:bg-amber-500/10'
                      : 'hover:bg-surface'
                  "
                >
                  <td class="pl-5 pr-4 py-2.5 text-muted tabular-nums">
                    {{ row.number }}
                  </td>
                  <td class="px-4 py-2.5 text-body font-medium">
                    {{ row.name }}
                  </td>
                  <td class="px-4 py-2.5 text-right text-body tabular-nums">
                    {{ row.qty }}
                  </td>
                  <td class="px-4 py-2.5 text-right text-muted tabular-nums">
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
                          row.grainLock ? 'i-lucide-lock' : 'i-lucide-lock-open'
                        "
                        class="w-3.5 h-3.5 shrink-0"
                      />
                      <span>{{
                        row.grainLock === 'length'
                          ? '\u2195'
                          : row.grainLock === 'width'
                            ? '\u2194'
                            : ''
                      }}</span>
                    </button>
                  </td>
                  <td class="pr-5 pl-4 py-2.5">
                    <div class="flex items-center justify-end gap-1.5">
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
</template>
