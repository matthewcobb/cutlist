import {
  Distance,
  generateBoardLayouts,
  type ConfigInput,
  type PartToCut,
} from 'cutlist';
import { computePartNumberOffsets } from '~/utils/partNumberOffsets';
import { parseStock } from '~/utils/parseStock';

export default function () {
  const { activeProject, enabledModels } = useProjects();
  const { bladeWidth, optimize, margin, distanceUnit, stock } =
    useProjectSettings();

  const parts = computed<PartToCut[] | undefined>(() => {
    const project = activeProject.value;
    const models = enabledModels.value;
    if (!project || models.length === 0) return;

    const merged: PartToCut[] = [];
    const offsets = computePartNumberOffsets(models);
    const excluded = new Set(project.excludedColors ?? []);

    for (let i = 0; i < models.length; i++) {
      for (const part of models[i].parts) {
        if (excluded.has(part.colorKey)) continue;
        merged.push({
          partNumber: part.partNumber + offsets[i],
          instanceNumber: part.instanceNumber,
          name: part.name,
          size: part.size,
          material: project.colorMap[part.colorKey] ?? 'Unknown',
          grainLock: part.grainLock,
        });
      }
    }

    return merged;
  });

  const layouts = computed(() => {
    if (
      parts.value == null ||
      bladeWidth.value == null ||
      margin.value == null ||
      optimize.value == null ||
      distanceUnit.value == null ||
      stock.value == null
    )
      return;

    const config: ConfigInput = {
      bladeWidth: new Distance(bladeWidth.value + distanceUnit.value).m,
      margin: new Distance(margin.value + distanceUnit.value).m,
      optimize:
        optimize.value === 'Auto'
          ? 'auto'
          : optimize.value === 'Cuts'
            ? 'cuts'
            : 'cnc',
      precision: 1e-5,
    };
    return generateBoardLayouts(
      toRaw(parts.value),
      parseStock(stock.value),
      config,
    );
  });

  return {
    data: layouts,
    error: ref(null),
  };
}
