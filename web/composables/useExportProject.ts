import type { CutlistSettings } from '~/utils/settings';
import type { IdbBuildStep, IdbModel } from '~/composables/useIdb';
import { SCHEMA_VERSION } from '~/utils/migrations';
import { gzipCompress } from '~/utils/compress';

export interface ProjectExport {
  version: number;
  exportedAt: string;
  project: {
    id: string;
    name: string;
    colorMap: Record<string, string>;
    stock: string;
    distanceUnit: 'in' | 'mm';
    createdAt: string;
    updatedAt: string;
  };
  models: IdbModel[];
  buildSteps?: IdbBuildStep[];
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

    const buildSteps = await idb.getBuildSteps(activeId.value);
    const settings = await idb.getSettings();

    const data: ProjectExport = {
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        id: idbProject.id,
        name: idbProject.name,
        colorMap: idbProject.colorMap,
        stock: idbProject.stock,
        distanceUnit: idbProject.distanceUnit,
        createdAt: idbProject.createdAt,
        updatedAt: idbProject.updatedAt,
      },
      models: fullModels,
      buildSteps,
      settings,
    };

    const blob = await gzipCompress(JSON.stringify(data));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${idbProject.name.replace(/\s+/g, '-')}.cutlist.gz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { exportProject };
}
