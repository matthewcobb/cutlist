/**
 * Per-project layout cache. Written by the layout worker path, read on
 * project switch. Entries are rejected when their `cacheVersion` no longer
 * matches the current `LAYOUT_CACHE_VERSION`.
 *
 * Writes are advisory: failures are swallowed because the layout can always
 * be recomputed from source on the next load.
 */

import { LAYOUT_CACHE_VERSION } from '~/utils/migrations';
import { getDb, safeWrite } from './db';
import type { IdbLayoutCache } from './types';

export async function getLayoutCache(
  projectId: string,
): Promise<IdbLayoutCache | undefined> {
  const db = await getDb();
  const entry = await db.get('layoutCache', projectId);
  if (!entry) return undefined;
  // Reject entries from a different cache version — treat as miss.
  if (entry.cacheVersion !== LAYOUT_CACHE_VERSION) return undefined;
  return entry;
}

export async function putLayoutCache(entry: IdbLayoutCache): Promise<void> {
  const db = await getDb();
  // JSON round-trip strips Vue reactive proxies and class instances.
  const raw = JSON.parse(JSON.stringify(entry)) as IdbLayoutCache;
  await safeWrite(() => db.put('layoutCache', raw)).catch(() => {
    // Layout cache writes are advisory — swallow errors silently.
    // The layout will simply be recomputed on next load.
  });
}

export async function deleteLayoutCache(projectId: string): Promise<void> {
  const db = await getDb();
  await db.delete('layoutCache', projectId);
}
