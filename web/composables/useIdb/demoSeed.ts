/**
 * One-shot marker recording whether the demo project has been seeded.
 * Stored in the `settings` store under `DEMO_SEEDED_KEY` so it rides along
 * with the existing schema without adding a new object store.
 */

import { getDb } from './db';
import { DEMO_SEEDED_KEY, type IdbDemoSeedRecord } from './types';

export async function getDemoSeeded(): Promise<boolean> {
  const db = await getDb();
  const record = await db.get('settings', DEMO_SEEDED_KEY);
  return (record as IdbDemoSeedRecord | undefined)?.seeded === true;
}

export async function setDemoSeeded(seeded: boolean): Promise<void> {
  const db = await getDb();
  await db.put('settings', {
    key: DEMO_SEEDED_KEY,
    seeded,
  });
}
