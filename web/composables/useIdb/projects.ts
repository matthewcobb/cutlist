/**
 * Project CRUD: create/read/update/archive/unarchive/delete.
 *
 * Project deletion cascades to models and buildSteps in a
 * single Dexie transaction so partial failures don't leave orphans.
 */

import { DEFAULT_SETTINGS, DEFAULT_STOCK_YAML } from '~/utils/settings';
import { getDb, safeWrite } from './db';
import { applyProjectDefaults, applyModelDefaults } from './defaults';
import type { IdbProject, IdbModelMeta } from './types';

export async function getProjectList(): Promise<
  Pick<IdbProject, 'id' | 'name' | 'updatedAt'>[]
> {
  const db = await getDb();
  const all = await db.projects.orderBy('updatedAt').reverse().toArray();
  return all
    .filter((p) => !p.archivedAt)
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}

export async function getArchivedList(): Promise<
  Required<Pick<IdbProject, 'id' | 'name' | 'archivedAt'>>[]
> {
  const db = await getDb();
  const all = await db.projects.toArray();
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
  const existing = await db.projects.get(id);
  if (!existing) throw new Error(`Project ${id} not found`);
  await safeWrite(() =>
    db.projects.put({
      ...existing,
      archivedAt: new Date().toISOString(),
    }),
  );
}

export async function unarchiveProject(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.projects.get(id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const { archivedAt: _, ...rest } = existing;
  await safeWrite(() => db.projects.put(rest as IdbProject));
}

export async function getProjectWithModels(
  id: string,
): Promise<(IdbProject & { models: IdbModelMeta[] }) | undefined> {
  const db = await getDb();
  const [project, allModels] = await Promise.all([
    db.projects.get(id),
    db.models.where('projectId').equals(id).toArray(),
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
    optimize?: 'Auto' | 'CNC';
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
  await safeWrite(() => db.projects.put(project));
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
  const existing = await db.projects.get(id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const updated: IdbProject = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await safeWrite(() => db.projects.put(updated));
  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await safeWrite(() =>
    db.transaction('rw', [db.projects, db.models, db.buildSteps], async () => {
      await db.models.where('projectId').equals(id).delete();
      await db.buildSteps.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    }),
  );
}
