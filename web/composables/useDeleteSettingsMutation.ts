import { useMutation, useQueryClient } from '@tanstack/vue-query';

export default function () {
  const client = useQueryClient();
  const projectId = useProjectId();

  return useMutation({
    mutationFn() {
      return $fetch('/api/settings/document', { method: 'DELETE' });
    },
    onSettled() {
      client.invalidateQueries({
        queryKey: ['settings', projectId.value ?? '__local__'],
      });
    },
    onError(error) {
      console.error('[settings] Failed to reset settings', error);
    },
  });
}
