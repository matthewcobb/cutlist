import type { CutlistSettings } from '~/utils/settings';
import { reportError } from '~/composables/useAppErrors';

// Module-level singletons so global settings are shared across call sites.
const settings = ref<CutlistSettings | null>(null);
const isLoading = ref(true);
let initialized = false;
let channel: BroadcastChannel | null = null;

async function reloadFromIdb() {
  try {
    const fresh = await useIdb().getSettings();
    settings.value = fresh;
  } finally {
    isLoading.value = false;
  }
}

function ensureInit() {
  if (!import.meta.client || initialized) return;
  initialized = true;

  reloadFromIdb();

  // Cross-tab sync: listen for 'settings-changed' on the shared
  // 'cutlist-idb' BroadcastChannel (same one useIdb.ts publishes to).
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('cutlist-idb');
      channel.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.event === 'settings-changed') {
          reloadFromIdb();
        }
      });
    } catch {
      // BroadcastChannel unavailable — fall back to single-tab behavior.
    }
  }
}

async function saveSettings(
  changes: Partial<CutlistSettings>,
): Promise<CutlistSettings | undefined> {
  try {
    const updated = await useIdb().saveSettings(changes);
    settings.value = updated;
    return updated;
  } catch (error) {
    console.error('[settings] Failed to save settings', error);
    reportError({
      title: 'Settings not saved',
      description:
        'Your settings change could not be saved. Check your browser storage.',
      severity: 'warning',
    });
    return undefined;
  }
}

export default function useGlobalSettings() {
  ensureInit();
  return {
    settings: settings as Ref<CutlistSettings | null>,
    isLoading: isLoading as Ref<boolean>,
    saveSettings,
  };
}
