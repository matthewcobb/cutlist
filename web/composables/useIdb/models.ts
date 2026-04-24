/**
 * Model CRUD plus the debounced-write coalescer.
 *
 * Rapid override toggles (e.g. grain lock cycling) would otherwise cause
 * write amplification. `updateModel` buffers lightweight patches in a
 * module-level map and flushes after a short delay — N clicks become 1 write.
 *
 * Bulk patches (`parts`) bypass debouncing since callers expect immediate
 * persistence.
 *
 * The pending-write map is module-level (one per process) so `flushPendingModelWrites`
 * drains all in-flight coalesced writes regardless of which caller enqueued them.
 */

import { getDb, safeWrite } from './db';
import type { IdbModel } from './types';

export async function createModel(model: IdbModel): Promise<void> {
  const db = await getDb();
  await safeWrite(() => db.models.put(model));
}

// ── Debounced model writes ─────────────────────────────────────────────────

const pendingModelPatches = new Map<
  string,
  {
    patch: Partial<Pick<IdbModel, 'enabled' | 'parts' | 'partOverrides'>>;
    timer: ReturnType<typeof setTimeout>;
  }
>();

const MODEL_WRITE_DEBOUNCE_MS = 150;

async function flushModelWrite(id: string): Promise<void> {
  const entry = pendingModelPatches.get(id);
  if (!entry) return;
  pendingModelPatches.delete(id);
  clearTimeout(entry.timer);

  const db = await getDb();
  const existing = await db.models.get(id);
  if (!existing) throw new Error(`Model ${id} not found`);
  const rawPatch = JSON.parse(JSON.stringify(entry.patch));
  await safeWrite(() => db.models.put({ ...existing, ...rawPatch }));
}

export async function updateModel(
  id: string,
  patch: Partial<Pick<IdbModel, 'enabled' | 'parts' | 'partOverrides'>>,
): Promise<void> {
  // For bulk writes (parts) skip debouncing — these are infrequent and
  // callers expect immediate persistence.
  if (patch.parts != null) {
    const db = await getDb();
    const existing = await db.models.get(id);
    if (!existing) throw new Error(`Model ${id} not found`);
    const rawPatch = JSON.parse(JSON.stringify(patch));
    await safeWrite(() => db.models.put({ ...existing, ...rawPatch }));
    return;
  }

  // Lightweight patches (partOverrides, enabled) are debounced.
  const existing = pendingModelPatches.get(id);
  const merged = existing ? { ...existing.patch, ...patch } : { ...patch };

  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => flushModelWrite(id), MODEL_WRITE_DEBOUNCE_MS);
  pendingModelPatches.set(id, { patch: merged, timer });
}

/** Flush all pending debounced model writes immediately. Useful for tests. */
export async function flushPendingModelWrites(): Promise<void> {
  const ids = [...pendingModelPatches.keys()];
  await Promise.all(ids.map((id) => flushModelWrite(id)));
}

// Best-effort flush when the user closes the tab mid-debounce. Matches the
// `useProjectSettings` handler; see its comment for the same reasoning.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pendingModelPatches.size === 0) return;
    void flushPendingModelWrites();
  });
}

export async function deleteModel(id: string): Promise<void> {
  const db = await getDb();
  await safeWrite(() => db.models.delete(id));
}

export async function getModelRawSource(
  id: string,
): Promise<object | string | null> {
  const db = await getDb();
  const model = await db.models.get(id);
  return model?.rawSource ?? null;
}
