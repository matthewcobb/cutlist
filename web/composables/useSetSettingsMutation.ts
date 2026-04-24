import type { CutlistSettings } from '~/utils';
import { updateSettingsCache } from '~/composables/useSettingsQuery';
import { reportError } from './useAppErrors';

interface MutateOptions {
  onSuccess?: (result: CutlistSettings) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

export default function () {
  const idb = useIdb();
  const isPending = ref(false);

  async function mutate(
    variables: { changes: Partial<CutlistSettings> },
    options?: MutateOptions,
  ) {
    isPending.value = true;
    try {
      const updated = await idb.saveSettings(variables.changes);
      updateSettingsCache(updated);
      options?.onSuccess?.(updated);
    } catch (error) {
      console.error('[settings] Failed to save settings', error);
      reportError({
        title: 'Settings not saved',
        description:
          'Your settings change could not be saved. Check your browser storage.',
        severity: 'warning',
      });
      options?.onError?.(error);
    } finally {
      isPending.value = false;
      options?.onSettled?.();
    }
  }

  return { mutate, isPending };
}
