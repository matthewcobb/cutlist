/**
 * Conversion factor: 1 mm = 72/25.4 PDF points (ISO 32000-1, 1 pt = 1/72 in).
 */
export const MM = 2.83464566929;

/** ISO 216 A4 width in mm. */
export const A4_W_MM = 210;
/** ISO 216 A4 height in mm. */
export const A4_H_MM = 297;

/** Vertical space reserved for the page header (title + date + rule). */
export const HEADER_BAND_MM = 12;
/** Vertical space reserved below the content area (currently unused). */
export const FOOTER_BAND_MM = 0;
/** Vertical space for the per-board material/size subtitle line. */
export const BOARD_TITLE_BAND_MM = 8;
/** Horizontal space reserved for a side legend column (currently unused). */
export const LEGEND_BAND_MM = 0;
