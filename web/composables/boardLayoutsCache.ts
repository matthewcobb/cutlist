/**
 * Per-project layout cache — the reactive source of truth for packer results.
 *
 * A plain `Map<projectId, entry>` wrapped in a `shallowRef` so consumers pick
 * up results that land from background workers, including for projects the
 * user has navigated away from. Never persisted; a full reload starts cold.
 *
 * Writes clone the Map so the shallowRef sees a new reference; we avoid deep
 * reactivity on the (potentially large) layout arrays.
 */

import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';

export interface LayoutCacheEntry {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
  fingerprint: string;
}

const store = shallowRef(new Map<string, LayoutCacheEntry>());

export function get(projectId: string): LayoutCacheEntry | undefined {
  return store.value.get(projectId);
}

export function set(projectId: string, entry: LayoutCacheEntry): void {
  const next = new Map(store.value);
  next.set(projectId, entry);
  store.value = next;
}

export function remove(projectId: string): void {
  if (!store.value.has(projectId)) return;
  const next = new Map(store.value);
  next.delete(projectId);
  store.value = next;
}

export function clear(): void {
  store.value = new Map();
}
