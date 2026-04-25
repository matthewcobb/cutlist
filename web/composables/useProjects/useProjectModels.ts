/**
 * Model and part operations on the active project.
 *
 * Covers source-model lifecycle (add/remove/toggle), color-map mutations,
 * part overrides (grain lock, name override), and manual-part CRUD via
 * `useManualParts`. Each function returns early when the requested
 * `projectId` is not the active project so calls remain safe across
 * project switches.
 */
import type { Part } from '~/utils/modelTypes';
import { useIdb, type PartOverride } from '~/composables/useIdb';
import { useManualParts } from '~/composables/useManualParts';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { activeProjectData } from './state';
import type { Model } from './types';

export default function useProjectModels() {
  const idb = useIdb();

  async function addModel(projectId: string, model: Model) {
    if (activeProjectData.value?.id === projectId) {
      const { rawSource: _r, ...meta } = model;
      activeProjectData.value = {
        ...activeProjectData.value,
        models: [...activeProjectData.value.models, meta],
      };
    }
    await idb.createModel({
      id: model.id,
      projectId,
      filename: model.filename,
      source: model.source,
      parts: model.parts,
      colors: model.colors ?? [],
      nodePartMap: model.nodePartMap ?? [],
      enabled: model.enabled,
      rawSource: model.rawSource ?? null,
      partOverrides: {},
      createdAt: new Date().toISOString(),
    });
  }

  async function removeModel(projectId: string, modelId: string) {
    if (activeProjectData.value?.id === projectId) {
      activeProjectData.value = {
        ...activeProjectData.value,
        models: activeProjectData.value.models.filter((m) => m.id !== modelId),
      };
    }
    await idb.deleteModel(modelId);
  }

  async function toggleModel(projectId: string, modelId: string) {
    const current = activeProjectData.value?.models.find(
      (m) => m.id === modelId,
    );
    const newEnabled = current ? !current.enabled : true;

    if (activeProjectData.value?.id === projectId) {
      activeProjectData.value = {
        ...activeProjectData.value,
        models: activeProjectData.value.models.map((m) =>
          m.id === modelId ? { ...m, enabled: newEnabled } : m,
        ),
      };
    }
    await idb.updateModel(modelId, { enabled: newEnabled });
  }

  async function updateColorMap(
    id: string,
    colorKey: string,
    material: string,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== id) return;
    const newColorMap = { ...project.colorMap, [colorKey]: material };
    activeProjectData.value = { ...project, colorMap: newColorMap };
    await idb.updateProject(id, { colorMap: newColorMap });
  }

  async function toggleColorExcluded(id: string, colorKey: string) {
    const project = activeProjectData.value;
    if (!project || project.id !== id) return;
    const excluded = project.excludedColors ?? [];
    const newExcluded = excluded.includes(colorKey)
      ? excluded.filter((k) => k !== colorKey)
      : [...excluded, colorKey];
    activeProjectData.value = { ...project, excludedColors: newExcluded };
    await idb.updateProject(id, { excludedColors: newExcluded });
  }

  /** Apply a partial override to a part by its adjusted (project-wide) number. */
  async function applyPartOverride(
    projectId: string,
    adjustedPartNumber: number,
    patch: Partial<PartOverride>,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const enabled = project.models.filter((m) => m.enabled);
    const offsets = computePartNumberOffsets(enabled);

    for (let i = 0; i < enabled.length; i++) {
      const model = enabled[i];
      const targetPartNumber = adjustedPartNumber - offsets[i];
      if (!model.parts.some((d) => d.partNumber === targetPartNumber)) continue;

      const updatedParts: Part[] = model.parts.map((d) =>
        d.partNumber === targetPartNumber ? { ...d, ...patch } : d,
      );
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === model.id ? { ...m, parts: updatedParts } : m,
        ),
      };

      const existing = await idb.getProjectWithModels(projectId);
      const idbModel = existing?.models.find((m) => m.id === model.id);
      const currentOverrides = { ...(idbModel?.partOverrides ?? {}) };
      const merged = { ...currentOverrides[targetPartNumber], ...patch };
      const cleaned = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined),
      ) as PartOverride;
      if (Object.keys(cleaned).length === 0) {
        delete currentOverrides[targetPartNumber];
      } else {
        currentOverrides[targetPartNumber] = cleaned;
      }
      await idb.updateModel(model.id, { partOverrides: currentOverrides });
      break;
    }
  }

  async function updatePartGrainLock(
    projectId: string,
    adjustedPartNumber: number,
    grainLock: 'length' | 'width' | undefined,
  ) {
    await applyPartOverride(projectId, adjustedPartNumber, { grainLock });
  }

  async function updatePartNameOverride(
    projectId: string,
    adjustedPartNumber: number,
    name: string,
  ) {
    const nextName = name.trim();
    if (!nextName) return;
    await applyPartOverride(projectId, adjustedPartNumber, { name: nextName });
  }

  const { addManualPart, updateManualPart, removeManualPart } = useManualParts({
    activeProjectData,
    idb,
    updateColorMap,
  });

  return {
    addModel,
    removeModel,
    toggleModel,
    updateColorMap,
    toggleColorExcluded,
    addManualPart,
    updateManualPart,
    removeManualPart,
    updatePartGrainLock,
    updatePartNameOverride,
  };
}
