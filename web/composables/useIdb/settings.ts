/**
 * Global settings read/write. Settings are stored under a single well-known
 * key so there's always at most one record. Other tabs are notified on
 * every mutation so their in-memory copies re-hydrate.
 */

import { DEFAULT_SETTINGS, type CutlistSettings } from '~/utils/settings';
import { getDb, safeWrite, notifyOtherTabs } from './db';
import type { IdbSettingsRecord } from './types';

export async function getSettings(): Promise<CutlistSettings> {
  const db = await getDb();
  const record = await db.get('settings', 'global-settings');
  return (
    (record as IdbSettingsRecord | undefined)?.settings ?? {
      ...DEFAULT_SETTINGS,
    }
  );
}

export async function saveSettings(
  changes: Partial<CutlistSettings>,
): Promise<CutlistSettings> {
  const current = await getSettings();
  const updated = { ...current, ...changes };
  const db = await getDb();
  await safeWrite(() =>
    db.put('settings', { key: 'global-settings', settings: updated }),
  );
  notifyOtherTabs('settings-changed');
  return updated;
}

export async function resetSettings(): Promise<CutlistSettings> {
  const db = await getDb();
  await db.put('settings', {
    key: 'global-settings',
    settings: { ...DEFAULT_SETTINGS },
  });
  notifyOtherTabs('settings-changed');
  return { ...DEFAULT_SETTINGS };
}
