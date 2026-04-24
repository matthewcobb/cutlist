import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type {
  BoardLayout,
  BoardLayoutLeftover,
  BoardLayoutPlacement,
} from 'cutlist';
import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import type { RulerMeasurement } from '~/composables/useRulerStore';

export type PdfScale = 1 | 5 | 10 | 20 | 50;

export interface ExportPdfOptions {
  documentName: string;
  generatedAt: Date;
  scale: PdfScale;
  margin?: number; // mm
  tileOverlap?: number; // mm
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
  formatSize: (m: number) => string | undefined;
  showPartNumbers: boolean;
  measurements?: RulerMeasurement[];
}

/**
 * Conversion factor: 1 mm = 72/25.4 PDF points (ISO 32000-1, 1 pt = 1/72 in).
 */
const MM = 2.83464566929;

/** ISO 216 A4 width in mm. */
const A4_W_MM = 210;
/** ISO 216 A4 height in mm. */
const A4_H_MM = 297;

/** Vertical space reserved for the page header (title + date + rule). */
const HEADER_BAND_MM = 12;
/** Vertical space reserved below the content area (currently unused). */
const FOOTER_BAND_MM = 0;
/** Vertical space for the per-board material/size subtitle line. */
const BOARD_TITLE_BAND_MM = 8;
/** Horizontal space reserved for a side legend column (currently unused). */
const LEGEND_BAND_MM = 0;

interface BomRow {
  partNumber: number;
  name: string;
  qty: number;
  material: string;
  size: string;
}

interface Ctx {
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

  const bomRows = aggregateBom(
    opts.layouts.flatMap((l) => l.placements),
    opts.leftovers,
    opts.formatSize,
  );

  // Page 1+: BOM
  drawBomPages(ctx, bomRows);

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

function aggregateBom(
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

function addPage(
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

function drawTextRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0, 0, 0),
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

// ---------------- BOM ----------------

function drawBomPages(ctx: Ctx, rows: BomRow[]) {
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

function truncate(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const candidate = text.slice(0, mid) + ellipsis;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

// ---------------- Boards ----------------

function drawBoardTiles(
  ctx: Ctx,
  layout: BoardLayout,
  boardIndex: number,
  totalBoards: number,
  measurements: RulerMeasurement[],
) {
  const { scale } = ctx.opts;
  const stock = layout.stock;
  const boardWmm = stock.widthM * 1000;
  const boardLmm = stock.lengthM * 1000;
  // Paper dimensions (mm) at the chosen scale
  const paperWmm = boardWmm / scale;
  const paperHmm = boardLmm / scale;

  // Decide page orientation per board so the board fills as much as possible
  const landscape = paperWmm > paperHmm;
  const pageWmm = landscape ? A4_H_MM : A4_W_MM;
  const pageHmm = landscape ? A4_W_MM : A4_H_MM;

  const margin = ctx.opts.margin;
  const overlap = ctx.opts.tileOverlap;
  const printableWmm = pageWmm - 2 * margin - LEGEND_BAND_MM; // legend column on the right
  const printableHmm =
    pageHmm -
    2 * margin -
    HEADER_BAND_MM -
    BOARD_TITLE_BAND_MM -
    FOOTER_BAND_MM;

  const stepWmm = Math.max(1, printableWmm - overlap);
  const stepHmm = Math.max(1, printableHmm - overlap);
  const cols = Math.max(1, Math.ceil((paperWmm - overlap) / stepWmm));
  const rows = Math.max(1, Math.ceil((paperHmm - overlap) / stepHmm));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawBoardTilePage(
        ctx,
        layout,
        boardIndex,
        totalBoards,
        col,
        row,
        cols,
        rows,
        { pageWmm, pageHmm, paperWmm, paperHmm, printableWmm, printableHmm },
        measurements,
      );
    }
  }
}

interface TileGeom {
  pageWmm: number;
  pageHmm: number;
  paperWmm: number; // full board width on paper at scale
  paperHmm: number; // full board height on paper at scale
  printableWmm: number;
  printableHmm: number;
}

function drawBoardTilePage(
  ctx: Ctx,
  layout: BoardLayout,
  boardIndex: number,
  totalBoards: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
  geom: TileGeom,
  measurements: RulerMeasurement[],
) {
  const { scale, formatSize, showPartNumbers } = ctx.opts;
  const margin = ctx.opts.margin;
  const overlap = ctx.opts.tileOverlap;
  const stock = layout.stock;

  const subtitle =
    cols * rows > 1
      ? `Board ${boardIndex}/${totalBoards} · Tile ${col + 1},${row + 1} of ${cols}×${rows} · Scale 1:${scale}`
      : `Board ${boardIndex}/${totalBoards} · Scale 1:${scale}`;

  const page = addPage(ctx, { wMm: geom.pageWmm, hMm: geom.pageHmm }, subtitle);
  const { width: pageW, height: pageH } = page.getSize();

  // Board title line
  const boardTitleY = pageH - (margin + HEADER_BAND_MM) * MM - 8;
  const sizeText = `${formatSize(stock.thicknessM) ?? ''} × ${formatSize(stock.widthM) ?? ''} × ${formatSize(stock.lengthM) ?? ''}`;
  page.drawText(`${stock.material}  ·  ${sizeText}`, {
    x: margin * MM,
    y: boardTitleY,
    size: 9,
    font: ctx.fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Scale legend on the right side of the board title line
  drawScaleLegend(ctx, page, pageW, boardTitleY, scale);

  // Tile area in PDF points
  const tileXmm = margin;
  const tileYmm = margin + FOOTER_BAND_MM;
  const tileWpt = geom.printableWmm * MM;
  const tileHpt = geom.printableHmm * MM;
  const tileXpt = tileXmm * MM;
  const tileYpt = tileYmm * MM;

  // Tile origin in board-paper coordinates (bottom-left of board)
  // Board paper origin matches bottom-left at (tileXpt, tileYpt) for tile (0,0).
  // For each tile we shift the board left/up so that the visible portion
  // corresponds to (col*step, row*step) of the board.
  const stepWpt = (geom.printableWmm - overlap) * MM;
  const stepHpt = (geom.printableHmm - overlap) * MM;
  const offsetXpt = col * stepWpt;
  const offsetYpt = row * stepHpt;

  // Board outline in board-paper coordinates
  const boardWpt = geom.paperWmm * MM;
  const boardHpt = geom.paperHmm * MM;

  // Translate board into page coordinates (bottom-left origin = tile origin
  // minus offset).
  const boardX = tileXpt - offsetXpt;
  const boardY = tileYpt - offsetYpt;

  // Clip everything to the tile rectangle by drawing a clip box. pdf-lib
  // doesn't directly expose clipping for us, so we instead draw all rects with
  // intersection math.
  drawTileBorder(page, tileXpt, tileYpt, tileWpt, tileHpt);

  // Board outline (intersection with tile)
  drawClippedRect(
    page,
    boardX,
    boardY,
    boardWpt,
    boardHpt,
    tileXpt,
    tileYpt,
    tileWpt,
    tileHpt,
    {
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
      color: rgb(0.96, 0.96, 0.96),
    },
  );

  // Parts
  for (const placement of layout.placements) {
    const px = boardX + ((placement.leftM * 1000) / scale) * MM;
    const py = boardY + ((placement.bottomM * 1000) / scale) * MM;
    const pw = ((placement.widthM * 1000) / scale) * MM;
    const ph = ((placement.lengthM * 1000) / scale) * MM;
    drawClippedRect(page, px, py, pw, ph, tileXpt, tileYpt, tileWpt, tileHpt, {
      borderColor: rgb(0.1, 0.1, 0.1),
      borderWidth: 0.5,
      color: rgb(1, 1, 1),
    });
    if (showPartNumbers) {
      // Part number sizing: half part width, capped at 1 inch real-world
      // (matches PartListItem.vue), then scaled to paper coordinates.
      const ONE_INCH_M = 0.0254;
      const realCapM = Math.min(placement.widthM / 2, ONE_INCH_M);
      const fontPt = ((realCapM * 1000) / scale) * MM;
      const MIN_PART_LABEL_PT = 4;
      const MAX_PART_LABEL_PT = 14;
      const usePt = Math.max(
        MIN_PART_LABEL_PT,
        Math.min(fontPt, MAX_PART_LABEL_PT),
      );
      const label = String(placement.partNumber);
      const textW = ctx.font.widthOfTextAtSize(label, usePt);
      const lx = px + pw - textW - 2;
      const ly = py + ph - usePt - 1;
      // Only draw if visible inside tile
      if (
        lx >= tileXpt &&
        lx + textW <= tileXpt + tileWpt &&
        ly >= tileYpt &&
        ly + usePt <= tileYpt + tileHpt
      ) {
        page.drawText(label, {
          x: lx,
          y: ly,
          size: usePt,
          font: ctx.font,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    }
  }

  // Ruler measurements
  for (const m of measurements) {
    drawMeasurement(
      ctx,
      page,
      m,
      boardX,
      boardY,
      scale,
      tileXpt,
      tileYpt,
      tileWpt,
      tileHpt,
    );
  }
}

function drawMeasurement(
  ctx: Ctx,
  page: PDFPage,
  m: RulerMeasurement,
  boardX: number,
  boardY: number,
  scale: PdfScale,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
) {
  const { formatSize } = ctx.opts;
  const toP = (meters: number) => ((meters * 1000) / scale) * MM;
  const distanceM = Math.abs(m.anchorB - m.anchorA);
  const label = formatSize(distanceM) ?? `${Math.round(distanceM * 1000)}mm`;
  const minM = Math.min(m.anchorA, m.anchorB);
  const maxM = Math.max(m.anchorA, m.anchorB);
  const color = rgb(0.1, 0.1, 0.1);
  const extColor = rgb(0.4, 0.4, 0.4);
  const arrowSize = 3 * MM;

  if (m.axis === 'x') {
    // Horizontal measurement: anchorA/B are X positions, offsetM is Y position
    const x1 = boardX + toP(minM);
    const x2 = boardX + toP(maxM);
    const y = boardY + toP(m.offsetM);
    const midX = (x1 + x2) / 2;

    // Extension lines (from board bottom edge to dimension line)
    drawClippedLine(
      page,
      x1,
      boardY,
      x1,
      y + 2 * MM,
      cx,
      cy,
      cw,
      ch,
      0.3,
      extColor,
    );
    drawClippedLine(
      page,
      x2,
      boardY,
      x2,
      y + 2 * MM,
      cx,
      cy,
      cw,
      ch,
      0.3,
      extColor,
    );
    // Dimension line
    drawClippedLine(page, x1, y, x2, y, cx, cy, cw, ch, 0.6, color);
    // Arrowheads
    drawArrowH(page, x1, y, 1, arrowSize, cx, cy, cw, ch, color);
    drawArrowH(page, x2, y, -1, arrowSize, cx, cy, cw, ch, color);
    // Label
    const fontSize = Math.max(5, Math.min(8, toP(distanceM) / 6));
    const textW = ctx.font.widthOfTextAtSize(label, fontSize);
    const lx = midX - textW / 2;
    const ly = y + 1.5;
    if (
      lx >= cx &&
      lx + textW <= cx + cw &&
      ly >= cy &&
      ly + fontSize <= cy + ch
    ) {
      page.drawText(label, {
        x: lx,
        y: ly,
        size: fontSize,
        font: ctx.font,
        color,
      });
    }
  } else {
    // Vertical measurement: anchorA/B are Y positions, offsetM is X position
    const y1 = boardY + toP(minM);
    const y2 = boardY + toP(maxM);
    const x = boardX + toP(m.offsetM);
    const midY = (y1 + y2) / 2;

    // Extension lines (from board left edge to dimension line)
    drawClippedLine(
      page,
      boardX,
      y1,
      x + 2 * MM,
      y1,
      cx,
      cy,
      cw,
      ch,
      0.3,
      extColor,
    );
    drawClippedLine(
      page,
      boardX,
      y2,
      x + 2 * MM,
      y2,
      cx,
      cy,
      cw,
      ch,
      0.3,
      extColor,
    );
    // Dimension line
    drawClippedLine(page, x, y1, x, y2, cx, cy, cw, ch, 0.6, color);
    // Arrowheads
    drawArrowV(page, x, y1, 1, arrowSize, cx, cy, cw, ch, color);
    drawArrowV(page, x, y2, -1, arrowSize, cx, cy, cw, ch, color);
    // Label (rotated text not supported in pdf-lib, draw horizontal next to line)
    const fontSize = Math.max(5, Math.min(8, toP(distanceM) / 6));
    const lx = x + 2;
    const ly = midY - fontSize / 2;
    if (lx >= cx && ly >= cy && ly + fontSize <= cy + ch) {
      page.drawText(label, {
        x: lx,
        y: ly,
        size: fontSize,
        font: ctx.font,
        color,
      });
    }
  }
}

function drawClippedLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  thickness: number,
  color: ReturnType<typeof rgb>,
) {
  // Simple clip for axis-aligned lines
  if (x1 === x2) {
    // Vertical line
    if (x1 < cx || x1 > cx + cw) return;
    const minY = Math.max(Math.min(y1, y2), cy);
    const maxY = Math.min(Math.max(y1, y2), cy + ch);
    if (minY >= maxY) return;
    page.drawLine({
      start: { x: x1, y: minY },
      end: { x: x1, y: maxY },
      thickness,
      color,
    });
  } else if (y1 === y2) {
    // Horizontal line
    if (y1 < cy || y1 > cy + ch) return;
    const minX = Math.max(Math.min(x1, x2), cx);
    const maxX = Math.min(Math.max(x1, x2), cx + cw);
    if (minX >= maxX) return;
    page.drawLine({
      start: { x: minX, y: y1 },
      end: { x: maxX, y: y1 },
      thickness,
      color,
    });
  } else {
    // Diagonal - just draw it, rare case
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    });
  }
}

function drawArrowH(
  page: PDFPage,
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  size: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  color: ReturnType<typeof rgb>,
) {
  if (tipX < cx || tipX > cx + cw || tipY < cy || tipY > cy + ch) return;
  const bx = tipX + dir * size;
  // Draw as two lines forming an arrowhead
  page.drawLine({
    start: { x: tipX, y: tipY },
    end: { x: bx, y: tipY + size / 2 },
    thickness: 0.5,
    color,
  });
  page.drawLine({
    start: { x: tipX, y: tipY },
    end: { x: bx, y: tipY - size / 2 },
    thickness: 0.5,
    color,
  });
}

function drawArrowV(
  page: PDFPage,
  tipX: number,
  tipY: number,
  dir: 1 | -1,
  size: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  color: ReturnType<typeof rgb>,
) {
  if (tipX < cx || tipX > cx + cw || tipY < cy || tipY > cy + ch) return;
  const by = tipY + dir * size;
  page.drawLine({
    start: { x: tipX, y: tipY },
    end: { x: tipX + size / 2, y: by },
    thickness: 0.5,
    color,
  });
  page.drawLine({
    start: { x: tipX, y: tipY },
    end: { x: tipX - size / 2, y: by },
    thickness: 0.5,
    color,
  });
}

function drawTileBorder(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.3,
  });
}

interface RectStyle {
  borderColor?: ReturnType<typeof rgb>;
  borderWidth?: number;
  color?: ReturnType<typeof rgb>;
}

// Draw a rectangle clipped to a clip rectangle. Fill is drawn for the visible
// intersection, but borders are drawn on the original rectangle's edges only
// where they fall inside the clip region (i.e., dropped if not visible).
function drawClippedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  style: RectStyle,
) {
  const ix = Math.max(x, cx);
  const iy = Math.max(y, cy);
  const ax = Math.min(x + w, cx + cw);
  const ay = Math.min(y + h, cy + ch);
  if (ax <= ix || ay <= iy) return;
  if (style.color) {
    page.drawRectangle({
      x: ix,
      y: iy,
      width: ax - ix,
      height: ay - iy,
      color: style.color,
    });
  }
  if (style.borderColor && style.borderWidth) {
    // Draw each of the 4 edges only if the edge lies within the clip.
    const drawEdge = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: style.borderWidth!,
        color: style.borderColor!,
      });
    };
    // Bottom
    if (y >= cy && y <= cy + ch) drawEdge(ix, y, ax, y);
    // Top
    if (y + h >= cy && y + h <= cy + ch) drawEdge(ix, y + h, ax, y + h);
    // Left
    if (x >= cx && x <= cx + cw) drawEdge(x, iy, x, ay);
    // Right
    if (x + w >= cx && x + w <= cx + cw) drawEdge(x + w, iy, x + w, ay);
  }
}

function drawScaleLegend(
  ctx: Ctx,
  page: PDFPage,
  pageW: number,
  baselineY: number,
  scale: PdfScale,
) {
  // 100mm of real-world (or 50mm for 1:1) bar length
  const realMm = scale === 1 ? 50 : 100;
  const barMm = realMm / scale;
  const barPt = barMm * MM;
  const margin = ctx.opts.margin;
  const label = `${realMm} mm  ·  Scale 1:${scale}`;
  const labelW = ctx.font.widthOfTextAtSize(label, 8);
  // Right-align the label; the bar sits just below it at the same right edge.
  const right = pageW - margin * MM;
  const labelX = right - labelW;
  const barX = right - barPt;
  const barY = baselineY - 2;

  page.drawText(label, {
    x: labelX,
    y: baselineY + 4,
    size: 8,
    font: ctx.font,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawLine({
    start: { x: barX, y: barY },
    end: { x: barX + barPt, y: barY },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: barX, y: barY - 2 },
    end: { x: barX, y: barY + 2 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: barX + barPt, y: barY - 2 },
    end: { x: barX + barPt, y: barY + 2 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
}
