export type GrainLock = 'length' | 'width' | undefined;

const GRAIN_CYCLE: GrainLock[] = [undefined, 'length', 'width'];

export const GRAIN_LABELS: Record<string, string> = {
  length: '↕ Length',
  width: '↔ Width',
};

export function cycleGrainLock(current: GrainLock): GrainLock {
  const i = GRAIN_CYCLE.indexOf(current);
  return GRAIN_CYCLE[(i + 1) % GRAIN_CYCLE.length];
}
