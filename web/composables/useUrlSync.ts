import type { Tab } from './useProjectTabMap';

const VALID_TABS: Set<string> = new Set<Tab>([
  'bom',
  'model',
  'boards',
  'layout',
  'instructions',
  'settings',
]);

function buildPath(projectId: string | null, tab: string | null) {
  if (!projectId) return '/';
  if (tab && tab !== 'bom') return `/${projectId}/${tab}`;
  return `/${projectId}`;
}

export default function useUrlSync() {
  const route = useRoute();
  const router = useRouter();
  const { activeId } = useProjects();
  const tab = useProjectTab();

  // ── Sync state → URL ───────────────────────────────────────────────────────
  watch(
    [activeId, tab] as const,
    ([projectId, currentTab]) => {
      const target = buildPath(projectId, currentTab);
      if (route.path !== target) {
        navigateTo(target, { replace: true });
      }
    },
    { flush: 'post' },
  );

  // ── Sync URL → state (browser back/forward) ───────────────────────────────
  watch(
    () => route.params,
    (params) => {
      const pid = (params.projectId as string) || null;
      const t = (params.tab as string) || null;

      if (pid && pid !== activeId.value) {
        activeId.value = pid;
      }
      if (!pid && activeId.value) {
        activeId.value = null;
      }
      if (t && VALID_TABS.has(t) && t !== tab.value) {
        tab.value = t as Tab;
      }
      if (!t && pid && tab.value !== 'bom') {
        tab.value = 'bom';
      }
    },
  );
}
