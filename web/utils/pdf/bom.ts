import { rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { BoardLayoutLeftover, BoardLayoutPlacement } from 'cutlist';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import {
  A4_H_MM,
  A4_W_MM,
  FOOTER_BAND_MM,
  HEADER_BAND_MM,
  MM,
} from './constants';
import { addPage, type Ctx } from './context';
import { truncate } from './text';

export interface BomRow {
  partNumber: number;
  name: string;
  qty: number;
  material: string;
  size: string;
}

export function aggregateBom(
  placements: BoardLayoutPlacement[],
  leftovers: BoardLayoutLeftover[],
  formatSize: (m: number) => string | undefined,
): BomRow[] {
  return groupPartsByNumber(placements, leftovers).map((instances) => {
    const part = instances[0];
    return {
      partNumber: part.partNumber,
      name: part.name,
      qty: instances.length,
      material: part.material,
      size: `${formatSize(part.thicknessM) ?? ''} × ${formatSize(part.widthM) ?? ''} × ${formatSize(part.lengthM) ?? ''}`,
    };
  });
}

export function drawBomPages(ctx: Ctx, rows: BomRow[]) {
  const margin = ctx.opts.margin;
  const colHeaders = ['#', 'Part Name', 'QTY', 'Material', 'Size'];
  // Column widths in mm (must sum <= A4_W_MM - 2*margin = 190)
  const colWidthsMm = [12, 70, 14, 40, 54];
  const rowHeightMm = 7;
  const headerRowHeightMm = 8;
  const titleAreaMm = 10;

  const usableHMm =
    A4_H_MM - 2 * margin - HEADER_BAND_MM - FOOTER_BAND_MM - titleAreaMm;
  const rowsPerPage = Math.floor((usableHMm - headerRowHeightMm) / rowHeightMm);

  let cursor = 0;
  let pageNum = 0;
  while (cursor < rows.length || pageNum === 0) {
    pageNum++;
    const page = addPage(ctx, { wMm: A4_W_MM, hMm: A4_H_MM });

    // Title
    const titleY = A4_H_MM * MM - (margin + HEADER_BAND_MM) * MM - 4 * MM;
    page.drawText('Bill of Materials', {
      x: margin * MM,
      y: titleY - 6,
      size: 14,
      font: ctx.fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const tableTopMm = margin + HEADER_BAND_MM + titleAreaMm;
    drawBomTable(
      ctx,
      page,
      colHeaders,
      colWidthsMm,
      rows.slice(cursor, cursor + rowsPerPage),
      margin,
      tableTopMm,
      rowHeightMm,
      headerRowHeightMm,
    );
    cursor += rowsPerPage;
    if (rows.length === 0) break;
  }
}

function drawBomTable(
  ctx: Ctx,
  page: PDFPage,
  headers: string[],
  colWidthsMm: number[],
  rows: BomRow[],
  marginMm: number,
  topMm: number,
  rowHeightMm: number,
  headerRowHeightMm: number,
) {
  const { height } = page.getSize();

  // Header row
  const headerY = height - topMm * MM - headerRowHeightMm * MM;
  let xMm = marginMm;
  page.drawRectangle({
    x: marginMm * MM,
    y: headerY,
    width: colWidthsMm.reduce((a, b) => a + b, 0) * MM,
    height: headerRowHeightMm * MM,
    color: rgb(0.92, 0.92, 0.94),
  });
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: (xMm + 2) * MM,
      y: headerY + 2 * MM,
      size: 9,
      font: ctx.fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    xMm += colWidthsMm[i];
  }

  // Body rows
  for (let r = 0; r < rows.length; r++) {
    const rowY = headerY - (r + 1) * rowHeightMm * MM;
    if (r % 2 === 1) {
      page.drawRectangle({
        x: marginMm * MM,
        y: rowY,
        width: colWidthsMm.reduce((a, b) => a + b, 0) * MM,
        height: rowHeightMm * MM,
        color: rgb(0.97, 0.97, 0.98),
      });
    }
    const row = rows[r];
    const cells = [
      String(row.partNumber),
      truncate(ctx.font, row.name, 9, (colWidthsMm[1] - 4) * MM),
      String(row.qty),
      truncate(ctx.font, row.material, 9, (colWidthsMm[3] - 4) * MM),
      truncate(ctx.font, row.size, 9, (colWidthsMm[4] - 4) * MM),
    ];
    let cx = marginMm;
    for (let i = 0; i < cells.length; i++) {
      page.drawText(cells[i], {
        x: (cx + 2) * MM,
        y: rowY + 1.5 * MM,
        size: 9,
        font: ctx.font,
        color: rgb(0.1, 0.1, 0.1),
      });
      cx += colWidthsMm[i];
    }
  }

  // Outer border lines
  const totalW = colWidthsMm.reduce((a, b) => a + b, 0) * MM;
  const totalH = (rows.length * rowHeightMm + headerRowHeightMm) * MM;
  page.drawRectangle({
    x: marginMm * MM,
    y: headerY + headerRowHeightMm * MM - totalH,
    width: totalW,
    height: totalH,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.5,
  });
}
