import { rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { BoardLayout } from 'cutlist';
import type { RulerMeasurement } from '~/composables/useRulerStore';
import type { PdfScale } from '../exportPdf';
import {
  A4_H_MM,
  A4_W_MM,
  BOARD_TITLE_BAND_MM,
  FOOTER_BAND_MM,
  HEADER_BAND_MM,
  LEGEND_BAND_MM,
  MM,
} from './constants';
import { addPage, type Ctx } from './context';
import { drawClippedRect, drawTileBorder } from './geometry';
import { drawMeasurement } from './measurements';

interface TileGeom {
  pageWmm: number;
  pageHmm: number;
  paperWmm: number; // full board width on paper at scale
  paperHmm: number; // full board height on paper at scale
  printableWmm: number;
  printableHmm: number;
}

export function drawBoardTiles(
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
