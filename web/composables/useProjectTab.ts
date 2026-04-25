import { DEFAULT_PROJECT_TAB, type ProjectTabId } from '~/utils/projectTabs';

export default function () {
  const { activeId: projectId } = useProjects();
  const map = useProjectTabMap();

  const key = computed(() => projectId.value ?? '__local__');
  return computed<ProjectTabId>({
    get() {
      return map.value[key.value] ?? DEFAULT_PROJECT_TAB;
    },
    set(value) {
      map.value[key.value] = value;
    },
  });
}
