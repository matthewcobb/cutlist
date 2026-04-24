/**
 * Per-project in-memory layout cache used by `useBoardLayoutsQuery`.
 *
 * This is the tab's short-term memory for packer output. It's a plain
 * `Map<projectId, entry>` — the cache is never persisted to IDB, so a full
 * page reload always starts cold. Within the session it lets us skip the
 * worker when the user revisits a project whose inputs haven't changed,
 * and show the last-known layout as a stale result while a recompute is
 * in flight.
 *
 * `classify(cached, inputFingerprint)` is the pure decision function that
 * tells the composable what to do:
 *   - `hit`   — serve cached, skip the worker entirely.
 *   - `stale` — show cached immediately while recomputing.
 *   - `miss`  — no cached entry, show a spinner.
 */

import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';

export interface LayoutCacheEntry {
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
  fingerprint: string;
}

export type CacheStatus = 'hit' | 'stale' | 'miss';

const cache = new Map<string, LayoutCacheEntry>();

export function get(projectId: string): LayoutCacheEntry | undefined {
  return cache.get(projectId);
}

export function set(projectId: string, entry: LayoutCacheEntry): void {
  cache.set(projectId, entry);
}

/** Clear all cached entries. Intended for tests and future cache-reset UI. */
export function clear(): void {
  cache.clear();
}

/**
 * Pure decision: given the current cached entry (if any) and a fresh input
 * fingerprint, classify what the caller should do. Extracted so the
 * semantics can be unit-tested independently of the Vue composable.
 */
export function classify(
  cached: LayoutCacheEntry | undefined,
  inputFingerprint: string,
): CacheStatus {
  if (!cached) return 'miss';
  return cached.fingerprint === inputFingerprint ? 'hit' : 'stale';
}
