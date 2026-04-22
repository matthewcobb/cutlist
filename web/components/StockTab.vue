<script lang="ts" setup>
const { stock, resetStock } = useProjectSettings();

interface StockMatrixInputExpose {
  commit: () => boolean;
}

const stockInput = ref<StockMatrixInputExpose>();

function reset() {
  resetStock();
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col p-4 gap-4">
    <StockMatrixInput v-if="stock != null" ref="stockInput" v-model="stock" />

    <div class="shrink-0 flex items-end justify-end">
      <UButton color="neutral" @click="reset">Reset to defaults</UButton>
    </div>
  </div>
</template>
