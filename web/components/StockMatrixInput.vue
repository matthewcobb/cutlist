<script lang="ts" setup>
import { reduceStockMatrix } from 'cutlist';
import type { StockMatrix } from 'cutlist';
import { parseStock } from '~/utils/parseStock';
import YAML from 'js-yaml';

const value = defineModel<string>({ required: true });

const matrix = ref<StockMatrix[]>([]);
const err = ref<unknown>();

let lastSerialized = value.value;
let updating = false;

function parseAndSet(yaml: string) {
  updating = true;
  try {
    matrix.value = parseStock(yaml);
    err.value = undefined;
  } catch (e) {
    err.value = e;
  } finally {
    updating = false;
  }
}

parseAndSet(value.value);

function serialize() {
  const yaml = YAML.dump(JSON.parse(JSON.stringify(matrix.value)), {
    indent: 2,
    flowLevel: 2,
  });
  lastSerialized = yaml;
  value.value = yaml;
}

watch(
  value,
  (next) => {
    if (next === lastSerialized) return;
    parseAndSet(next);
  },
  { flush: 'sync' },
);

watch(
  matrix,
  () => {
    if (updating) return;
    serialize();
  },
  { deep: true, flush: 'sync' },
);

function commit() {
  try {
    reduceStockMatrix(JSON.parse(JSON.stringify(matrix.value)));
    serialize();
    err.value = undefined;
    return true;
  } catch (e) {
    err.value = e;
    return false;
  }
}

defineExpose({ commit });

// Per-field add inputs: key = `{matIndex}-{field}`
const newInputs = ref<Record<string, string>>({});

function inputKey(matIndex: number, field: string) {
  return `${matIndex}-${field}`;
}

function addDimension(
  matIndex: number,
  field: 'thickness' | 'width' | 'length',
) {
  const key = inputKey(matIndex, field);
  const val = (newInputs.value[key] ?? '').trim();
  if (!val) return;
  matrix.value[matIndex][field].push(val);
  newInputs.value[key] = '';
}

function removeDimension(
  matIndex: number,
  field: 'thickness' | 'width' | 'length',
  dimIndex: number,
) {
  matrix.value[matIndex][field].splice(dimIndex, 1);
}

function addMaterial() {
  matrix.value.push({
    material: 'New Material',
    thickness: [],
    width: [],
    length: [],
  });
}

function removeMaterial(index: number) {
  matrix.value.splice(index, 1);
}
</script>

<template>
  <div class="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
    <div
      v-for="(mat, matIndex) in matrix"
      :key="matIndex"
      class="rounded-lg border border-white/10 bg-gray-900 p-4 flex flex-col gap-4"
    >
      <!-- Material name -->
      <div class="flex items-center gap-2">
        <UInput
          v-model="mat.material"
          class="flex-1"
          placeholder="Material name"
        />
        <UButton
          color="gray"
          variant="ghost"
          icon="i-lucide-trash-2"
          size="sm"
          @click="removeMaterial(matIndex)"
        />
      </div>

      <!-- Thickness / Width / Length -->
      <div
        v-for="field in ['thickness', 'width', 'length'] as const"
        :key="field"
        class="flex flex-col gap-1.5"
      >
        <label class="text-xs font-medium text-muted uppercase tracking-wider">
          {{ field }}
        </label>
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="(dim, i) in mat[field]"
            :key="i"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/10 bg-white/5 text-sm text-teal-300 font-mono"
          >
            {{ dim }}
            <button
              class="text-dim hover:text-body leading-none ml-0.5 transition-colors"
              @click="removeDimension(matIndex, field, i)"
            >
              ×
            </button>
          </span>
          <input
            v-model="newInputs[inputKey(matIndex, field)]"
            class="bg-transparent text-sm text-teal-300/70 font-mono w-20 outline-none border-b border-white/20 focus:border-teal-600 placeholder:text-white/20 transition-colors"
            placeholder="+ add"
            @keydown.enter.prevent="addDimension(matIndex, field)"
            @blur="addDimension(matIndex, field)"
          />
        </div>
      </div>
    </div>

    <!-- Add material -->
    <button
      class="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-white/20 text-muted hover:border-teal-700 hover:text-teal-400 py-3 text-sm transition-colors"
      @click="addMaterial"
    >
      <span>+ Add Material</span>
    </button>
  </div>

  <div
    v-if="err"
    class="shrink-0 bg-red-900 p-4 rounded-lg border border-red-700"
  >
    <p class="text-white whitespace-pre-wrap text-sm">{{ err }}</p>
  </div>
</template>
