<script lang="ts" setup>
const { stock, resetStock } = useProjectSettings();

interface StockMatrixInputExpose {
  commit: () => boolean;
}

const stockInput = ref<StockMatrixInputExpose>();

const saveStatus = ref<'saving' | 'saved' | 'error' | undefined>();
let saveStatusTimeout: ReturnType<typeof setTimeout> | undefined;

onBeforeUnmount(() => {
  if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
});

const { mutate: _save } = useSetSettingsMutation();

function save() {
  if (stockInput.value != null && !stockInput.value.commit()) return;
  saveStatus.value = 'saving';
  _save(
    { changes: { stock: stock.value } },
    {
      onSuccess() {
        saveStatus.value = 'saved';
        if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
        saveStatusTimeout = setTimeout(() => {
          saveStatus.value = undefined;
        }, 2000);
      },
      onError() {
        saveStatus.value = 'error';
      },
    },
  );
}

watchDebounced(stock, save, { debounce: 600, maxWait: 3000 });

const { mutate: _reset, isPending: isResetting } = useDeleteSettingsMutation();
function reset() {
  _reset(undefined, { onSettled: () => resetStock() });
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col p-4 gap-4">
    <StockMatrixInput v-if="stock != null" ref="stockInput" v-model="stock" />

    <div class="shrink-0 flex items-center justify-between">
      <span
        class="text-xs transition-opacity"
        :class="saveStatus ? 'opacity-60' : 'opacity-0'"
      >
        <template v-if="saveStatus === 'saving'">Saving…</template>
        <template v-else-if="saveStatus === 'saved'">Saved</template>
        <template v-else-if="saveStatus === 'error'">Failed to save</template>
      </span>
      <UButton color="gray" :loading="isResetting" @click="reset"
        >Reset</UButton
      >
    </div>
  </div>
</template>
