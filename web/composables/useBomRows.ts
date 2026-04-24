/**
 * Reactive BOM (bill of materials) row computation.
 *
 * Combines packing engine results (when available) with raw model data
 * (fallback) to produce a flat list of BomRow objects for display.
 */

import { groupPartsByNumber } from '~/lib/utils/bom-utils';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import type { Model } from '~/composables/useProjects';

export interface BomRow {
  number: number;
  name: string;
  modelId: string;
  modelName: string;
  qty: number;
  material: string;
  thicknessM: number;
  widthM: number;
  lengthM: number;
  grainLock?: 'length' | 'width';
  leftoverCount: number;
  isManual: boolean;
}

function modelDisplayName(model: {
  filename: string;
  source: 'gltf' | 'manual';
}): string {
  const filename = model.filename.trim();
  if (filename) return filename;
  return model.source === 'manual' ? 'Manual Parts' : 'Model';
}

export default function useBomRows() {
  const { data, isComputing } = useBoardLayoutsQuery();
  const { activeProject, enabledModels } = useProjects();

  const manualPartNumbers = computed(() => {
    const models = enabledModels.value;
    const offsets = computePartNumberOffsets(models);
    const set = new Set<number>();
    for (let i = 0; i < models.length; i++) {
      if (models[i].source === 'manual') {
        const seen = new Set<number>();
        for (const part of models[i].parts) {
          if (!seen.has(part.partNumber)) {
            set.add(part.partNumber + offsets[i]);
            seen.add(part.partNumber);
          }
        }
      }
    }
    return set;
  });

  const modelByPartNumber = computed(() => {
    const models = enabledModels.value;
    const offsets = computePartNumberOffsets(models);
    const map = new Map<number, { id: string; name: string }>();
    for (let i = 0; i < models.length; i++) {
      const label = modelDisplayName(models[i]);
      const seen = new Set<number>();
      for (const part of models[i].parts) {
        if (seen.has(part.partNumber)) continue;
        map.set(part.partNumber + offsets[i], {
          id: models[i].id,
          name: label,
        });
        seen.add(part.partNumber);
      }
    }
    return map;
  });

  const allRows = computed<BomRow[]>(() => {
    // Use packing engine results when available (authoritative)
    if (data.value != null) {
      const leftoverCounts = new Map<number, number>();
      for (const l of data.value.leftovers) {
        leftoverCounts.set(
          l.partNumber,
          (leftoverCounts.get(l.partNumber) ?? 0) + 1,
        );
      }
      return groupPartsByNumber(
        data.value.layouts.flatMap((l) => l.placements),
        data.value.leftovers,
      ).map((instanceList) => {
        const part = instanceList[0];
        const model = modelByPartNumber.value.get(part.partNumber);
        return {
          number: part.partNumber,
          name: part.name,
          modelId: model?.id ?? '',
          modelName: model?.name ?? '',
          qty: instanceList.length,
          material: part.material,
          thicknessM: part.thicknessM,
          widthM: part.widthM,
          lengthM: part.lengthM,
          grainLock: part.grainLock,
          leftoverCount: leftoverCounts.get(part.partNumber) ?? 0,
          isManual: manualPartNumbers.value.has(part.partNumber),
        };
      });
    }

    // Fallback: build from raw model parts when engine hasn't run
    const project = activeProject.value;
    if (!project) return [];
    const models = enabledModels.value;
    if (models.length === 0) return [];

    const offsets = computePartNumberOffsets(models);
    const excluded = new Set(project.excludedColors ?? []);
    const groups = new Map<number, BomRow>();

    for (let i = 0; i < models.length; i++) {
      const isManual = models[i].source === 'manual';
      const byPn = new Map<number, Model['parts'][number][]>();
      for (const part of models[i].parts) {
        if (excluded.has(part.colorKey)) continue;
        const list = byPn.get(part.partNumber) ?? [];
        list.push(part);
        byPn.set(part.partNumber, list);
      }
      for (const [pn, parts] of byPn) {
        groups.set(pn + offsets[i], {
          number: pn + offsets[i],
          name: parts[0].name,
          modelId: models[i].id,
          modelName: modelDisplayName(models[i]),
          material: project.colorMap[parts[0].colorKey] ?? parts[0].colorKey,
          qty: parts.length,
          thicknessM: parts[0].size.thickness,
          widthM: parts[0].size.width,
          lengthM: parts[0].size.length,
          grainLock: parts[0].grainLock,
          leftoverCount: 0,
          isManual,
        });
      }
    }

    return [...groups.values()].sort((a, b) => a.number - b.number);
  });

  /** Summary computeds */
  const totalParts = computed(() =>
    allRows.value.reduce((s, r) => s + r.qty, 0),
  );
  const materialNames = computed(() => [
    ...new Set(allRows.value.map((r) => r.material)),
  ]);
  const warningCount = computed(
    () => allRows.value.filter((r) => r.leftoverCount > 0).length,
  );

  const showModelColumn = computed(
    () =>
      new Set(allRows.value.map((row) => row.modelId).filter(Boolean)).size > 1,
  );

  return {
    allRows,
    isComputing,
    totalParts,
    materialNames,
    warningCount,
    showModelColumn,
    manualPartNumbers,
  };
}
