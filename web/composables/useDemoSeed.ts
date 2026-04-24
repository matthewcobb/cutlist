/**
 * Demo project seeding — imports the bundled demo fixture on first launch.
 *
 * Self-contained: only calls IDB functions + import utilities.
 * No shared reactive state.
 */

import { importProjectFromFile } from '~/utils/projectImport';
import { DEMO_PROJECT_FILENAME, shouldSeedDemoProject } from '~/utils/demoSeed';

/** Fetch and import the bundled demo project. */
export async function seedDemoProject(
  idb: ReturnType<typeof useIdb>,
): Promise<string> {
  const base = import.meta.env.BASE_URL ?? '/';
  const url = `${base.endsWith('/') ? base : `${base}/`}${DEMO_PROJECT_FILENAME}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load demo project (${response.status})`);
  }
  const blob = await response.blob();
  const file = new File([blob], DEMO_PROJECT_FILENAME, {
    type: blob.type || 'application/gzip',
  });
  return importProjectFromFile(file, idb);
}

/** Check whether a demo seed is needed, and perform it if so. */
export async function maybeSeedDemo(
  idb: ReturnType<typeof useIdb>,
): Promise<boolean> {
  const [list, archived, demoSeeded] = await Promise.all([
    idb.getProjectList(),
    idb.getArchivedList(),
    idb.getDemoSeeded(),
  ]);

  if (
    !shouldSeedDemoProject({
      projects: list.length,
      archived: archived.length,
      demoSeeded,
    })
  ) {
    return false;
  }

  try {
    await seedDemoProject(idb);
    await idb.setDemoSeeded(true);
    return true;
  } catch (err) {
    console.warn('Demo project seed failed', err);
    return false;
  }
}
