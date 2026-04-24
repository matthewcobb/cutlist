import { rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { RulerMeasurement } from '~/composables/useRulerStore';
import type { PdfScale } from '../exportPdf';
import { MM } from './constants';
import type { Ctx } from './context';
import { drawArrowH, drawArrowV, drawClippedLine } from './geometry';

export function drawMeasurement(
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
