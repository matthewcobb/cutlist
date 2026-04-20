import { createError } from 'h3';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'js-yaml';
import { z } from 'zod';
import { StockMatrix } from 'cutlist';
import { DEFAULT_SETTINGS, DEFAULT_STOCK, type CutlistSettings } from '~/utils';

// Resolve config file path. Override via CUTLIST_CONFIG_PATH env var.
// Default: ../cutlist.config.yaml relative to cwd (dev cwd = web/).
function getConfigPath(): string {
  const override = process.env.CUTLIST_CONFIG_PATH;
  if (override && override.trim().length > 0) return path.resolve(override);
  return path.resolve(process.cwd(), '..', 'cutlist.config.yaml');
}

interface FileConfig {
  bladeWidth?: number;
  distanceUnit?: CutlistSettings['distanceUnit'];
  extraSpace?: number;
  optimize?: CutlistSettings['optimize'];
  showPartNumbers?: boolean;
  stock?: unknown;
}

export async function getDocumentSettings(): Promise<CutlistSettings> {
  const file = await readConfigFile();
  return fileToSettings(file);
}

export async function saveDocumentSettings(
  changes: Partial<CutlistSettings>,
): Promise<CutlistSettings> {
  const current = await readConfigFile();
  const merged: FileConfig = { ...current };

  if (changes.bladeWidth !== undefined) merged.bladeWidth = changes.bladeWidth;
  if (changes.distanceUnit !== undefined)
    merged.distanceUnit = changes.distanceUnit;
  if (changes.extraSpace !== undefined) merged.extraSpace = changes.extraSpace;
  if (changes.optimize !== undefined) merged.optimize = changes.optimize;
  if (changes.showPartNumbers !== undefined)
    merged.showPartNumbers = changes.showPartNumbers;
  if (typeof changes.stock === 'string') {
    // Parse and validate the YAML string submitted by the client, then
    // persist as native YAML structure so the config file stays readable.
    try {
      const parsed = z.array(StockMatrix).parse(YAML.load(changes.stock));
      merged.stock = parsed;
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid stock YAML: ${error?.message ?? 'parse error'}`,
      });
    }
  }

  await writeConfigFile(merged);
  return fileToSettings(merged);
}

export async function resetDocumentSettings(): Promise<CutlistSettings> {
  const defaults: FileConfig = {
    bladeWidth: DEFAULT_SETTINGS.bladeWidth,
    distanceUnit: DEFAULT_SETTINGS.distanceUnit,
    extraSpace: DEFAULT_SETTINGS.extraSpace,
    optimize: DEFAULT_SETTINGS.optimize,
    showPartNumbers: DEFAULT_SETTINGS.showPartNumbers,
    stock: DEFAULT_STOCK,
  };
  await writeConfigFile(defaults);
  return fileToSettings(defaults);
}

async function readConfigFile(): Promise<FileConfig> {
  const filePath = getConfigPath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = YAML.load(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as FileConfig;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {};
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read config at ${filePath}: ${error?.message ?? error}`,
    });
  }
}

async function writeConfigFile(config: FileConfig): Promise<void> {
  const filePath = getConfigPath();
  const header =
    '# Cutlist configuration\n' +
    '# Edit values here to change defaults. Saved from the UI writes back to this file.\n\n';
  const body = YAML.dump(config, { indent: 2, lineWidth: 120 });
  try {
    await fs.writeFile(filePath, header + body, 'utf8');
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to write config at ${filePath}: ${error?.message ?? error}`,
    });
  }
}

function fileToSettings(file: FileConfig): CutlistSettings {
  const stockArray = normalizeStock(file.stock);
  return {
    bladeWidth:
      typeof file.bladeWidth === 'number'
        ? file.bladeWidth
        : DEFAULT_SETTINGS.bladeWidth,
    distanceUnit:
      toDistanceUnit(file.distanceUnit) ?? DEFAULT_SETTINGS.distanceUnit,
    extraSpace:
      typeof file.extraSpace === 'number'
        ? file.extraSpace
        : DEFAULT_SETTINGS.extraSpace,
    optimize: toOptimize(file.optimize) ?? DEFAULT_SETTINGS.optimize,
    showPartNumbers:
      typeof file.showPartNumbers === 'boolean'
        ? file.showPartNumbers
        : DEFAULT_SETTINGS.showPartNumbers,
    stock: YAML.dump(stockArray, { indent: 2, flowLevel: 2 }),
  };
}

function normalizeStock(value: unknown) {
  if (typeof value === 'string') {
    try {
      return z.array(StockMatrix).parse(YAML.load(value));
    } catch {
      return DEFAULT_STOCK;
    }
  }
  if (Array.isArray(value)) {
    try {
      return z.array(StockMatrix).parse(value);
    } catch {
      return DEFAULT_STOCK;
    }
  }
  return DEFAULT_STOCK;
}

function toDistanceUnit(
  value: unknown,
): CutlistSettings['distanceUnit'] | undefined {
  if (typeof value !== 'string') return;
  const v = value.trim().toLowerCase();
  if (['in', 'inch', 'inches'].includes(v)) return 'in';
  if (['mm', 'millimeter', 'millimeters'].includes(v)) return 'mm';
  if (['m', 'meter', 'meters'].includes(v)) return 'm';
  return;
}

function toOptimize(value: unknown): CutlistSettings['optimize'] | undefined {
  if (value === 'Auto' || value === 'Cuts' || value === 'CNC') return value;
  // Backwards-compat with previously persisted "Space" setting.
  if (value === 'Space') return 'CNC';
  return;
}
