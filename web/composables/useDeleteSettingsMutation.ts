import { updateSettingsCache } from '~/composables/useSettingsQuery';

interface MutateOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
}

export default function () {
  const idb = useIdb();
  const isPending = ref(false);

  async function mutate(_variables?: undefined, options?: MutateOptions) {
    isPending.value = true;
    try {
      const defaults = await idb.resetSettings();
      updateSettingsCache(defaults);
      options?.onSuccess?.();
    } catch (error) {
      console.error('[settings] Failed to reset settings', error);
      options?.onError?.(error);
    } finally {
      isPending.value = false;
      options?.onSettled?.();
    }
  }

  return { mutate, isPending };
}
