/**
 * Barrel module re-exporting the composables/useProjects/ directory.
 *
 * Kept at this path so Nuxt's composable auto-import continues to pick up
 * `useProjects` (and the smaller `useActiveProject`, `useProjectCollection`,
 * `useProjectModels`), and so existing `~/composables/useProjects` imports from
 * every caller resolve without change. `startProjects` is called once from
 * `app.vue` to attach the app-level watchers and initial project-list load.
 */
import useProjects from './useProjects/index';

export default useProjects;
export { useProjects };
export {
  startProjects,
  useActiveProject,
  useProjectCollection,
  useProjectModels,
} from './useProjects/index';
export type {
  ArchivedProjectItem,
  ManualPartInput,
  Model,
  Project,
  ProjectListItem,
} from './useProjects/index';
