<script lang="ts" setup>
import YAML from 'js-yaml';
import { STOCK_PRESETS } from '~/utils/settings';
import { parseStock } from '~/utils/parseStock';

const { stock } = useProjectSettings();

interface StockMatrixInputExpose {
  commit: () => boolean;
  addMaterial: () => void;
  scrollToBottom: () => void;
}

const stockInput = ref<StockMatrixInputExpose>();

const presetItems = STOCK_PRESETS.map((preset) => ({
  label: preset.label,
  onSelect() {
    addPreset(preset);
  },
}));

function addPreset(preset: (typeof STOCK_PRESETS)[number]) {
  if (stock.value == null) return;
  try {
    const current = parseStock(stock.value);
    current.push(structuredClone(preset.stock));
    stock.value = YAML.dump(current, { indent: 2, flowLevel: 3 });
    stockInput.value?.scrollToBottom();
  } catch {
    stock.value = YAML.dump([preset.stock], { indent: 2, flowLevel: 3 });
    stockInput.value?.scrollToBottom();
  }
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col p-4 gap-4">
    <!-- Top bar: explainer + actions -->
    <div class="shrink-0 flex items-center justify-between gap-3">
      <p class="text-sm text-muted">
        Add the board stock you have available. Parts will be laid out onto
        these materials.
      </p>
      <div class="flex items-center gap-2 shrink-0">
        <UDropdownMenu :items="presetItems">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            trailing-icon="i-lucide-chevron-down"
            size="sm"
          >
            Add preset
          </UButton>
        </UDropdownMenu>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          size="sm"
          @click="
            stockInput?.addMaterial();
            stockInput?.scrollToBottom();
          "
        >
          Add custom
        </UButton>
      </div>
    </div>

    <StockMatrixInput v-if="stock != null" ref="stockInput" v-model="stock" />
  </div>
</template>
