import { Distance, toFraction } from 'cutlist';

export default function () {
  const { distanceUnit } = useProjectSettings();

  return (m: number | undefined | null) => {
    if (m == null || toValue(distanceUnit) == null) return;

    const distance = new Distance(m);
    if (toValue(distanceUnit) === 'in') {
      return `${toFraction(distance.in)}"`;
    }
    if (toValue(distanceUnit) === 'mm') {
      return `${roundMetric(distance.mm, 2)}mm`;
    }
    return `${roundMetric(distance.m)}m`;
  };
}

function roundMetric(value: number, precision = 3) {
  return String(Number(value.toFixed(precision)));
}
