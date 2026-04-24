import { rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';

export interface RectStyle {
  borderColor?: ReturnType<typeof rgb>;
  borderWidth?: number;
  color?: ReturnType<typeof rgb>;
}

export function drawClippedLine(
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

export function drawArrowH(
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

export function drawArrowV(
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

export function drawTileBorder(
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

// Draw a rectangle clipped to a clip rectangle. Fill is drawn for the visible
// intersection, but borders are drawn on the original rectangle's edges only
// where they fall inside the clip region (i.e., dropped if not visible).
export function drawClippedRect(
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
