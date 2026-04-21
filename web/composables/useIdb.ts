import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ColorInfo, NodePartMapping, PartDraft } from '~/utils/parseGltf';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STOCK_YAML,
  type CutlistSettings,
} from '~/utils/settings';
import { runStartupSweep } from '~/utils/migrations';

// ─── Schema ──────────────────────────────────────────────────────────────────

export interface IdbProject {
  id: string;
  name: string;
  colorMap: Record<string, string>;
  /** Per-project stock definition (YAML string). */
  stock: string;
  /** Per-project distance unit. */
  distanceUnit: 'in' | 'mm';
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface IdbModel {
  id: string;
  projectId: string;
  filename: string;
  source: 'gltf' | 'manual';
  drafts: PartDraft[];
  colors: ColorInfo[];
  enabled: boolean;
  gltfJson: object | null;
  nodePartMap: NodePartMapping[] | null;
  createdAt: string;
}

/** Model record without gltfJson — what we keep in the reactive store. */
export type IdbModelMeta = Omit<IdbModel, 'gltfJson'>;

export interface IdbBuildStep {
  id: string;
  projectId: string;
  stepNumber: number;
  title: string;
  description: string;
  /** Stable references using modelId + draft partNumber. */
  partRefs: Array<{ modelId: string; partNumber: number }>;
  createdAt: string;
}

interface IdbSettingsRecord {
  key: 'global-settings';
  settings: CutlistSettings;
}

interface IdbSchemaVersionRecord {
  key: 'schema-version';
  version: number;
}

interface CutlistDb extends DBSchema {
  projects: {
    key: string;
    value: IdbProject;
    indexes: { updatedAt: string };
  };
  models: {
    key: string;
    value: IdbModel;
    indexes: { projectId: string };
  };
  settings: {
    key: string;
    value: IdbSettingsRecord | IdbSchemaVersionRecord;
  };
  buildSteps: {
    key: string;
    value: IdbBuildStep;
    indexes: { projectId: string };
  };
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<CutlistDb>> | null = null;

function getDb(): Promise<IDBPDatabase<CutlistDb>> {
  if (!dbPromise) {
    dbPromise = openDB<CutlistDb>('cutlist-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const projects = db.createObjectStore('projects', { keyPath: 'id' });
          projects.createIndex('updatedAt', 'updatedAt');

          const models = db.createObjectStore('models', { keyPath: 'id' });
          models.createIndex('projectId', 'projectId');

          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          const buildSteps = db.createObjectStore('buildSteps', {
            keyPath: 'id',
          });
          buildSteps.createIndex('projectId', 'projectId');
        }
      },
    })
      .then(async (db) => {
        await runStartupSweep(db);
        return db;
      })
      .catch((err) => {
        dbPromise = null;
        throw new Error(
          `Browser storage unavailable (private browsing may prevent saving projects): ${err.message}`,
        );
      });
  }
  return dbPromise;
}

// ─── Defensive defaults (safety net for records that missed a sweep) ─────────

export function applyProjectDefaults(p: any): IdbProject {
  return {
    ...p,
    stock: p.stock ?? DEFAULT_STOCK_YAML,
    colorMap: p.colorMap ?? {},
    distanceUnit: p.distanceUnit ?? 'mm',
  };
}

export function applyModelDefaults(m: any): IdbModelMeta {
  return {
    ...m,
    source: m.source ?? 'gltf',
    enabled: m.enabled ?? true,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function useIdb() {
  // Projects

  async function getProjectList(): Promise<
    Pick<IdbProject, 'id' | 'name' | 'updatedAt'>[]
  > {
    const db = await getDb();
    const all = await db.getAllFromIndex('projects', 'updatedAt');
    return all
      .reverse()
      .filter((p) => !p.archivedAt)
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  }

  async function getArchivedList(): Promise<
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

  async function archiveProject(id: string): Promise<void> {
    const db = await getDb();
    const existing = await db.get('projects', id);
    if (!existing) throw new Error(`Project ${id} not found`);
    await db.put('projects', {
      ...existing,
      archivedAt: new Date().toISOString(),
    });
  }

  async function unarchiveProject(id: string): Promise<void> {
    const db = await getDb();
    const existing = await db.get('projects', id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const { archivedAt: _, ...rest } = existing;
    await db.put('projects', rest);
  }

  async function getProjectWithModels(
    id: string,
  ): Promise<(IdbProject & { models: IdbModelMeta[] }) | undefined> {
    const db = await getDb();
    const project = await db.get('projects', id);
    if (!project) return undefined;

    const allModels = await db.getAllFromIndex('models', 'projectId', id);
    const models: IdbModelMeta[] = allModels.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ gltfJson: _g, ...meta }) => applyModelDefaults(meta),
    );
    return { ...applyProjectDefaults(project), models };
  }

  async function createProject(
    name: string,
    opts?: { stock?: string; distanceUnit?: 'in' | 'mm' },
  ): Promise<IdbProject> {
    const db = await getDb();
    const now = new Date().toISOString();
    const project: IdbProject = {
      id: crypto.randomUUID(),
      name,
      colorMap: {},
      stock: opts?.stock ?? DEFAULT_STOCK_YAML,
      distanceUnit: opts?.distanceUnit ?? 'mm',
      createdAt: now,
      updatedAt: now,
    };
    await db.put('projects', project);
    return project;
  }

  async function updateProject(
    id: string,
    patch: Partial<
      Pick<
        IdbProject,
        'name' | 'colorMap' | 'stock' | 'distanceUnit' | 'updatedAt'
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
    await db.put('projects', updated);
    return updated;
  }

  async function deleteProject(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(
      ['projects', 'models', 'buildSteps'],
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
    tx.objectStore('projects').delete(id);
    await tx.done;
  }

  // Build Steps

  async function getBuildSteps(projectId: string): Promise<IdbBuildStep[]> {
    const db = await getDb();
    const steps = await db.getAllFromIndex(
      'buildSteps',
      'projectId',
      projectId,
    );
    return steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  async function createBuildStep(step: IdbBuildStep): Promise<void> {
    const db = await getDb();
    await db.put('buildSteps', step);
  }

  async function updateBuildStep(
    id: string,
    patch: Partial<
      Pick<IdbBuildStep, 'title' | 'description' | 'partRefs' | 'stepNumber'>
    >,
  ): Promise<void> {
    const db = await getDb();
    const existing = await db.get('buildSteps', id);
    if (!existing) throw new Error(`BuildStep ${id} not found`);
    await db.put('buildSteps', { ...existing, ...patch });
  }

  async function deleteBuildStep(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('buildSteps', id);
  }

  // Models

  async function createModel(model: IdbModel): Promise<void> {
    const db = await getDb();
    await db.put('models', model);
  }

  async function updateModel(
    id: string,
    patch: Partial<Pick<IdbModel, 'enabled' | 'drafts' | 'colors'>>,
  ): Promise<void> {
    const db = await getDb();
    const existing = await db.get('models', id);
    if (!existing) throw new Error(`Model ${id} not found`);
    // JSON round-trip strips Vue reactive proxies that IDB can't structured-clone.
    const rawPatch = JSON.parse(JSON.stringify(patch));
    await db.put('models', { ...existing, ...rawPatch });
  }

  async function deleteModel(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('models', id);
  }

  async function getModelGltf(id: string): Promise<{
    gltfJson: object | null;
    nodePartMap: NodePartMapping[] | null;
  }> {
    const db = await getDb();
    const model = await db.get('models', id);
    return {
      gltfJson: model?.gltfJson ?? null,
      nodePartMap: model?.nodePartMap ?? null,
    };
  }

  // Settings

  async function getSettings(): Promise<CutlistSettings> {
    const db = await getDb();
    const record = await db.get('settings', 'global-settings');
    return record?.settings ?? { ...DEFAULT_SETTINGS };
  }

  async function saveSettings(
    changes: Partial<CutlistSettings>,
  ): Promise<CutlistSettings> {
    const current = await getSettings();
    const updated = { ...current, ...changes };
    const db = await getDb();
    await db.put('settings', { key: 'global-settings', settings: updated });
    return updated;
  }

  async function resetSettings(): Promise<CutlistSettings> {
    const db = await getDb();
    await db.put('settings', {
      key: 'global-settings',
      settings: { ...DEFAULT_SETTINGS },
    });
    return { ...DEFAULT_SETTINGS };
  }

  return {
    getProjectList,
    getArchivedList,
    getProjectWithModels,
    createProject,
    updateProject,
    archiveProject,
    unarchiveProject,
    deleteProject,
    createModel,
    updateModel,
    deleteModel,
    getModelGltf,
    getSettings,
    saveSettings,
    resetSettings,
    getBuildSteps,
    createBuildStep,
    updateBuildStep,
    deleteBuildStep,
  };
}
