import type { Tab } from './useProjectTabMap';

export default function () {
  const projectId = useProjectId();
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
