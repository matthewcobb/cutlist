/**
 * Tests for useDemoSeed — maybeSeedDemo guard logic and error handling.
 *
 * The happy path (actual fetch + import of the demo .cutlist.gz) requires
 * a bundled asset served by the dev server, which is not available in unit
 * tests. We test the guard logic (shouldSeedDemoProject is already tested
 * in useProjects.demoSeed.test.ts) and verify graceful error handling when
 * fetch fails.
 *
 * NOTE: We deliberately avoid mock.module on ~/utils/projectImport because
 * Bun's module mocks are global and would break projectImport's own tests
 * when run in the same process.
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { useIdb } from '../useIdb';
import { maybeSeedDemo, seedDemoProject } from '../useDemoSeed';

const idb = useIdb();

describe('maybeSeedDemo', () => {
  it('skips when already seeded', async () => {
    // Ensure at least one project exists and mark as seeded
    await idb.createProject('Existing Project');
    await idb.setDemoSeeded(true);

    const result = await maybeSeedDemo(idb);
    expect(result).toBe(false);
  });

  it('skips when projects already exist even if not seeded', async () => {
    await idb.setDemoSeeded(false);
    // There are already projects from previous tests in the shared IDB
    const list = await idb.getProjectList();
    if (list.length === 0) {
      await idb.createProject('Guard Test');
    }

    const result = await maybeSeedDemo(idb);
    expect(result).toBe(false);
  });
});

describe('seedDemoProject error handling', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when fetch returns non-OK response', async () => {
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 404,
        statusText: 'Not Found',
      })) as unknown as typeof fetch;

    let threw = false;
    try {
      await seedDemoProject(idb);
    } catch (e: any) {
      threw = true;
      expect(e.message).toContain('Failed to load demo project');
      expect(e.message).toContain('404');
    }
    expect(threw).toBe(true);
  });

  it('throws on network error', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network error');
    }) as unknown as typeof fetch;

    let threw = false;
    try {
      await seedDemoProject(idb);
    } catch (e: any) {
      threw = true;
      expect(e.message).toBe('Network error');
    }
    expect(threw).toBe(true);
  });
});
