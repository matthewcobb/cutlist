import 'fake-indexeddb/auto';
import { describe, expect, it } from 'bun:test';
import { useIdb } from '../useIdb';
import type { IdbLayoutCache } from '../useIdb';
import { LAYOUT_CACHE_VERSION } from '../../utils/migrations';

const idb = useIdb();

function makeLayoutCache(
  projectId: string,
  overrides?: Partial<IdbLayoutCache>,
): IdbLayoutCache {
  return {
    projectId,
    fingerprint: 'abc123',
    cacheVersion: LAYOUT_CACHE_VERSION,
    layouts: [],
    leftovers: [],
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('layout cache CRUD', () => {
  it('stores and retrieves a layout cache entry', async () => {
    const project = await idb.createProject('LayoutCacheTest');
    const entry = makeLayoutCache(project.id);
    await idb.putLayoutCache(entry);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeDefined();
    expect(result!.projectId).toBe(project.id);
    expect(result!.fingerprint).toBe('abc123');
    expect(result!.cacheVersion).toBe(LAYOUT_CACHE_VERSION);
  });

  it('returns undefined for nonexistent project', async () => {
    const result = await idb.getLayoutCache('nonexistent-project-id');
    expect(result).toBeUndefined();
  });

  it('overwrites existing entry on put', async () => {
    const project = await idb.createProject('LayoutOverwrite');
    await idb.putLayoutCache(
      makeLayoutCache(project.id, { fingerprint: 'first' }),
    );
    await idb.putLayoutCache(
      makeLayoutCache(project.id, { fingerprint: 'second' }),
    );

    const result = await idb.getLayoutCache(project.id);
    expect(result!.fingerprint).toBe('second');
  });

  it('deletes a layout cache entry', async () => {
    const project = await idb.createProject('LayoutDelete');
    await idb.putLayoutCache(makeLayoutCache(project.id));
    await idb.deleteLayoutCache(project.id);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeUndefined();
  });

  it('deleteLayoutCache is a no-op for nonexistent project', async () => {
    // Should not throw
    await idb.deleteLayoutCache('definitely-not-real');
  });
});

describe('layout cache version filtering', () => {
  it('rejects entries with a different cacheVersion as cache miss', async () => {
    const project = await idb.createProject('LayoutVersionMiss');
    const staleEntry = makeLayoutCache(project.id, {
      cacheVersion: LAYOUT_CACHE_VERSION - 1,
      fingerprint: 'stale',
    });
    await idb.putLayoutCache(staleEntry);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeUndefined();
  });

  it('rejects entries with a future cacheVersion', async () => {
    const project = await idb.createProject('LayoutVersionFuture');
    const futureEntry = makeLayoutCache(project.id, {
      cacheVersion: LAYOUT_CACHE_VERSION + 1,
      fingerprint: 'future',
    });
    await idb.putLayoutCache(futureEntry);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeUndefined();
  });

  it('accepts entries with matching cacheVersion', async () => {
    const project = await idb.createProject('LayoutVersionMatch');
    const entry = makeLayoutCache(project.id, {
      cacheVersion: LAYOUT_CACHE_VERSION,
      fingerprint: 'current',
    });
    await idb.putLayoutCache(entry);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeDefined();
    expect(result!.fingerprint).toBe('current');
  });
});

describe('layout cache cascade on project delete', () => {
  it('deleteProject also removes its layout cache entry', async () => {
    const project = await idb.createProject('LayoutCascade');
    await idb.putLayoutCache(makeLayoutCache(project.id));

    await idb.deleteProject(project.id);

    const result = await idb.getLayoutCache(project.id);
    expect(result).toBeUndefined();
  });
});
