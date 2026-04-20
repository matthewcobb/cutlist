import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { CutlistSettings } from '~/utils';

export default function () {
  const client = useQueryClient();
  const projectId = useProjectId();

  return useMutation({
    mutationFn({ changes }: { changes: Partial<CutlistSettings> }) {
      return $fetch('/api/settings/document', {
        method: 'POST',
        body: { changes },
      });
    },
    onSettled() {
      client.invalidateQueries({
        queryKey: ['settings', projectId.value ?? '__local__'],
      });
    },
    onError(error) {
      console.error('[settings] Failed to save settings', error);
    },
  });
}
