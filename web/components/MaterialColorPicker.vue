<script lang="ts" setup>
import { FALLBACK_PALETTE } from '~/composables/useMaterialColors';

const model = defineModel<string>();

const presets = FALLBACK_PALETTE;

const open = ref(false);

function pick(hex: string) {
  model.value = hex;
  open.value = false;
}

function onCustomInput(e: Event) {
  model.value = (e.target as HTMLInputElement).value;
}

const display = computed(() => model.value || presets[0]);
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'bottom', align: 'start', sideOffset: 4 }"
  >
    <!-- Trigger: swatch button -->
    <button
      type="button"
      class="w-8 h-8 rounded-md border border-subtle shrink-0 cursor-pointer transition-shadow hover:ring-1 hover:ring-teal-600"
      :style="{ background: display }"
    />

    <!-- Dropdown content -->
    <template #content>
      <div class="p-2 flex flex-col gap-2">
        <!-- Preset swatches -->
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="hex in presets"
            :key="hex"
            type="button"
            class="swatch"
            :class="{ active: display === hex }"
            :style="{ background: hex }"
            @click="pick(hex)"
          />
        </div>

        <!-- Divider -->
        <div class="h-px bg-mist-700" />

        <!-- Custom color row -->
        <label class="flex items-center gap-2 cursor-pointer group">
          <span
            class="swatch"
            :class="presets.includes(display) ? 'empty' : 'active'"
            :style="{
              background: presets.includes(display) ? 'transparent' : display,
            }"
          />
          <span
            class="text-xs text-muted group-hover:text-body transition-colors"
            >Custom</span
          >
          <input
            type="color"
            :value="display"
            class="absolute w-0 h-0 opacity-0 pointer-events-none"
            @input="onCustomInput"
          />
        </label>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    box-shadow 0.15s ease;
  border: 1px solid rgb(255 255 255 / 0.1);
}
.swatch:hover {
  transform: scale(1.15);
}
.swatch.active {
  box-shadow:
    0 0 0 2px #22292b,
    0 0 0 3.5px #2dd4bf;
}
.swatch.empty {
  border: 1.5px dashed #67787c;
}
</style>
