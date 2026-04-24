/**
 * Project CRUD: create/read/update/archive/unarchive/delete.
 *
 * Project deletion cascades to models, buildSteps, and layoutCache in a
 * single transaction so partial failures don't leave orphans.
 */

import { DEFAULT_SETTINGS, DEFAULT_STOCK_YAML } from '~/utils/settings';
import { getDb, safeWrite, notifyOtherTabs } from './db';
import { applyProjectDefaults, applyModelDefaults } from './defaults';
import type { IdbProject, IdbModelMeta } from './types';

export async function getProjectList(): Promise<
  Pick<IdbProject, 'id' | 'name' | 'updatedAt'>[]
> {
  const db = await getDb();
  const all = await db.getAllFromIndex('projects', 'updatedAt');
  return all
    .reverse()
    .filter((p) => !p.archivedAt)
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}

export async function getArchivedList(): Promise<
  Required<Pick<IdbProject, 'id' | 'name' | 'archivedAt'>>[]
> {
  const db = await getDb();
  const all = await db.getAllFromIndex('projects', 'updatedAt');
  return all
    .filter((p) => !!p.archivedAt)
    .sort((a, b) => (b.archivedAt! > a.archivedAt! ? 1 : -1))
    .map(({ id, name, archivedAt }) => ({
      id,
      name,
      archivedAt: archivedAt!,
    }));
}

export async function archiveProject(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('projects', id);
  if (!existing) throw new Error(`Project ${id} not found`);
  await safeWrite(() =>
    db.put('projects', {
      ...existing,
      archivedAt: new Date().toISOString(),
    }),
  );
  notifyOtherTabs('project-updated');
}

export async function unarchiveProject(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('projects', id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const { archivedAt: _, ...rest } = existing;
  await safeWrite(() => db.put('projects', rest));
  notifyOtherTabs('project-updated');
}

export async function getProjectWithModels(
  id: string,
): Promise<(IdbProject & { models: IdbModelMeta[] }) | undefined> {
  const db = await getDb();
  const [project, allModels] = await Promise.all([
    db.get('projects', id),
    db.getAllFromIndex('models', 'projectId', id),
  ]);
  if (!project) return undefined;

  const models: IdbModelMeta[] = allModels
    .map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ gltfJson: _g, ...meta }) => applyModelDefaults(meta),
    )
    // Sort by createdAt to ensure stable model ordering across loads.
    // Without this, IDB returns models in UUID (primary key) order, which
    // is random — causing part number offsets to shift between sessions.
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { ...applyProjectDefaults(project), models };
}

export async function createProject(
  name: string,
  opts?: {
    stock?: string;
    distanceUnit?: 'in' | 'mm';
    bladeWidth?: number;
    margin?: number;
    optimize?: 'Auto' | 'Cuts' | 'CNC';
    showPartNumbers?: boolean;
  },
): Promise<IdbProject> {
  const db = await getDb();
  const now = new Date().toISOString();
  const project: IdbProject = {
    id: crypto.randomUUID(),
    name,
    colorMap: {},
    excludedColors: [],
    stock: opts?.stock ?? DEFAULT_STOCK_YAML,
    distanceUnit: opts?.distanceUnit ?? DEFAULT_SETTINGS.distanceUnit,
    bladeWidth: opts?.bladeWidth ?? DEFAULT_SETTINGS.bladeWidth,
    margin: opts?.margin ?? DEFAULT_SETTINGS.margin,
    optimize: opts?.optimize ?? DEFAULT_SETTINGS.optimize,
    showPartNumbers: opts?.showPartNumbers ?? DEFAULT_SETTINGS.showPartNumbers,
    createdAt: now,
    updatedAt: now,
  };
  await safeWrite(() => db.put('projects', project));
  notifyOtherTabs('project-created');
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<
    Pick<
      IdbProject,
      | 'name'
      | 'colorMap'
      | 'excludedColors'
      | 'stock'
      | 'distanceUnit'
      | 'bladeWidth'
      | 'margin'
      | 'optimize'
      | 'showPartNumbers'
      | 'updatedAt'
    >
  >,
): Promise<IdbProject> {
  const db = await getDb();
  const existing = await db.get('projects', id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const updated: IdbProject = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await safeWrite(() => db.put('projects', updated));
  notifyOtherTabs('project-updated');
  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['projects', 'models', 'buildSteps', 'layoutCache'],
    'readwrite',
  );
  const modelKeys = await tx
    .objectStore('models')
    .index('projectId')
    .getAllKeys(id);
  for (const key of modelKeys) {
    tx.objectStore('models').delete(key);
  }
  const stepKeys = await tx
    .objectStore('buildSteps')
    .index('projectId')
    .getAllKeys(id);
  for (const key of stepKeys) {
    tx.objectStore('buildSteps').delete(key);
  }
  tx.objectStore('layoutCache').delete(id);
  tx.objectStore('projects').delete(id);
  await tx.done;
  notifyOtherTabs('project-deleted');
}
