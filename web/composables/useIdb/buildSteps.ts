/**
 * Build step CRUD. Steps are sorted by `stepNumber` on read; callers may
 * renumber via `updateBuildStep` to reorder.
 */

import { getDb, safeWrite } from './db';
import type { IdbBuildStep } from './types';

export async function getBuildSteps(
  projectId: string,
): Promise<IdbBuildStep[]> {
  const db = await getDb();
  const steps = await db.buildSteps
    .where('projectId')
    .equals(projectId)
    .toArray();
  return steps.sort((a, b) => a.stepNumber - b.stepNumber);
}

export async function createBuildStep(step: IdbBuildStep): Promise<void> {
  const db = await getDb();
  await safeWrite(() => db.buildSteps.put(step));
}

export async function updateBuildStep(
  id: string,
  patch: Partial<Pick<IdbBuildStep, 'title' | 'description' | 'stepNumber'>>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.buildSteps.get(id);
  if (!existing) throw new Error(`BuildStep ${id} not found`);
  await safeWrite(() => db.buildSteps.put({ ...existing, ...patch }));
}

export async function deleteBuildStep(id: string): Promise<void> {
  const db = await getDb();
  await safeWrite(() => db.buildSteps.delete(id));
}
