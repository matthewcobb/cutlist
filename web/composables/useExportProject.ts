import type { CutlistSettings } from '~/utils/settings';
import type { IdbModel } from '~/composables/useIdb';

export interface ProjectExport {
  version: 1;
  exportedAt: string;
  project: {
    id: string;
    name: string;
    colorMap: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  };
  models: IdbModel[];
  settings: CutlistSettings;
}

export default function useExportProject() {
  const { activeId } = useProjects();
  const idb = useIdb();

  async function exportProject() {
    if (!activeId.value) return;

    // Fetch from IDB to get real timestamps and gltfJson in one pass
    const idbProject = await idb.getProjectWithModels(activeId.value);
    if (!idbProject) return;

    const fullModels: IdbModel[] = await Promise.all(
      idbProject.models.map(async (m) => ({
        ...m,
        ...(await idb.getModelGltf(m.id)),
      })),
    );

    const settings = await idb.getSettings();

    const data: ProjectExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project: {
        id: idbProject.id,
        name: idbProject.name,
        colorMap: idbProject.colorMap,
        createdAt: idbProject.createdAt,
        updatedAt: idbProject.updatedAt,
      },
      models: fullModels,
      settings,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${idbProject.name.replace(/\s+/g, '-')}.cutlist.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { exportProject };
}
