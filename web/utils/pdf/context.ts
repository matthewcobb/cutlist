import { rgb } from 'pdf-lib';
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import type { ExportPdfOptions } from '../exportPdf';
import { HEADER_BAND_MM, MM } from './constants';
import { drawTextRight } from './text';

export interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  opts: Required<Pick<ExportPdfOptions, 'margin' | 'tileOverlap'>> &
    ExportPdfOptions;
  totalPagesPlaceholder: {
    page: PDFPage;
    x: number;
    y: number;
    size: number;
  }[];
  pageCount: { value: number };
}

export function addPage(
  ctx: Ctx,
  size: { wMm: number; hMm: number },
  subtitle?: string,
): PDFPage {
  ctx.pageCount.value++;
  const page = ctx.doc.addPage([size.wMm * MM, size.hMm * MM]);
  drawHeader(ctx, page, ctx.pageCount.value, subtitle);
  return page;
}

function drawHeader(
  ctx: Ctx,
  page: PDFPage,
  pageNum: number,
  subtitle?: string,
) {
  const { width, height } = page.getSize();
  const margin = ctx.opts.margin * MM;
  const top = height - margin;

  // Title (left)
  page.drawText(ctx.opts.documentName || 'Cutlist', {
    x: margin,
    y: top - 9,
    size: 10,
    font: ctx.fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  if (subtitle) {
    page.drawText(subtitle, {
      x: margin,
      y: top - 19,
      size: 8,
      font: ctx.font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Date + page X of Y (right)
  const dateStr = ctx.opts.generatedAt.toISOString().slice(0, 10);
  const right = width - margin;
  drawTextRight(page, dateStr, right, top - 9, 8, ctx.font, rgb(0.3, 0.3, 0.3));

  const pageLabel = `Page ${pageNum} of `;
  const labelWidth = ctx.font.widthOfTextAtSize(pageLabel, 8);
  // Reserve 18pt for the total count number (filled later).
  const totalReserved = 18;
  const baseX = right - totalReserved;
  page.drawText(pageLabel, {
    x: baseX - labelWidth,
    y: top - 19,
    size: 8,
    font: ctx.font,
    color: rgb(0.3, 0.3, 0.3),
  });
  ctx.totalPagesPlaceholder.push({
    page,
    x: baseX,
    y: top - 19,
    size: 8,
  });

  // Header rule
  const ruleY = height - (ctx.opts.margin + HEADER_BAND_MM - 1) * MM;
  page.drawLine({
    start: { x: margin, y: ruleY },
    end: { x: width - margin, y: ruleY },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
}
