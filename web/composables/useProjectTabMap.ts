import type { ProjectTabId } from '~/utils/projectTabs';

export type Tab = ProjectTabId;

export default createGlobalState(() =>
  useSessionStorage<Record<string, Tab | undefined>>('@cutlist/tab-map', {}),
);
