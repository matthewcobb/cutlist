import type { CutlistSettings } from '~/utils';

export default createGlobalState(() =>
  ref<Record<string, Partial<CutlistSettings>>>({}),
);
