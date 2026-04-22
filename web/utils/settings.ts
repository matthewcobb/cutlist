import YAML from 'js-yaml';
import type { StockMatrix } from 'cutlist';

export interface CutlistSettings {
  bladeWidth: number;
  distanceUnit: 'in' | 'mm';
  extraSpace: number;
  optimize: 'Auto' | 'Cuts' | 'CNC';
  showPartNumbers: boolean;
  stock: string;
}

export const DEFAULT_STOCK: StockMatrix[] = [
  {
    material: 'Plywood',
    unit: 'mm',
    thickness: [18, 12, 9, 6],
    sizes: [{ width: 1220, length: 2440 }],
    hasGrain: true,
  },
  {
    material: 'MDF',
    unit: 'mm',
    thickness: [18, 12, 9, 6, 3],
    sizes: [{ width: 1220, length: 2440 }],
    hasGrain: false,
  },
  {
    material: 'Plywood',
    unit: 'in',
    thickness: [0.75, 0.5, 0.25],
    sizes: [{ width: 48, length: 96 }],
    hasGrain: true,
  },
  {
    material: 'Hardwood',
    unit: 'in',
    thickness: [0.75, 1, 1.5],
    sizes: [
      { width: 6, length: 96 },
      { width: 8, length: 96 },
      { width: 12, length: 96 },
    ],
    hasGrain: true,
  },
];

export const DEFAULT_STOCK_YAML = YAML.dump(DEFAULT_STOCK, {
  indent: 2,
  flowLevel: 2,
});

export const DEFAULT_SETTINGS: CutlistSettings = {
  bladeWidth: 3,
  distanceUnit: 'mm',
  extraSpace: 3,
  optimize: 'Auto',
  showPartNumbers: true,
  stock: DEFAULT_STOCK_YAML,
};
