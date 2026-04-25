import {
  DEFAULT_PROJECT_TAB,
  isProjectTabId,
  projectPath,
  tabFromUrlSegment,
  type ProjectTabId,
} from '~/utils/projectTabs';

/**
 * Single owner of the route ↔ state link for the project workspace.
 *
 * Called once from `app.vue`. The URL → state pass runs immediately on app
 * mount so pages don't need to read route params themselves. The state → URL
 * pass uses `replace` so internal mutations (tab switches, project loads)
 * don't pollute browser history; explicit navigation should go through
 * `useProjectNavigation` to push instead.
 */
export default function useUrlSync() {
  const route = useRoute();
  const { activeId } = useProjects();
  const tab = useProjectTab();

  // ── Sync URL → state (browser back/forward + initial load) ────────────────
  watch(
    () => route.params,
    (params) => {
      const pid = (params.projectId as string) || null;
      const segment = (params.tab as string) || null;

      if (pid && pid !== activeId.value) {
        activeId.value = pid;
      }
      if (!pid && activeId.value) {
        activeId.value = null;
      }

      if (!pid) return;

      const desired: ProjectTabId = isProjectTabId(segment)
        ? (segment as ProjectTabId)
        : tabFromUrlSegment(segment);
      const fallback = segment ? desired : DEFAULT_PROJECT_TAB;
      if (fallback !== tab.value) {
        tab.value = fallback;
      }
    },
    { immediate: true },
  );

  // ── Sync state → URL ──────────────────────────────────────────────────────
  watch(
    [activeId, tab] as const,
    ([projectId, currentTab]) => {
      const target = projectPath(projectId, currentTab);
      if (route.path !== target) {
        navigateTo(target, { replace: true });
      }
    },
    { flush: 'post' },
  );
}
