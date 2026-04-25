/**
 * Project state composables.
 *
 * `useProjects` is the compatibility facade — it composes the smaller, focused
 * sub-composables (`useActiveProject`, `useProjectCollection`,
 * `useProjectModels`) so existing callers keep their flat API. New callers
 * should prefer reaching for the sub-composable that matches their concern.
 */
import useActiveProject, {
  startActiveProjectWatcher,
} from './useActiveProject';
import useProjectCollection, {
  startProjectCollection,
} from './useProjectCollection';
import useProjectModels from './useProjectModels';
import { projectPath } from '~/utils/projectTabs';

export { default as useActiveProject } from './useActiveProject';
export { default as useProjectCollection } from './useProjectCollection';
export { default as useProjectModels } from './useProjectModels';

export type {
  ArchivedProjectItem,
  ManualPartInput,
  Model,
  Project,
  ProjectListItem,
} from './types';

export function startProjects() {
  startActiveProjectWatcher();
  startProjectCollection();
}

export default function useProjects() {
  const active = useActiveProject();

  function setActive(id: string) {
    if (id === active.activeId.value) return;
    navigateTo(projectPath(id, null));
  }

  return {
    ...active,
    ...useProjectCollection(),
    ...useProjectModels(),
    setActive,
  };
}
