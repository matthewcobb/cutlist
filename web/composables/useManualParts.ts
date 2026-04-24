/**
 * Manual part CRUD operations.
 *
 * Extracted from useProjects to keep that composable focused on project-level
 * state and CRUD. These functions mutate activeProjectData and persist to IDB.
 */

import type { Part } from '~/utils/parseGltf';
import type { PartOverride } from '~/composables/useIdb';
import { applyOverrides } from '~/composables/useModelHydration';
import type { ManualPartInput, Model, Project } from '~/composables/useProjects';
import { pushUndoCommand } from '~/composables/useUndo';

interface ManualPartsContext {
  activeProjectData: Ref<Project | null>;
  idb: ReturnType<typeof useIdb>;
  updateColorMap: (
    id: string,
    colorKey: string,
    material: string,
    _skipUndo?: boolean,
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

    // Capture before-state for undo
    const beforeParts = existing ? [...existing.parts] : [];
    const idbModelBefore = existing
      ? (await idb.getProjectWithModels(projectId))?.models.find(
          (m) => m.id === existing.id,
        )
      : null;
    const beforeOverrides = { ...(idbModelBefore?.partOverrides ?? {}) };
    const beforeStoredParts = idbModelBefore ? [...idbModelBefore.parts] : [];
    const createdNewModel = !existing;

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

    let modelId: string;

    if (existing) {
      modelId = existing.id;
      const updatedParts = [...existing.parts, ...newParts];
      const mergedOverrides = {
        ...beforeOverrides,
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
      modelId = crypto.randomUUID();
      const model: Model = {
        id: modelId,
        filename: 'Manual Parts',
        source: 'manual',
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
      await updateColorMap(projectId, data.material, data.material, true);
    }

    pushUndoCommand(projectId, {
      label: `Add part "${data.name}"`,
      undo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        if (createdNewModel) {
          activeProjectData.value = {
            ...current,
            models: current.models.filter((m) => m.id !== modelId),
          };
          await idb.deleteModel(modelId);
        } else {
          activeProjectData.value = {
            ...current,
            models: current.models.map((m) =>
              m.id === modelId
                ? { ...m, parts: applyOverrides(beforeParts, beforeOverrides) }
                : m,
            ),
          };
          await idb.updateModel(modelId, {
            parts: beforeStoredParts,
            partOverrides: beforeOverrides,
          });
        }
      },
      redo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        const existingModel = current.models.find((m) => m.id === modelId);
        if (createdNewModel) {
          const model: Model = {
            id: modelId,
            filename: 'Manual Parts',
            source: 'manual',
            parts: applyOverrides(newParts, newOverrides),
            colors: [],
            enabled: true,
          };
          activeProjectData.value = {
            ...current,
            models: [...current.models, model],
          };
          await idb.createModel({
            id: modelId,
            projectId,
            filename: 'Manual Parts',
            source: 'manual',
            parts: newParts,
            enabled: true,
            gltfJson: null,
            partOverrides: newOverrides,
            createdAt: new Date().toISOString(),
          });
        } else if (existingModel) {
          const redoParts = [...existingModel.parts, ...newParts];
          const idbMeta = (
            await idb.getProjectWithModels(projectId)
          )?.models.find((m) => m.id === modelId);
          const redoOverrides = {
            ...(idbMeta?.partOverrides ?? {}),
            ...newOverrides,
          };
          activeProjectData.value = {
            ...current,
            models: current.models.map((m) =>
              m.id === modelId
                ? { ...m, parts: applyOverrides(redoParts, redoOverrides) }
                : m,
            ),
          };
          await idb.updateModel(modelId, {
            parts: redoParts,
            partOverrides: redoOverrides,
          });
        }
      },
    });
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

    // Capture before-state for undo
    const beforeReactiveParts = [...existing.parts];
    const idbModelBefore = (
      await idb.getProjectWithModels(projectId)
    )?.models.find((m) => m.id === existing.id);
    const beforeStoredParts = idbModelBefore ? [...idbModelBefore.parts] : [];
    const beforeOverrides = { ...(idbModelBefore?.partOverrides ?? {}) };

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
    const updatedOverrides = { ...beforeOverrides };
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
      await updateColorMap(projectId, data.material, data.material, true);
    }

    pushUndoCommand(projectId, {
      label: `Edit part "${data.name}"`,
      undo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        activeProjectData.value = {
          ...current,
          models: current.models.map((m) =>
            m.id === existing.id
              ? {
                  ...m,
                  parts: applyOverrides(beforeReactiveParts, beforeOverrides),
                }
              : m,
          ),
        };
        await idb.updateModel(existing.id, {
          parts: beforeStoredParts,
          partOverrides: beforeOverrides,
        });
      },
      redo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        activeProjectData.value = {
          ...current,
          models: current.models.map((m) =>
            m.id === existing.id
              ? { ...m, parts: applyOverrides(cleanParts, updatedOverrides) }
              : m,
          ),
        };
        await idb.updateModel(existing.id, {
          parts: cleanParts,
          partOverrides: updatedOverrides,
        });
      },
    });
  }

  async function removeManualPart(projectId: string, partNumber: number) {
    const project = activeProjectData.value;
    if (!project || project.id !== projectId) return;

    const existing = project.models.find((m) => m.source === 'manual');
    if (!existing) return;

    // Capture before-state for undo
    const beforeReactiveParts = [...existing.parts];
    const idbModelBefore = (
      await idb.getProjectWithModels(projectId)
    )?.models.find((m) => m.id === existing.id);
    const beforeStoredParts = idbModelBefore ? [...idbModelBefore.parts] : [];
    const beforeOverrides = { ...(idbModelBefore?.partOverrides ?? {}) };
    const removedPartName =
      existing.parts.find((d) => d.partNumber === partNumber)?.name ?? 'part';
    const removedEntireModel =
      existing.parts.filter((d) => d.partNumber !== partNumber).length === 0;

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

    pushUndoCommand(projectId, {
      label: `Remove part "${removedPartName}"`,
      undo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        if (removedEntireModel) {
          const model: Model = {
            id: existing.id,
            filename: 'Manual Parts',
            source: 'manual',
            parts: applyOverrides(beforeReactiveParts, beforeOverrides),
            colors: [],
            enabled: true,
          };
          activeProjectData.value = {
            ...current,
            models: [...current.models, model],
          };
          await idb.createModel({
            id: existing.id,
            projectId,
            filename: 'Manual Parts',
            source: 'manual',
            parts: beforeStoredParts,
            enabled: true,
            gltfJson: null,
            partOverrides: beforeOverrides,
            createdAt: new Date().toISOString(),
          });
        } else {
          activeProjectData.value = {
            ...current,
            models: current.models.map((m) =>
              m.id === existing.id
                ? {
                    ...m,
                    parts: applyOverrides(beforeReactiveParts, beforeOverrides),
                  }
                : m,
            ),
          };
          await idb.updateModel(existing.id, {
            parts: beforeStoredParts,
            partOverrides: beforeOverrides,
          });
        }
      },
      redo: async () => {
        const current = activeProjectData.value;
        if (!current || current.id !== projectId) return;
        if (removedEntireModel) {
          activeProjectData.value = {
            ...current,
            models: current.models.filter((m) => m.id !== existing.id),
          };
          await idb.deleteModel(existing.id);
        } else {
          activeProjectData.value = {
            ...current,
            models: current.models.map((m) =>
              m.id === existing.id ? { ...m, parts: remaining } : m,
            ),
          };
          await idb.updateModel(existing.id, { parts: remaining });
        }
      },
    });
  }

  return {
    addManualPart,
    updateManualPart,
    removeManualPart,
  };
}
