import { exportCutlistPdf, type PdfScale } from '~/utils/exportPdf';

export default function () {
  const { data: layouts } = useBoardLayoutsQuery();
  const { activeProject } = useProjects();
  const formatDistance = useFormatDistance();
  const { distanceUnit, showPartNumbers } = useProjectSettings();
  const { measurements } = useRulerStore();

  const isExporting = ref(false);
  const error = ref<string | undefined>();

  async function download(scale: PdfScale) {
    if (!layouts.value) return;
    isExporting.value = true;
    error.value = undefined;
    try {
      const name = activeProject.value?.name ?? 'Cutlist';
      const bytes = await exportCutlistPdf({
        documentName: name,
        generatedAt: new Date(),
        scale,
        layouts: layouts.value.layouts,
        leftovers: layouts.value.leftovers,
        formatSize: formatDistance,
        distanceUnit: String(distanceUnit.value ?? ''),
        showPartNumbers: !!showPartNumbers.value,
        measurements: measurements.value,
      });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeName = name.replace(/[^a-z0-9-_]+/gi, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}-cutlist.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[exportPdf] PDF generation failed:', err);
      error.value = err instanceof Error ? err.message : 'Failed to export PDF';
    } finally {
      isExporting.value = false;
    }
  }

  const canExport = computed(() => (layouts.value?.layouts.length ?? 0) > 0);

  return {
    download,
    isExporting,
    error,
    canExport,
  };
}
