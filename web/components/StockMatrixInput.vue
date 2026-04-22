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
    flowLevel: 3,
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

// Thickness add inputs: key = matIndex
const newThickness = ref<Record<number, string>>({});

function addThickness(matIndex: number) {
  const raw = newThickness.value[matIndex];
  if (raw == null || raw === '') return;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return;
  matrix.value[matIndex].thickness.push(num);
  newThickness.value[matIndex] = '';
}

function removeThickness(matIndex: number, dimIndex: number) {
  matrix.value[matIndex].thickness.splice(dimIndex, 1);
}

// Size add inputs: keyed by matIndex
const newSizeWidth = ref<Record<number, string>>({});
const newSizeLength = ref<Record<number, string>>({});

function addSize(matIndex: number) {
  const w = Number(newSizeWidth.value[matIndex]);
  const l = Number(newSizeLength.value[matIndex]);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(l) || l <= 0) return;
  matrix.value[matIndex].sizes.push({ width: w, length: l });
  newSizeWidth.value[matIndex] = '';
  newSizeLength.value[matIndex] = '';
}

function removeSize(matIndex: number, sizeIndex: number) {
  matrix.value[matIndex].sizes.splice(sizeIndex, 1);
}

function addMaterial() {
  matrix.value.push({
    material: 'New Material',
    unit: 'mm',
    thickness: [],
    sizes: [],
    hasGrain: true,
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
      class="rounded-lg border border-default bg-surface p-4 flex flex-col gap-3"
    >
      <!-- Header: name + unit + grain + delete -->
      <div class="flex items-center gap-2">
        <UInput
          v-model="mat.material"
          class="flex-1"
          placeholder="Material name"
        />
        <USelect
          v-model="mat.unit"
          :items="[
            { label: 'mm', value: 'mm' },
            { label: 'in', value: 'in' },
          ]"
          size="sm"
          class="w-18"
        />
        <UCheckbox v-model="mat.hasGrain" label="Grain" />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          size="sm"
          @click="removeMaterial(matIndex)"
        />
      </div>

      <!-- Thicknesses -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted uppercase tracking-wider">
          Thicknesses
        </label>
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="(dim, i) in mat.thickness"
            :key="i"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-subtle bg-elevated text-[13px] text-teal-300 font-mono"
          >
            {{ typeof dim === 'number' ? `${dim}${mat.unit ?? 'mm'}` : dim }}
            <button
              class="text-dim hover:text-body leading-none ml-0.5 transition-colors"
              @click="removeThickness(matIndex, i)"
            >
              &times;
            </button>
          </span>
          <input
            v-model="newThickness[matIndex]"
            type="number"
            min="0"
            step="any"
            class="bg-elevated rounded px-2 py-1 text-[13px] text-teal-300/70 font-mono w-20 outline-none border border-subtle focus:border-teal-600 placeholder:text-dim transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="+ add"
            @keydown.enter.prevent="addThickness(matIndex)"
            @blur="addThickness(matIndex)"
          />
        </div>
      </div>

      <!-- Board sizes -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-muted uppercase tracking-wider">
          Board sizes
        </label>
        <div class="flex flex-col gap-1.5">
          <!-- Existing sizes -->
          <div
            v-for="(size, sizeIndex) in mat.sizes"
            :key="sizeIndex"
            class="inline-flex items-center gap-2 group"
          >
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-subtle bg-elevated text-[13px] text-teal-300 font-mono"
            >
              {{ typeof size.width === 'number' ? size.width : size.width
              }}{{ mat.unit ?? 'mm' }}
              <span class="text-dim">&times;</span>
              {{ typeof size.length === 'number' ? size.length : size.length
              }}{{ mat.unit ?? 'mm' }}
            </span>
            <button
              class="text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm"
              @click="removeSize(matIndex, sizeIndex)"
            >
              <span class="i-lucide-x w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Add size row -->
          <div class="flex items-center gap-1.5">
            <input
              v-model="newSizeWidth[matIndex]"
              type="number"
              min="0"
              step="any"
              class="bg-elevated rounded px-2 py-1 text-[13px] text-teal-300/70 font-mono w-20 outline-none border border-subtle focus:border-teal-600 placeholder:text-dim transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              placeholder="width"
              @keydown.enter.prevent="addSize(matIndex)"
            />
            <span class="text-dim text-sm">&times;</span>
            <input
              v-model="newSizeLength[matIndex]"
              type="number"
              min="0"
              step="any"
              class="bg-elevated rounded px-2 py-1 text-[13px] text-teal-300/70 font-mono w-20 outline-none border border-subtle focus:border-teal-600 placeholder:text-dim transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              placeholder="length"
              @keydown.enter.prevent="addSize(matIndex)"
            />
            <button
              class="text-dim hover:text-teal-400 transition-colors text-sm px-1"
              @click="addSize(matIndex)"
            >
              + add
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add material -->
    <button
      class="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-default text-muted hover:border-teal-700 hover:text-teal-400 py-3 text-sm transition-colors"
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
