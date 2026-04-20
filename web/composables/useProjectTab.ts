import type { Tab } from './useProjectTabMap';

export default function () {
  const { activeId: projectId } = useProjects();
  const map = useProjectTabMap();

  const key = computed(() => projectId.value ?? '__local__');
  return computed<Tab>({
    get() {
      return map.value[key.value] ?? 'bom';
    },
    set(value) {
      map.value[key.value] = value;
    },
  });
}
