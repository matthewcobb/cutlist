/**
 * Derives board/part color sets from a base hex color.
 * Falls back to a palette of wood-toned browns when no color is configured.
 */

export const FALLBACK_PALETTE: string[] = [
  '#ebe6de', // melamine (white laminate)
  '#dcc391', // softwood (pine)
  '#d2b996', // plywood (birch)
  '#c8b48c', // particle board (chipboard)
  '#c3a050', // OSB (golden strands)
  '#b09078', // MDF (uniform warm brown)
  '#a5784a', // hardwood (oak / maple)
  '#8c5035', // cherry / mahogany
  '#7a6a5a', // smoked oak / ash
  '#694123', // hardboard / walnut
  '#4a2a15', // dark walnut / wenge
  '#1a1210', // ebony
];

export interface MaterialColorSet {
  board: string;
  part: string;
  partHover: string;
  text: string;
  textHover: string;
  grain: string;
}

const DEFAULT_COLOR = FALLBACK_PALETTE[0];

export function getMaterialColor(hex: string | undefined): MaterialColorSet {
  const base = hex || DEFAULT_COLOR;
  return {
    part: base,
    board: `color-mix(in oklab, ${base}, black 35%)`,
    partHover: `color-mix(in oklab, ${base}, white 18%)`,
    text: `color-mix(in oklab, ${base}, black 55%)`,
    textHover: `color-mix(in oklab, ${base}, black 70%)`,
    grain: `color-mix(in oklab, ${base}, black 45%)`,
  };
}
