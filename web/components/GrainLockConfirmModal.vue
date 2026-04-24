<script lang="ts" setup>
import { GRAIN_LABELS } from '~/utils/grain';
import type { GrainLock } from '~/utils/grain';

const props = defineProps<{
  open: boolean;
  grainLock: GrainLock;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const label = computed(() => {
  if (!props.grainLock) return 'Free rotation';
  return GRAIN_LABELS[props.grainLock] ?? props.grainLock;
});
</script>

<template>
  <UModal
    :open="open"
    title="Part won't fit"
    @update:open="
      (v: boolean) => {
        if (!v) emit('cancel');
      }
    "
  >
    <template #content>
      <div class="p-6 space-y-4 bg-elevated border border-default rounded-lg">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">Part won't fit</h3>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="rounded-full"
            @click="emit('cancel')"
          />
        </div>
        <p class="text-sm text-muted">
          Locking grain to
          <span class="text-body font-medium">{{ label }}</span>
          will make this part too large for any available board. It will become
          unplaced.
        </p>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="emit('cancel')">
            Cancel
          </UButton>
          <UButton color="warning" @click="emit('confirm')">
            Lock anyway
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
