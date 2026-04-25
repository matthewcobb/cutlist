import { projectPath, type ProjectTabId } from '~/utils/projectTabs';

/**
 * Navigation helpers for the project workspace.
 *
 * These wrappers push history entries through `navigateTo` so the back button
 * works as users expect. Pure state changes (e.g. switching tabs) are handled
 * by setting the relevant ref directly; `useUrlSync` mirrors them to the URL
 * with `replace: true`.
 */
export default function useProjectNavigation() {
  const { activeId } = useProjects();
  const tab = useProjectTab();

  /** Navigate to a project. No-op if already active. */
  function setActiveProject(id: string | null) {
    if (id === activeId.value) return;
    navigateTo(projectPath(id, null));
  }

  /** Navigate back to the home/landing page. */
  function goHome() {
    if (activeId.value === null) return;
    navigateTo('/');
  }

  /** Switch the workspace tab. URL sync mirrors the change to the URL. */
  function setTab(next: ProjectTabId) {
    tab.value = next;
  }

  return { setActiveProject, goHome, setTab };
}
