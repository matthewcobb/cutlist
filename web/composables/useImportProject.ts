import type { ProjectExport } from '~/composables/useExportProject';
import { migrateExport } from '~/utils/migrations';
import { gzipDecompress } from '~/utils/compress';
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

export default function useImportProject() {
  const { reloadProjectList, setActive } = useProjects();
  const { reloadSteps } = useBuildSteps();
  const idb = useIdb();

  async function importFromFile(file: File) {
    const text = await gzipDecompress(file);
    const raw = JSON.parse(text);

    // Migrate old exports to current schema (also rejects future versions)
    const migrated = migrateExport(raw);

    // Validate structure after migration
    const result = ProjectExportSchema.safeParse(migrated);
    if (!result.success) {
      throw new Error(
        `Invalid project file: ${result.error.issues[0]?.message ?? 'unknown error'}`,
      );
    }
    const data = migrated as ProjectExport;

    // Create a new project (new UUID to avoid collisions)
    const newProject = await idb.createProject(data.project.name, {
      stock: data.project.stock,
      distanceUnit: data.project.distanceUnit,
    });
    await idb.updateProject(newProject.id, {
      colorMap: data.project.colorMap,
      excludedColors: data.project.excludedColors,
    });

    // Import all models with fresh UUIDs bound to the new project.
    // Build a map of old model IDs → new model IDs for fixing step partRefs.
    const modelIdMap = new Map<string, string>();
    for (const model of data.models) {
      const newId = crypto.randomUUID();
      modelIdMap.set(model.id, newId);
      await idb.createModel({
        ...model,
        id: newId,
        projectId: newProject.id,
      });
    }

    // Import build steps, remapping modelIds to new UUIDs
    for (const step of data.buildSteps ?? []) {
      await idb.createBuildStep({
        ...step,
        id: crypto.randomUUID(),
        projectId: newProject.id,
        partRefs: step.partRefs.map((ref) => ({
          modelId: modelIdMap.get(ref.modelId) ?? ref.modelId,
          partNumber: ref.partNumber,
        })),
      });
    }

    await reloadProjectList();
    setActive(newProject.id);
    await reloadSteps(newProject.id);
  }

  function pickAndImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gz';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await importFromFile(file);
    };
    input.click();
  }

  return { pickAndImport, importFromFile };
}
