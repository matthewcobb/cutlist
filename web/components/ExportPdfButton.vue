<script lang="ts" setup>
import type { PdfScale } from '~/utils/exportPdf';

const { download, isExporting, error, canExport } = useExportPdf();

const isOpen = ref(false);
const scale = ref<PdfScale>(10);

const scaleOptions: { label: string; value: PdfScale }[] = [
  { label: '1:1 (full size, will tile)', value: 1 },
  { label: '1:5', value: 5 },
  { label: '1:10', value: 10 },
  { label: '1:20', value: 20 },
  { label: '1:50', value: 50 },
];

async function onDownload() {
  await download(scale.value);
  if (!error.value) isOpen.value = false;
}
</script>

<template>
  <div>
    <UButton
      title="Export BOM and board layouts as a PDF"
      icon="i-lucide-file-down"
      color="neutral"
      size="sm"
      :disabled="!canExport"
      @click="isOpen = true"
    >
      Print
    </UButton>

    <UModal
      v-model:open="isOpen"
      title="Export PDF"
      description="Export board layouts as PDF"
    >
      <template #content>
        <div
          class="p-6 flex flex-col gap-4 bg-elevated border border-default rounded-lg"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Export PDF</h2>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="rounded-full"
              @click="isOpen = false"
            />
          </div>
          <p class="text-sm text-muted">
            Generates an A4 PDF with the BOM table and each board layout drawn
            at the chosen scale. Boards larger than one page will be tiled with
            crop marks.
          </p>

          <UFormField label="Scale" class="w-full">
            <USelect
              v-model="scale"
              :items="scaleOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <div
            v-if="error"
            class="p-3 rounded border border-red-700 bg-red-950 text-red-300 text-sm"
          >
            {{ error }}
          </div>

          <div class="flex flex-row-reverse gap-2">
            <UButton
              :loading="isExporting"
              :disabled="!canExport"
              @click="onDownload"
            >
              Download
            </UButton>
            <UButton color="neutral" variant="ghost" @click="isOpen = false">
              Cancel
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
