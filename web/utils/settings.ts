import YAML from 'js-yaml';
import type { StockMatrix } from 'cutlist';

export interface CutlistSettings {
  bladeWidth: number;
  distanceUnit: 'in' | 'm' | 'mm';
  extraSpace: number;
  optimize: 'Auto' | 'Cuts' | 'CNC';
  showPartNumbers: boolean;
  stock: string;
}

export const DEFAULT_STOCK: StockMatrix[] = [
  {
    material: 'Plywood',
    thickness: ['18mm', '12mm', '9mm', '6mm'],
    width: ['1220mm'],
    length: ['2440mm'],
  },
  {
    material: 'MDF',
    thickness: ['18mm', '12mm', '9mm', '6mm', '3mm'],
    width: ['1220mm'],
    length: ['2440mm'],
  },
];

export const DEFAULT_SETTINGS: CutlistSettings = {
  bladeWidth: 3,
  distanceUnit: 'mm',
  extraSpace: 3,
  optimize: 'Auto',
  showPartNumbers: true,
  stock: YAML.dump(DEFAULT_STOCK, { indent: 2, flowLevel: 2 }),
};
