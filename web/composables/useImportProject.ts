import type { ProjectExport } from '~/composables/useExportProject';

export default function useImportProject() {
  const { reloadProjectList, setActive } = useProjects();
  const { reloadSteps } = useBuildSteps();
  const idb = useIdb();

  async function importFromFile(file: File) {
    const text = await file.text();
    const data = JSON.parse(text) as ProjectExport;

    if (data.version !== 2) {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    // Create a new project (new UUID to avoid collisions)
    const newProject = await idb.createProject(
      data.project.name,
      data.project.stock,
    );
    await idb.updateProject(newProject.id, { colorMap: data.project.colorMap });

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
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await importFromFile(file);
    };
    input.click();
  }

  return { pickAndImport, importFromFile };
}
