import type { CutlistSettings } from '~/utils/settings';

// Module-level singletons so settings are shared across composable instances
const settingsData = ref<CutlistSettings | null>(null);
const settingsLoading = ref(true);
let settingsInitialized = false;

export default function useSettingsQuery() {
  // Init lazily (inside composable, not at module scope) so that any watchers
  // registered by callers are always set up before the async result arrives.
  if (import.meta.client && !settingsInitialized) {
    settingsInitialized = true;
    useIdb()
      .getSettings()
      .then((settings) => {
        settingsData.value = settings;
        settingsLoading.value = false;
      });
  }

  return {
    data: settingsData as Ref<CutlistSettings | null>,
    isLoading: settingsLoading as Ref<boolean>,
  };
}

/** Called by mutation composables after writing to IDB. */
export function updateSettingsCache(updated: CutlistSettings) {
  settingsData.value = updated;
}
