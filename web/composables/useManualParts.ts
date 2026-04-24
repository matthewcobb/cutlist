/**
 * Manual part CRUD operations.
 *
 * Extracted from useProjects to keep that composable focused on project-level
 * state and CRUD. These functions mutate activeProjectData and persist to IDB.
 */

import type { Part } from '~/utils/parseGltf';
import type { PartOverride } from '~/composables/useIdb';
import { applyOverrides } from '~/composables/useModelHydration';
import type { ManualPartInput, Project } from '~/composables/useProjects';

interface ManualPartsContext {
  activeProjectData: Ref<Project | null>;
  idb: ReturnType<typeof useIdb>;
  updateColorMap: (
    id: string,
    colorKey: string,
    material: string,
  ) => Promise<void>;
}

export function useManualParts(ctx: ManualPartsContext) {
  const { activeProjectData, idb, updateColorMap } = ctx;

  async function addManualPart(projectId: string, data: ManualPartInput) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    const newPartNumber = existing
      ? Math.max(0, ...existing.parts.map((d) => d.partNumber)) + 1
      : 1;

    const newParts: Part[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber: newPartNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));

    // grainLock goes into partOverrides, not onto the Part
    const newOverrides: Record<number, PartOverride> = {};
    if (data.grainLock) {
      newOverrides[newPartNumber] = { grainLock: data.grainLock };
    }

    if (existing) {
      const updatedParts = [...existing.parts, ...newParts];
      // Merge new overrides with existing (get current from IDB)
      const idbModel = (await idb.getProjectWithModels(projectId))?.models.find(
        (m) => m.id === existing.id,
      );
      const mergedOverrides = {
        ...(idbModel?.partOverrides ?? {}),
        ...newOverrides,
      };
      // Reactive store sees parts with overrides applied
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === existing.id
            ? { ...m, parts: applyOverrides(updatedParts, mergedOverrides) }
            : m,
        ),
      };
      await idb.updateModel(existing.id, {
        parts: updatedParts,
        partOverrides: mergedOverrides,
      });
    } else {
      const modelId = crypto.randomUUID();
      const model = {
        id: modelId,
        filename: 'Manual Parts',
        source: 'manual' as const,
        parts: applyOverrides(newParts, newOverrides),
        colors: [],
        enabled: true,
      };
      activeProjectData.value = {
        ...project,
        models: [...project.models, model],
      };
      await idb.createModel({
        id: modelId,
        projectId,
        filename: model.filename,
        source: 'manual',
        parts: newParts,
        enabled: true,
        gltfJson: null,
        partOverrides: newOverrides,
        createdAt: new Date().toISOString(),
      });
    }

    if (!project.colorMap[data.material]) {
      await updateColorMap(projectId, data.material, data.material);
    }
  }

  async function updateManualPart(
    projectId: string,
    partNumber: number,
    data: ManualPartInput,
  ) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    const remaining = existing.parts.filter((d) => d.partNumber !== partNumber);
    const updated: Part[] = Array.from({ length: data.qty }, (_, i) => ({
      partNumber,
      instanceNumber: i + 1,
      name: data.name,
      colorKey: data.material,
      size: {
        width: data.widthMm / 1000,
        length: data.lengthMm / 1000,
        thickness: data.thicknessMm / 1000,
      },
    }));
    // Strip overrides from remaining parts (they live in partOverrides)
    const cleanParts = [...remaining, ...updated].map(
      ({ grainLock: _, ...rest }) => rest,
    );

    // Update partOverrides for this part number
    const idbModel = (await idb.getProjectWithModels(projectId))?.models.find(
      (m) => m.id === existing.id,
    );
    const updatedOverrides = { ...(idbModel?.partOverrides ?? {}) };
    if (data.grainLock) {
      updatedOverrides[partNumber] = {
        ...updatedOverrides[partNumber],
        grainLock: data.grainLock,
      };
    } else {
      // Clear grainLock if removed
      if (updatedOverrides[partNumber]) {
        const { grainLock: _, ...rest } = updatedOverrides[partNumber];
        if (Object.keys(rest).length === 0) {
          delete updatedOverrides[partNumber];
        } else {
          updatedOverrides[partNumber] = rest;
        }
      }
    }

    activeProjectData.value = {
      ...project,
      models: project.models.map((m) =>
        m.id === existing.id
          ? { ...m, parts: applyOverrides(cleanParts, updatedOverrides) }
          : m,
      ),
    };
    await idb.updateModel(existing.id, {
      parts: cleanParts,
      partOverrides: updatedOverrides,
    });

    if (!project.colorMap[data.material]) {
      await updateColorMap(projectId, data.material, data.material);
    }
  }

  async function removeManualPart(projectId: string, partNumber: number) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    const remaining = existing.parts.filter((d) => d.partNumber !== partNumber);

    if (remaining.length === 0) {
      activeProjectData.value = {
        ...project,
        models: project.models.filter((m) => m.id !== existing.id),
      };
      await idb.deleteModel(existing.id);
    } else {
      activeProjectData.value = {
        ...project,
        models: project.models.map((m) =>
          m.id === existing.id ? { ...m, parts: remaining } : m,
        ),
      };
      await idb.updateModel(existing.id, { parts: remaining });
    }
  }

  return {
    addManualPart,
    updateManualPart,
    removeManualPart,
  };
}
