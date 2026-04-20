import { Distance } from 'cutlist';

/**
 * Watches the active distance unit and converts bladeWidth / extraSpace
 * whenever it changes. Uses createSharedComposable so only one watcher
 * runs regardless of how many components mount.
 */
export const useUnitConverter = createSharedComposable(() => {
  const { bladeWidth, distanceUnit, extraSpace } = useProjectSettings();

  watch(distanceUnit, (newUnit, oldUnit) => {
    if (!newUnit || !oldUnit) return;

    const convert = (value: Ref<string | number | undefined>) => {
      if (value.value == null) return;
      value.value = roundDistance(
        new Distance(value.value + oldUnit)[newUnit],
        newUnit,
      );
    };

    convert(bladeWidth);
    convert(extraSpace);
  });
});

function roundDistance(value: number, unit: 'in' | 'm' | 'mm') {
  if (unit === 'mm') return Number(value.toFixed(3));
  return Number(value.toFixed(5));
}
