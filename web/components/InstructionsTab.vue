<script lang="ts" setup>
import type { IdbBuildStep } from '~/composables/useIdb';

const { activeProject } = useProjects();
const { buildSteps, addStep, updateStep, removeStep, moveStep } =
  useBuildSteps();

// ─── Edit state ───────────────────────────────────────────────────────────────

const editingId = ref<string | null>(null);

interface EditDraft {
  title: string;
  description: string;
}

const editDraft = ref<EditDraft>({ title: '', description: '' });

function startEdit(step: IdbBuildStep) {
  editingId.value = step.id;
  editDraft.value = {
    title: step.title,
    description: step.description,
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(stepId: string) {
  await updateStep(stepId, {
    title: editDraft.value.title,
    description: editDraft.value.description,
  });
  editingId.value = null;
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
          <div class="p-4 flex gap-3">
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
                    class="text-base font-semibold text-white leading-tight"
                    :class="{ 'text-muted italic': !step.title }"
                  >
                    {{ step.title || 'Untitled step' }}
                  </p>
                  <div
                    v-if="step.description"
                    class="mt-1 text-sm text-muted leading-relaxed [&_a]:text-teal-400 [&_a]:underline [&_a:hover]:text-teal-300 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mt-0.5 [&_p+p]:mt-1.5"
                    v-html="step.description"
                  />
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
            </div>
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <div class="p-4 space-y-3">
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
                size="md"
                placeholder="Step title…"
                class="flex-1 min-w-0 [&_input]:text-base [&_input]:font-semibold"
                autofocus
              />
            </div>

            <RichTextEditor
              v-model="editDraft.description"
              placeholder="Description (optional) — supports links, bold, italic, lists…"
            />

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
