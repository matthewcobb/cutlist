import type { ProjectExport } from '~/composables/useExportProject';

export default function useImportProject() {
  const { reloadProjectList, setActive } = useProjects();
  const idb = useIdb();

  async function importFromFile(file: File) {
    const text = await file.text();
    const data: ProjectExport = JSON.parse(text);

    if (data.version !== 1) {
      throw new Error(`Unsupported export version: ${(data as any).version}`);
    }

    // Create a new project (new UUID to avoid collisions)
    const newProject = await idb.createProject(data.project.name);
    await idb.updateProject(newProject.id, { colorMap: data.project.colorMap });

    // Import all models with fresh UUIDs bound to the new project
    for (const model of data.models) {
      await idb.createModel({
        ...model,
        id: crypto.randomUUID(),
        projectId: newProject.id,
      });
    }

    // Settings from the export are intentionally not applied —
    // the user's global settings should not be silently overwritten on import.

    await reloadProjectList();
    setActive(newProject.id);
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
