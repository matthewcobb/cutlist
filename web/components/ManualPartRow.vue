<script lang="ts" setup>
import type { ManualPartInput } from '~/composables/useProjects';
import { cycleGrainLock, GRAIN_LABELS } from '~/utils/grain';

const props = defineProps<{
  materials: string[];
  initial?: ManualPartInput & { partNumber: number };
}>();

const emit = defineEmits<{
  save: [data: ManualPartInput];
  cancel: [];
}>();

const name = ref(props.initial?.name ?? '');
const widthMm = ref<number | null>(props.initial?.widthMm ?? null);
const lengthMm = ref<number | null>(props.initial?.lengthMm ?? null);
const thicknessMm = ref<number | null>(props.initial?.thicknessMm ?? null);
const qty = ref(props.initial?.qty ?? 1);
const material = ref(props.initial?.material ?? props.materials[0] ?? '');
const grainLock = ref<'length' | 'width' | undefined>(props.initial?.grainLock);

const isValid = computed(
  () =>
    name.value.trim() !== '' &&
    widthMm.value != null &&
    widthMm.value > 0 &&
    lengthMm.value != null &&
    lengthMm.value > 0 &&
    thicknessMm.value != null &&
    thicknessMm.value > 0 &&
    qty.value >= 1 &&
    material.value !== '',
);

function submit() {
  if (
    !isValid.value ||
    widthMm.value == null ||
    lengthMm.value == null ||
    thicknessMm.value == null
  )
    return;
  emit('save', {
    name: name.value.trim(),
    widthMm: widthMm.value,
    lengthMm: lengthMm.value,
    thicknessMm: thicknessMm.value,
    qty: qty.value,
    material: material.value,
    grainLock: grainLock.value,
  });
  if (!props.initial) {
    name.value = '';
    widthMm.value = null;
    lengthMm.value = null;
    thicknessMm.value = null;
    qty.value = 1;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submit();
  if (e.key === 'Escape') emit('cancel');
}
</script>

<template>
  <div
    class="flex flex-col gap-2 p-2 rounded-lg border border-subtle bg-surface"
    role="form"
    :aria-label="initial ? 'Edit part' : 'Add part'"
  >
    <UInput
      v-model="name"
      size="sm"
      placeholder="Part name"
      class="w-full"
      autofocus
      @keydown="onKeydown"
    />
    <div class="grid grid-cols-4 gap-1.5">
      <div class="flex flex-col gap-0.5">
        <label class="text-xs text-muted px-0.5" for="manual-part-width"
          >W (mm)</label
        >
        <UInput
          id="manual-part-width"
          v-model.number="widthMm"
          type="number"
          size="sm"
          placeholder="0"
          :min="0"
          @keydown="onKeydown"
        />
      </div>
      <div class="flex flex-col gap-0.5">
        <label class="text-xs text-muted px-0.5" for="manual-part-length"
          >L (mm)</label
        >
        <UInput
          id="manual-part-length"
          v-model.number="lengthMm"
          type="number"
          size="sm"
          placeholder="0"
          :min="0"
          @keydown="onKeydown"
        />
      </div>
      <div class="flex flex-col gap-0.5">
        <label class="text-xs text-muted px-0.5" for="manual-part-thickness"
          >T (mm)</label
        >
        <UInput
          id="manual-part-thickness"
          v-model.number="thicknessMm"
          type="number"
          size="sm"
          placeholder="0"
          :min="0"
          @keydown="onKeydown"
        />
      </div>
      <div class="flex flex-col gap-0.5">
        <label class="text-xs text-muted px-0.5" for="manual-part-qty"
          >Qty</label
        >
        <UInput
          id="manual-part-qty"
          v-model.number="qty"
          type="number"
          size="sm"
          placeholder="1"
          :min="1"
          @keydown="onKeydown"
        />
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        :title="
          grainLock
            ? `Grain: ${GRAIN_LABELS[grainLock]} — click to cycle`
            : 'Free rotation — click to lock grain'
        "
        :class="[
          'flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs transition-colors whitespace-nowrap',
          grainLock
            ? 'border-teal-500/60 bg-teal-500/10 text-teal-400'
            : 'border-default bg-transparent text-dim hover:border-mist-600 hover:text-muted',
        ]"
        @click="grainLock = cycleGrainLock(grainLock)"
      >
        <UIcon
          :name="grainLock ? 'i-lucide-lock' : 'i-lucide-lock-open'"
          class="w-3.5 h-3.5"
        />
        <span>{{ grainLock ? GRAIN_LABELS[grainLock] : 'Free' }}</span>
      </button>
      <select
        v-model="material"
        aria-label="Material"
        class="manual-select flex-1 bg-base border border-default rounded-md px-2 py-1.5 text-sm text-body cursor-pointer focus:outline-none focus:border-mist-600"
      >
        <option
          v-for="m in materials"
          :key="m"
          :value="m"
          style="
            background: var(--color-mist-900);
            color: var(--color-mist-200);
          "
        >
          {{ m }}
        </option>
      </select>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        :disabled="!isValid"
        @click="submit"
      >
        {{ initial ? 'Save' : 'Add' }}
      </UButton>
      <UButton
        v-if="initial"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
    </div>
  </div>
</template>
