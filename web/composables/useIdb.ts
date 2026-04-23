import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import type { ColorInfo, NodePartMapping, Part } from '~/utils/parseGltf';
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
  /** Color keys excluded from BOM (unchecked in mapping panel). */
  excludedColors: string[];
  /** Per-project stock definition (YAML string). */
  stock: string;
  /** Per-project distance unit. */
  distanceUnit: 'in' | 'mm';
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PartOverride {
  grainLock?: 'length' | 'width';
  name?: string;
}

/**
 * Cached output of `deriveFromGltf` for a GLTF model. Keyed by DERIVE_VERSION
 * — stale entries (lower version) are ignored and re-derived.
 */
export interface DerivedCache {
  version: number;
  parts: Part[];
  colors: ColorInfo[];
  nodePartMap: NodePartMapping[];
}

export interface IdbModel {
  id: string;
  projectId: string;
  filename: string;
  source: 'gltf' | 'manual';
  /** Source of truth for manual models. GLTF models re-derive from gltfJson on load. */
  parts: Part[];
  enabled: boolean;
  /** Raw GLTF JSON. Null for manual models. */
  gltfJson: object | null;
  /** Per-part user overrides, keyed by partNumber. Extensible for future fields. */
  partOverrides: Record<number, PartOverride>;
  /** Cached derive output for GLTF models. Undefined until first derive. */
  derivedCache?: DerivedCache;
  createdAt: string;
}

/** Model record without gltfJson — what we keep in the reactive store. */
export type IdbModelMeta = Omit<IdbModel, 'gltfJson'>;

/**
 * Persisted layout result for a project. Keyed by projectId; `fingerprint`
 * hashes the packing inputs (parts + stock + config) so a mismatch triggers
 * recompute. Written by the layout worker path, read on project switch.
 */
export interface IdbLayoutCache {
  projectId: string;
  fingerprint: string;
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
  savedAt: string;
}

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

const DEMO_SEEDED_KEY = 'demo-seeded-v1' as const;

interface IdbDemoSeedRecord {
  key: typeof DEMO_SEEDED_KEY;
  seeded: boolean;
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
    value: IdbSettingsRecord | IdbSchemaVersionRecord | IdbDemoSeedRecord;
  };
  buildSteps: {
    key: string;
    value: IdbBuildStep;
    indexes: { projectId: string };
  };
  layoutCache: {
    key: string;
    value: IdbLayoutCache;
  };
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<CutlistDb>> | null = null;

function getDb(): Promise<IDBPDatabase<CutlistDb>> {
  if (!dbPromise) {
    dbPromise = openDB<CutlistDb>('cutlist-db', 3, {
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
        if (oldVersion < 3) {
          db.createObjectStore('layoutCache', { keyPath: 'projectId' });
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
    excludedColors: p.excludedColors ?? [],
    distanceUnit: p.distanceUnit ?? 'mm',
  };
}

export function applyModelDefaults(m: any): IdbModelMeta {
  return {
    ...m,
    source: m.source ?? 'gltf',
    enabled: m.enabled ?? true,
    partOverrides: m.partOverrides ?? {},
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
    const [project, allModels] = await Promise.all([
      db.get('projects', id),
      db.getAllFromIndex('models', 'projectId', id),
    ]);
    if (!project) return undefined;

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
      excludedColors: [],
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
        | 'name'
        | 'colorMap'
        | 'excludedColors'
        | 'stock'
        | 'distanceUnit'
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
    await db.put('projects', updated);
    return updated;
  }

  async function deleteProject(id: string): Promise<void> {
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
    patch: Partial<
      Pick<IdbModel, 'enabled' | 'parts' | 'partOverrides' | 'derivedCache'>
    >,
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

  async function getModelGltf(id: string): Promise<object | null> {
    const db = await getDb();
    const model = await db.get('models', id);
    return model?.gltfJson ?? null;
  }

  // Settings

  async function getSettings(): Promise<CutlistSettings> {
    const db = await getDb();
    const record = await db.get('settings', 'global-settings');
    return (
      (record as IdbSettingsRecord | undefined)?.settings ?? {
        ...DEFAULT_SETTINGS,
      }
    );
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

  // Layout cache

  async function getLayoutCache(
    projectId: string,
  ): Promise<IdbLayoutCache | undefined> {
    const db = await getDb();
    return db.get('layoutCache', projectId);
  }

  async function putLayoutCache(entry: IdbLayoutCache): Promise<void> {
    const db = await getDb();
    // JSON round-trip strips Vue reactive proxies and class instances.
    const raw = JSON.parse(JSON.stringify(entry)) as IdbLayoutCache;
    await db.put('layoutCache', raw);
  }

  async function deleteLayoutCache(projectId: string): Promise<void> {
    const db = await getDb();
    await db.delete('layoutCache', projectId);
  }

  async function getDemoSeeded(): Promise<boolean> {
    const db = await getDb();
    const record = await db.get('settings', DEMO_SEEDED_KEY);
    return (record as IdbDemoSeedRecord | undefined)?.seeded === true;
  }

  async function setDemoSeeded(seeded: boolean): Promise<void> {
    const db = await getDb();
    await db.put('settings', {
      key: DEMO_SEEDED_KEY,
      seeded,
    });
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
    getDemoSeeded,
    setDemoSeeded,
    getBuildSteps,
    createBuildStep,
    updateBuildStep,
    deleteBuildStep,
    getLayoutCache,
    putLayoutCache,
    deleteLayoutCache,
  };
}
