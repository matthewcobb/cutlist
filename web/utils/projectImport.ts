import type { ProjectExport } from '~/composables/useExportProject';
import { gzipDecompress } from '~/utils/compress';
import { migrateExport } from '~/utils/migrations';
import { z } from 'zod';

const ProjectExportSchema = z.object({
  version: z.number(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    colorMap: z.record(z.string(), z.string()),
    excludedColors: z.array(z.string()).default([]),
    stock: z.string(),
    distanceUnit: z.enum(['in', 'mm']).default('mm'),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  models: z.array(
    z.object({
      id: z.string(),
      projectId: z.string(),
      filename: z.string(),
      source: z.enum(['gltf', 'manual']),
      parts: z.array(z.any()).default([]),
      enabled: z.boolean(),
      gltfJson: z.any(),
      partOverrides: z.record(z.string(), z.any()).default({}),
      createdAt: z.string(),
    }),
  ),
  buildSteps: z.array(z.any()).optional(),
  settings: z.any(),
});

interface ProjectImportDb {
  createProject: (
    name: string,
    opts?: { stock?: string; distanceUnit?: 'in' | 'mm' },
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

export function parseProjectExport(raw: unknown): ProjectExport {
  const migrated = migrateExport(raw as any);
  const result = ProjectExportSchema.safeParse(migrated);
  if (!result.success) {
    throw new Error(
      `Invalid project file: ${result.error.issues[0]?.message ?? 'unknown error'}`,
    );
  }
  return migrated as ProjectExport;
}

export async function importProjectData(
  data: ProjectExport,
  idb: ProjectImportDb,
): Promise<string> {
  const newProject = await idb.createProject(data.project.name, {
    stock: data.project.stock,
    distanceUnit: data.project.distanceUnit,
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
        partRefs: step.partRefs.map((ref: any) => ({
          modelId: modelIdMap.get(ref.modelId) ?? ref.modelId,
          partNumber: ref.partNumber,
        })),
      }),
    ),
  );

  return newProject.id;
}

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
  const raw = JSON.parse(text);
  const data = parseProjectExport(raw);
  return importProjectData(data, idb);
}
