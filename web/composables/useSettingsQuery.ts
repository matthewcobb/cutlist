import { useQuery } from '@tanstack/vue-query';

export default function () {
  const projectId = useProjectId();

  return useQuery({
    queryKey: computed(() => ['settings', projectId.value ?? '__local__']),
    queryFn: () => $fetch('/api/settings/document'),
  });
}
