<script lang="ts" setup>
import type { IdbBuildStep } from '~/composables/useIdb';

const { activeProject, enabledModels, allColors } = useProjects();
const { buildSteps, addStep, updateStep, removeStep, moveStep } =
  useBuildSteps();
const formatDistance = useFormatDistance();

// ─── Available parts (from all enabled models) ────────────────────────────────

interface PartSummary {
  modelId: string;
  partNumber: number;
  name: string;
  colorKey: string;
  qty: number;
  size: { width: number; length: number; thickness: number };
}

const availableParts = computed<PartSummary[]>(() => {
  const result: PartSummary[] = [];
  for (const model of enabledModels.value) {
    const partMap = new Map<number, PartSummary>();
    for (const part of model.parts) {
      const existing = partMap.get(part.partNumber);
      if (existing) {
        existing.qty++;
      } else {
        partMap.set(part.partNumber, {
          modelId: model.id,
          partNumber: part.partNumber,
          name: part.name,
          colorKey: part.colorKey,
          qty: 1,
          size: part.size,
        });
      }
    }
    result.push(...partMap.values());
  }
  return result.sort((a, b) => a.partNumber - b.partNumber);
});

const colorByKey = computed(() => {
  const map = new Map<string, [number, number, number]>();
  for (const c of allColors.value) {
    map.set(c.key, c.rgb);
  }
  return map;
});

function rgbStyle(rgb: [number, number, number] | undefined): string {
  if (!rgb) return 'background: #4b5563';
  return `background: rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
}

function partColor(colorKey: string): string {
  return rgbStyle(colorByKey.value.get(colorKey));
}

// ─── Part refs resolved for display ──────────────────────────────────────────

function resolveStepParts(step: IdbBuildStep): PartSummary[] {
  return step.partRefs
    .map((ref) =>
      availableParts.value.find(
        (p) => p.modelId === ref.modelId && p.partNumber === ref.partNumber,
      ),
    )
    .filter((p): p is PartSummary => p !== undefined);
}

// ─── Edit state ───────────────────────────────────────────────────────────────

const editingId = ref<string | null>(null);

interface EditDraft {
  title: string;
  description: string;
  partRefs: Set<string>; // "modelId:partNumber" keys
}

const editDraft = ref<EditDraft>({
  title: '',
  description: '',
  partRefs: new Set(),
});

function partKey(modelId: string, partNumber: number) {
  return `${modelId}:${partNumber}`;
}

function startEdit(step: IdbBuildStep) {
  editingId.value = step.id;
  editDraft.value = {
    title: step.title,
    description: step.description,
    partRefs: new Set(
      step.partRefs.map((r) => partKey(r.modelId, r.partNumber)),
    ),
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(stepId: string) {
  const draft = editDraft.value;
  const partRefs = [...draft.partRefs].map((key) => {
    const [modelId, pn] = key.split(':');
    return { modelId, partNumber: parseInt(pn, 10) };
  });
  await updateStep(stepId, {
    title: draft.title,
    description: draft.description,
    partRefs,
  });
  editingId.value = null;
}

function togglePartRef(p: PartSummary) {
  const key = partKey(p.modelId, p.partNumber);
  const next = new Set(editDraft.value.partRefs);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  editDraft.value = { ...editDraft.value, partRefs: next };
}

// ─── Add step ─────────────────────────────────────────────────────────────────

async function handleAddStep() {
  const id = await addStep();
  if (id) {
    const step = buildSteps.value.find((s) => s.id === id);
    if (step) startEdit(step);
  }
}

// ─── Step number label (zero-padded) ─────────────────────────────────────────

function stepLabel(n: number): string {
  return String(n).padStart(2, '0');
}

function sizeLabel(part: PartSummary): string {
  return `${formatDistance(part.size.thickness)} × ${formatDistance(part.size.width)} × ${formatDistance(part.size.length)}`;
}
</script>

<template>
  <div class="p-4 space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-book-open" class="w-4 h-4 text-teal-400" />
        <span class="text-sm font-semibold text-white">Build Instructions</span>
      </div>
      <UButton
        v-if="activeProject"
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        label="Add Step"
        @click="handleAddStep"
      />
    </div>

    <!-- Empty state -->
    <div
      v-if="!activeProject"
      class="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <UIcon name="i-lucide-book-open" class="w-10 h-10 text-dim" />
      <p class="text-sm text-muted">Create a project to get started.</p>
    </div>

    <div
      v-else-if="buildSteps.length === 0"
      class="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <div
        class="w-14 h-14 rounded-2xl bg-surface border border-subtle flex items-center justify-center"
      >
        <UIcon name="i-lucide-list-ordered" class="w-7 h-7 text-dim" />
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium text-muted">No steps yet</p>
        <p class="text-sm text-muted leading-relaxed max-w-[200px]">
          Add steps to build a Lego-style instruction manual for your project
        </p>
      </div>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        label="Add First Step"
        @click="handleAddStep"
      />
    </div>

    <!-- Step cards -->
    <div v-else class="space-y-3">
      <div
        v-for="step in buildSteps"
        :key="step.id"
        class="border border-subtle rounded-xl bg-surface overflow-hidden"
      >
        <!-- View mode -->
        <template v-if="editingId !== step.id">
          <div class="p-3 flex gap-3">
            <!-- Step number bubble -->
            <div
              class="shrink-0 w-10 h-10 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center"
            >
              <span
                class="text-sm font-bold font-mono text-teal-400 leading-none"
              >
                {{ stepLabel(step.stepNumber) }}
              </span>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start gap-1">
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-white leading-tight"
                    :class="{ 'text-muted italic': !step.title }"
                  >
                    {{ step.title || 'Untitled step' }}
                  </p>
                  <p
                    v-if="step.description"
                    class="text-sm text-muted leading-relaxed mt-0.5"
                  >
                    {{ step.description }}
                  </p>
                </div>
                <!-- Actions -->
                <div class="flex items-center gap-0.5 shrink-0 ml-1">
                  <UButton
                    size="xs"
                    icon="i-lucide-chevron-up"
                    color="neutral"
                    variant="ghost"
                    :disabled="step.stepNumber === 1"
                    @click="moveStep(step.id, 'up')"
                  />
                  <UButton
                    size="xs"
                    icon="i-lucide-chevron-down"
                    color="neutral"
                    variant="ghost"
                    :disabled="step.stepNumber === buildSteps.length"
                    @click="moveStep(step.id, 'down')"
                  />
                  <UButton
                    size="xs"
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    @click="startEdit(step)"
                  />
                  <UButton
                    size="xs"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    @click="removeStep(step.id)"
                  />
                </div>
              </div>

              <!-- Parts chips -->
              <div
                v-if="resolveStepParts(step).length > 0"
                class="flex flex-wrap gap-1.5 mt-2"
              >
                <div
                  v-for="part in resolveStepParts(step)"
                  :key="partKey(part.modelId, part.partNumber)"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-subtle"
                >
                  <span
                    class="w-3 h-3 rounded-sm shrink-0 border border-default"
                    :style="partColor(part.colorKey)"
                  />
                  <span
                    class="text-xs text-body font-medium truncate max-w-[100px]"
                  >
                    {{ part.name }}
                  </span>
                  <span class="text-xs text-muted shrink-0"
                    >×{{ part.qty }}</span
                  >
                </div>
              </div>
              <p v-else class="text-sm text-muted italic mt-1.5">
                No parts assigned — click edit to add parts
              </p>
            </div>
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <div class="p-3 space-y-3">
            <div class="flex items-center gap-3">
              <!-- Step number bubble -->
              <div
                class="shrink-0 w-10 h-10 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center"
              >
                <span
                  class="text-sm font-bold font-mono text-teal-400 leading-none"
                >
                  {{ stepLabel(step.stepNumber) }}
                </span>
              </div>

              <!-- Title input -->
              <UInput
                v-model="editDraft.title"
                size="sm"
                placeholder="Step title…"
                class="flex-1 min-w-0"
                autofocus
              />
            </div>
            <UTextarea
              v-model="editDraft.description"
              size="sm"
              placeholder="Description (optional)…"
              class="w-full"
              :rows="2"
              autoresize
            />

            <!-- Part picker -->
            <div v-if="availableParts.length > 0" class="space-y-1.5">
              <p
                class="text-xs font-medium text-muted uppercase tracking-wider px-1"
              >
                Parts in this step
              </p>
              <div class="space-y-1 max-h-52 overflow-y-auto">
                <button
                  v-for="part in availableParts"
                  :key="partKey(part.modelId, part.partNumber)"
                  class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors"
                  :class="
                    editDraft.partRefs.has(
                      partKey(part.modelId, part.partNumber),
                    )
                      ? 'bg-teal-500/12 border border-teal-500/30'
                      : 'bg-surface border border-subtle hover:bg-mist-800'
                  "
                  @click="togglePartRef(part)"
                >
                  <span
                    class="w-4 h-4 rounded border border-default flex items-center justify-center shrink-0"
                    :class="
                      editDraft.partRefs.has(
                        partKey(part.modelId, part.partNumber),
                      )
                        ? 'bg-teal-500 border-teal-400'
                        : 'bg-surface'
                    "
                  >
                    <UIcon
                      v-if="
                        editDraft.partRefs.has(
                          partKey(part.modelId, part.partNumber),
                        )
                      "
                      name="i-lucide-check"
                      class="w-2.5 h-2.5 text-white"
                    />
                  </span>
                  <span
                    class="w-3 h-3 rounded-sm shrink-0 border border-default"
                    :style="partColor(part.colorKey)"
                  />
                  <span class="flex-1 text-sm text-body truncate">
                    <span class="font-medium">{{ part.name }}</span>
                    <span class="text-muted ml-1.5">{{ sizeLabel(part) }}</span>
                  </span>
                  <span class="text-xs text-muted shrink-0"
                    >×{{ part.qty }}</span
                  >
                </button>
              </div>
            </div>

            <p v-else class="text-sm text-muted italic px-1">
              No parts available — import a model or add manual parts in the BOM
              tab
            </p>

            <!-- Save / Cancel -->
            <div class="flex items-center gap-2 pt-1 border-t border-subtle">
              <UButton
                size="sm"
                color="primary"
                label="Save"
                @click="saveEdit(step.id)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                label="Cancel"
                @click="cancelEdit"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
