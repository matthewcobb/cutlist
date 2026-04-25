import { exportCutlistPdf, type PdfScale } from '~/utils/exportPdf';
import type { BomRow as PdfBomRow } from '~/utils/pdf/bom';

export default function () {
  const { data: layouts } = useBoardLayoutsQuery();
  const { activeProject } = useProjects();
  const { allRows } = useBomRows();
  const formatDistance = useFormatDistance();
  const { showPartNumbers } = useProjectSettings();
  const { measurements } = useRulerStore();

  const isExporting = ref(false);
  const error = ref<string | undefined>();

  const bomRows = computed<PdfBomRow[]>(() =>
    allRows.value.map((r) => ({
      partNumber: r.number,
      name: r.name,
      qty: r.qty,
      material: r.material,
      size: `${formatDistance(r.thicknessM) ?? ''} × ${formatDistance(r.widthM) ?? ''} × ${formatDistance(r.lengthM) ?? ''}`,
    })),
  );

  async function download(scale: PdfScale) {
    if (!bomRows.value.length) return;
    isExporting.value = true;
    error.value = undefined;
    try {
      const name = activeProject.value?.name ?? 'Cutlist';
      const bytes = await exportCutlistPdf({
        documentName: name,
        generatedAt: new Date(),
        scale,
        bomRows: bomRows.value,
        layouts: layouts.value?.layouts ?? [],
        leftovers: layouts.value?.leftovers ?? [],
        formatSize: formatDistance,
        showPartNumbers: !!showPartNumbers.value,
        measurements: measurements.value,
      });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const safeName = (name || 'cutlist')
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
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

  const canExport = computed(() => bomRows.value.length > 0);

  return {
    download,
    isExporting,
    error,
    canExport,
  };
}
