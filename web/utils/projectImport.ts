/**
 * Import validation and processing for .cutlist.gz project files.
 *
 * All incoming data is validated against strict Zod schemas before touching
 * any runtime state. Malformed or hostile imports fail with user-readable
 * error messages at the validation boundary.
 *
 * Contract:
 * - `parseProjectExport` validates and migrates raw JSON into a ProjectExport.
 * - `importProjectData` writes validated data into IDB with fresh IDs.
 * - `importProjectFromFile` handles gzip decompression + JSON parsing.
 */

import type { ProjectExport } from '~/composables/useExportProject';
import { gzipDecompress } from '~/utils/compress';
import { migrateExport } from '~/utils/migrations';
import { DEFAULT_SETTINGS } from '~/utils/settings';
import { z } from 'zod';

// ─── Schemas ────────────────────────────────────────────────────────────────

const PartSizeSchema = z.object({
  width: z.number().finite(),
  length: z.number().finite(),
  thickness: z.number().finite(),
});

const PartSchema = z.object({
  partNumber: z.number().int().min(0),
  instanceNumber: z.number().int().min(1),
  name: z.string(),
  colorKey: z.string(),
  size: PartSizeSchema,
  grainLock: z.enum(['length', 'width']).optional(),
});

const PartOverrideSchema = z.object({
  grainLock: z.enum(['length', 'width']).optional(),
  name: z.string().optional(),
});

const DerivedCacheSchema = z
  .object({
    version: z.number().int(),
    parts: z.array(PartSchema),
    colors: z.array(
      z.object({
        key: z.string(),
        rgb: z.tuple([z.number(), z.number(), z.number()]),
        count: z.number().int().min(0),
      }),
    ),
    nodePartMap: z.array(
      z.object({
        nodeIndex: z.number().int(),
        partNumber: z.number().int(),
        colorHex: z.string(),
      }),
    ),
  })
  .optional();

const ModelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string(),
  source: z.enum(['gltf', 'manual']),
  parts: z.array(PartSchema).default([]),
  enabled: z.boolean(),
  gltfJson: z.union([z.record(z.string(), z.unknown()), z.null()]),
  partOverrides: z.record(z.string(), PartOverrideSchema).default({}),
  derivedCache: DerivedCacheSchema,
  createdAt: z.string(),
});

const BuildStepSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  stepNumber: z.number().int().min(0),
  title: z.string(),
  description: z.string(),
  partRefs: z.array(
    z.object({
      modelId: z.string(),
      partNumber: z.number().int(),
    }),
  ),
  createdAt: z.string(),
});

// Packing settings (bladeWidth, margin, optimize, showPartNumbers) now live on
// the project record, so they travel with the export automatically. A
// top-level `settings` field left over from the pre-v2 global-settings export
// format is silently stripped by Zod's default object behaviour.
const ProjectExportSchema = z.object({
  version: z.number(),
  project: z.object({
    id: z.string(),
    name: z.string().min(1, 'Project name cannot be empty'),
    colorMap: z.record(z.string(), z.string()),
    excludedColors: z.array(z.string()).default([]),
    stock: z.string(),
    distanceUnit: z.enum(['in', 'mm']).default(DEFAULT_SETTINGS.distanceUnit),
    bladeWidth: z.number().finite().default(DEFAULT_SETTINGS.bladeWidth),
    margin: z.number().finite().default(DEFAULT_SETTINGS.margin),
    optimize: z
      .enum(['Auto', 'Cuts', 'CNC'])
      .default(DEFAULT_SETTINGS.optimize),
    showPartNumbers: z.boolean().default(DEFAULT_SETTINGS.showPartNumbers),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  models: z.array(ModelSchema),
  buildSteps: z.array(BuildStepSchema).optional(),
});

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Minimal database interface for project import. Decouples import logic
 * from the concrete IDB composable so tests can provide a stub.
 *
 * `createModel` and `createBuildStep` accept `any` intentionally: the import
 * layer spreads Zod-validated output with fresh IDs, producing the correct
 * IDB record shape at runtime. Tightening these to IdbModel/IdbBuildStep
 * would couple this module to the concrete IDB types.
 */
export interface ProjectImportDb {
  createProject: (
    name: string,
    opts?: {
      stock?: string;
      distanceUnit?: 'in' | 'mm';
      bladeWidth?: number;
      margin?: number;
      optimize?: 'Auto' | 'Cuts' | 'CNC';
      showPartNumbers?: boolean;
    },
  ) => Promise<{ id: string }>;
  updateProject: (
    id: string,
    patch: Partial<{
      colorMap: Record<string, string>;
      excludedColors: string[];
    }>,
  ) => Promise<unknown>;
  createModel: (model: any) => Promise<void>;
  createBuildStep: (step: any) => Promise<void>;
}

/**
 * Validate and migrate a raw import payload into a ProjectExport.
 * Throws with a user-readable message if validation fails.
 */
export function parseProjectExport(raw: unknown): ProjectExport {
  // Basic type guard before migration.
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid project file: expected a JSON object.');
  }

  const migrated = migrateExport(raw as Record<string, unknown>);
  const result = ProjectExportSchema.safeParse(migrated);
  if (!result.success) {
    // Build a human-readable summary of validation errors.
    const issues = result.error.issues.slice(0, 3);
    const messages = issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid project file:\n${messages.join('\n')}` +
        (result.error.issues.length > 3
          ? `\n...and ${result.error.issues.length - 3} more issues.`
          : ''),
    );
  }
  return result.data as unknown as ProjectExport;
}

/**
 * Write a validated ProjectExport into IDB. Generates fresh IDs for the
 * project, models, and build steps to avoid collisions with existing data.
 * Returns the new project ID.
 */
export async function importProjectData(
  data: ProjectExport,
  idb: ProjectImportDb,
): Promise<string> {
  const newProject = await idb.createProject(data.project.name, {
    stock: data.project.stock,
    distanceUnit: data.project.distanceUnit,
    bladeWidth: data.project.bladeWidth,
    margin: data.project.margin,
    optimize: data.project.optimize,
    showPartNumbers: data.project.showPartNumbers,
  });
  await idb.updateProject(newProject.id, {
    colorMap: data.project.colorMap,
    excludedColors: data.project.excludedColors,
  });

  // Build a map of old model IDs to new IDs for remapping build-step refs.
  const modelIdMap = new Map<string, string>();
  for (const model of data.models) {
    modelIdMap.set(model.id, crypto.randomUUID());
  }
  await Promise.all(
    data.models.map((model) =>
      idb.createModel({
        ...model,
        id: modelIdMap.get(model.id)!,
        projectId: newProject.id,
      }),
    ),
  );

  await Promise.all(
    (data.buildSteps ?? []).map((step) =>
      idb.createBuildStep({
        ...step,
        id: crypto.randomUUID(),
        projectId: newProject.id,
        partRefs: step.partRefs.flatMap(
          (ref: { modelId: string; partNumber: number }) => {
            const newModelId = modelIdMap.get(ref.modelId);
            if (!newModelId) return [];
            return [{ modelId: newModelId, partNumber: ref.partNumber }];
          },
        ),
      }),
    ),
  );

  return newProject.id;
}

/**
 * Import a .cutlist.gz file. Handles both gzipped and plain JSON input.
 * Returns the new project ID on success.
 * Throws with a user-readable message on any failure.
 */
export async function importProjectFromFile(
  file: File,
  idb: ProjectImportDb,
): Promise<string> {
  let text: string;
  try {
    text = await gzipDecompress(file);
  } catch {
    // Some static hosts may transparently decompress .gz responses.
    // Fall back to plain JSON text when gzip decode fails.
    text = await file.text();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      'Could not parse the file as JSON. Make sure this is a valid .cutlist.gz file.',
    );
  }

  const data = parseProjectExport(raw);
  return importProjectData(data, idb);
}
