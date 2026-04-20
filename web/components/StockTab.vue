<script lang="ts" setup>
const { stock, resetStock } = useProjectSettings();

interface StockMatrixInputExpose {
  commit: () => boolean;
}

const stockInput = ref<StockMatrixInputExpose>();
const saveStatus = ref<
  | {
      kind: 'success' | 'error';
      text: string;
    }
  | undefined
>();
let saveStatusTimeout: ReturnType<typeof setTimeout> | undefined;

function setSaveStatus(kind: 'success' | 'error', text: string) {
  saveStatus.value = { kind, text };
  if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
  saveStatusTimeout = setTimeout(() => {
    saveStatus.value = undefined;
  }, 5000);
}

onBeforeUnmount(() => {
  if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
});

const { mutate: _save, isPending: isSaving } = useSetSettingsMutation();
function save() {
  saveStatus.value = undefined;
  if (stockInput.value != null && !stockInput.value.commit()) return;
  _save(
    {
      changes: { stock: stock.value },
    },
    {
      onSuccess() {
        setSaveStatus('success', 'Stock settings saved.');
      },
      onError(error: any) {
        setSaveStatus(
          'error',
          error?.data?.statusMessage ??
            error?.statusMessage ??
            'Failed to save stock settings.',
        );
      },
    },
  );
}

const { mutate: _reset, isPending: isResetting } = useDeleteSettingsMutation();
function reset() {
  _reset(undefined, {
    onSettled: () => resetStock(),
  });
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col p-4 gap-4">
    <StockMatrixInput v-if="stock != null" ref="stockInput" v-model="stock" />
    <div
      v-if="saveStatus"
      class="shrink-0 p-4 rounded-lg border"
      :class="
        saveStatus.kind === 'success'
          ? 'bg-teal-950 border-teal-700 text-teal-300'
          : 'bg-red-950 border-red-700 text-red-300'
      "
    >
      <p class="whitespace-pre-wrap">{{ saveStatus.text }}</p>
    </div>

    <div class="shrink-0 flex flex-row-reverse gap-4">
      <UButton type="submit" :loading="isSaving" @click="save">Save</UButton>
      <UButton color="gray" :loading="isResetting" @click="reset"
        >Reset</UButton
      >
    </div>
  </div>
</template>
