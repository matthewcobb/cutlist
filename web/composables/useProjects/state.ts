/**
 * Module-level singletons shared by the project composables.
 *
 * Sub-composables (`useActiveProject`, `useProjectCollection`,
 * `useProjectModels`) read and mutate these refs directly so they all observe
 * the same source of truth without provide/inject plumbing.
 *
 * This file lives inside the `useProjects/` directory specifically so it is
 * not a top-level composable file and does not get auto-imported by Nuxt.
 */
import { ref } from 'vue';
import type { ArchivedProjectItem, Project, ProjectListItem } from './types';

export const activeId = ref<string | null>(null);
export const projectList = ref<ProjectListItem[]>([]);
export const archivedList = ref<ArchivedProjectItem[]>([]);
export const activeProjectData = ref<Project | null>(null);
export const projectLoading = ref(false);
