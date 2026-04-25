import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import type { RulerMeasurement } from '~/composables/useRulerStore';
import { drawBomPages, type BomRow } from './pdf/bom';
import { drawBoardTiles } from './pdf/board';
import type { Ctx } from './pdf/context';

export type PdfScale = 1 | 5 | 10 | 20 | 50;

export interface ExportPdfOptions {
  documentName: string;
  generatedAt: Date;
  scale: PdfScale;
  margin?: number; // mm
  tileOverlap?: number; // mm
  /**
   * Pre-aggregated BOM rows to print. Supplying these directly (rather than
   * re-deriving from placements) lets callers export the BOM even when no
   * board layouts have been generated yet — e.g. before stock is assigned.
   */
  bomRows: BomRow[];
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
  formatSize: (m: number) => string | undefined;
  showPartNumbers: boolean;
  measurements?: RulerMeasurement[];
}

export async function exportCutlistPdf(
  options: ExportPdfOptions,
): Promise<Uint8Array> {
  const opts = {
    margin: 10,
    tileOverlap: 5,
    ...options,
  };

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    font,
    fontBold,
    opts,
    totalPagesPlaceholder: [],
    pageCount: { value: 0 },
  };

  // Page 1+: BOM
  drawBomPages(ctx, opts.bomRows);

  // Pages: each board, possibly tiled
  const measurements = opts.measurements ?? [];
  opts.layouts.forEach((layout, i) => {
    const boardMeasurements = measurements.filter((m) => m.boardIndex === i);
    drawBoardTiles(ctx, layout, i + 1, opts.layouts.length, boardMeasurements);
  });

  // Fill in "Page N of M" placeholders
  const totalPages = ctx.pageCount.value;
  for (const ph of ctx.totalPagesPlaceholder) {
    ph.page.drawText(String(totalPages), {
      x: ph.x,
      y: ph.y,
      size: ph.size,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return await doc.save();
}
