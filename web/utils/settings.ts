import YAML from 'js-yaml';
import type { StockMatrix } from 'cutlist';

export interface CutlistSettings {
  bladeWidth: number;
  distanceUnit: 'in' | 'mm';
  margin: number;
  optimize: 'Auto' | 'CNC';
  showPartNumbers: boolean;
  stock: string;
}

interface StockPreset {
  /** Display label in the preset dropdown. */
  label: string;
  /** If true, this preset is auto-added to new projects. */
  default: boolean;
  /** The stock matrix definition. */
  stock: StockMatrix;
}

export const STOCK_PRESETS: StockPreset[] = [
  // ── Metric (mm) ────────────────────────────────────────
  {
    label: 'Plywood (mm)',
    default: true,
    stock: {
      material: 'Plywood',
      unit: 'mm',
      color: '#d2b996',
      sizes: [{ width: 1220, length: 2440, thickness: [18, 12, 9, 6] }],
    },
  },
  {
    label: 'MDF (mm)',
    default: true,
    stock: {
      material: 'MDF',
      unit: 'mm',
      color: '#b09078',
      sizes: [{ width: 1220, length: 2440, thickness: [18, 12, 9, 6, 3] }],
    },
  },
  {
    label: 'Particle Board (mm)',
    default: false,
    stock: {
      material: 'Particle Board',
      unit: 'mm',
      color: '#c8b48c',
      sizes: [{ width: 1220, length: 2440, thickness: [18, 16, 12] }],
    },
  },
  {
    label: 'Melamine (mm)',
    default: false,
    stock: {
      material: 'Melamine',
      unit: 'mm',
      color: '#ebe6de',
      sizes: [{ width: 1220, length: 2440, thickness: [18, 16] }],
    },
  },
  {
    label: 'OSB (mm)',
    default: false,
    stock: {
      material: 'OSB',
      unit: 'mm',
      color: '#c3a050',
      sizes: [{ width: 1220, length: 2440, thickness: [18, 12, 9] }],
    },
  },
  {
    label: 'Hardboard (mm)',
    default: false,
    stock: {
      material: 'Hardboard',
      unit: 'mm',
      color: '#694123',
      sizes: [{ width: 1220, length: 2440, thickness: [6, 3] }],
    },
  },
  // ── Imperial (in) ──────────────────────────────────────
  {
    label: 'Plywood (in)',
    default: true,
    stock: {
      material: 'Plywood',
      unit: 'in',
      color: '#d2b996',
      sizes: [{ width: 48, length: 96, thickness: [0.75, 0.5, 0.25] }],
    },
  },
  {
    label: 'MDF (in)',
    default: false,
    stock: {
      material: 'MDF',
      unit: 'in',
      color: '#b09078',
      sizes: [{ width: 48, length: 96, thickness: [0.75, 0.5, 0.25] }],
    },
  },
  {
    label: 'Hardwood Lumber (in)',
    default: true,
    stock: {
      material: 'Hardwood',
      unit: 'in',
      color: '#a5784a',
      sizes: [
        { width: 6, length: 96, thickness: [0.75, 1, 1.5] },
        { width: 8, length: 96, thickness: [0.75, 1, 1.5] },
        { width: 12, length: 96, thickness: [0.75, 1, 1.5] },
      ],
    },
  },
  {
    label: 'Softwood Lumber (in)',
    default: false,
    stock: {
      material: 'Softwood',
      unit: 'in',
      color: '#dcc391',
      sizes: [
        { width: 3.5, length: 96, thickness: [0.75, 1.5] },
        { width: 5.5, length: 96, thickness: [0.75, 1.5] },
        { width: 7.25, length: 96, thickness: [0.75, 1.5] },
        { width: 11.25, length: 96, thickness: [0.75, 1.5] },
      ],
    },
  },
];

const DEFAULT_STOCK: StockMatrix[] = STOCK_PRESETS.filter((p) => p.default).map(
  (p) => p.stock,
);

export const DEFAULT_STOCK_YAML = YAML.dump(DEFAULT_STOCK, {
  indent: 2,
  flowLevel: 2,
});

export const DEFAULT_SETTINGS: CutlistSettings = {
  bladeWidth: 3,
  distanceUnit: 'mm',
  margin: 0,
  optimize: 'Auto',
  showPartNumbers: true,
  stock: DEFAULT_STOCK_YAML,
};
