/**
 * IndexedDB persistence layer for Cutlist.
 *
 * All app data lives in IndexedDB. This module owns the schema, provides
 * CRUD operations, and applies defensive defaults on reads so that records
 * missing fields added by later migrations still work at runtime.
 *
 * Error handling:
 * - QuotaExceededError is caught on writes and surfaced via `useIdbErrors()`.
 * - Multi-tab coordination: a BroadcastChannel notifies other tabs when data
 *   changes, so they can reload. Last-write-wins semantics.
 * - FutureSchemaError (from migrations.ts) is surfaced to the user on startup.
 *
 * Contract:
 * - `getDb()` is the singleton entry point. It opens the database, runs the
 *   startup migration sweep, and returns the idb handle.
 * - All public functions go through `getDb()` and handle IDB errors.
 */

import { ref, readonly } from 'vue';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import type { ColorInfo, NodePartMapping, Part } from '~/utils/parseGltf';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STOCK_YAML,
  type CutlistSettings,
} from '~/utils/settings';
import { runStartupSweep, LAYOUT_CACHE_VERSION } from '~/utils/migrations';

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
 *
 * The `cacheVersion` field records which LAYOUT_CACHE_VERSION produced this
 * entry. On read, entries with a mismatched version are treated as cache misses.
 */
export interface IdbLayoutCache {
  projectId: string;
  fingerprint: string;
  /** The LAYOUT_CACHE_VERSION that produced this cache entry. */
  cacheVersion: number;
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

// ─── IDB error handling ─────────────────────────────────────────────────────

/**
 * Reactive error state for IDB operations. Surfaced to the UI layer
 * so users see a toast/banner when storage is full or unavailable.
 */
const idbError = ref<string | null>(null);

/** Composable to read the current IDB error state in components. */
export function useIdbErrors() {
  return {
    /** Current error message, or null if everything is fine. */
    error: readonly(idbError),
    /** Clear the error (e.g. when user dismisses a toast). */
    dismiss: () => {
      idbError.value = null;
    },
  };
}

function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof DOMException) {
    // Chromium, Safari, Firefox all use slightly different names/codes.
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 || // legacy code
      err.name === ('NS_ERROR_DOM_QUOTA_REACHED' as string)
    );
  }
  return false;
}

/**
 * Wrap an IDB write operation with quota error handling.
 * On QuotaExceededError, sets the reactive error state so the UI can react.
 */
async function safeWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isQuotaExceeded(err)) {
      idbError.value =
        'Storage is full. Delete unused projects or clear browser data to free space.';
    }
    throw err;
  }
}

// ─── Multi-tab coordination ─────────────────────────────────────────────────

/**
 * BroadcastChannel for notifying other tabs of data changes.
 * Receiving tabs should reload project data when they get a message.
 */
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel('cutlist-idb');
  }
  return channel;
}

function notifyOtherTabs(event: string) {
  try {
    getChannel()?.postMessage({ event, timestamp: Date.now() });
  } catch {
    // BroadcastChannel may not be supported or may have been closed.
  }
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
        const message =
          err?.name === 'FutureSchemaError'
            ? err.message
            : `Browser storage unavailable (private browsing may prevent saving projects): ${err.message}`;
        idbError.value = message;
        throw new Error(message);
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
    await safeWrite(() =>
      db.put('projects', {
        ...existing,
        archivedAt: new Date().toISOString(),
      }),
    );
    notifyOtherTabs('project-updated');
  }

  async function unarchiveProject(id: string): Promise<void> {
    const db = await getDb();
    const existing = await db.get('projects', id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const { archivedAt: _, ...rest } = existing;
    await safeWrite(() => db.put('projects', rest));
    notifyOtherTabs('project-updated');
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
    await safeWrite(() => db.put('projects', project));
    notifyOtherTabs('project-created');
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
    await safeWrite(() => db.put('projects', updated));
    notifyOtherTabs('project-updated');
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
    notifyOtherTabs('project-deleted');
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
    await safeWrite(() => db.put('buildSteps', step));
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
    await safeWrite(() => db.put('buildSteps', { ...existing, ...patch }));
  }

  async function deleteBuildStep(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('buildSteps', id);
  }

  // Models

  async function createModel(model: IdbModel): Promise<void> {
    const db = await getDb();
    await safeWrite(() => db.put('models', model));
    notifyOtherTabs('model-created');
  }

  // ── Debounced model writes ─────────────────────────────────────────────────
  // Rapid override toggles (grain lock cycling) can cause write amplification.
  // We coalesce writes per model ID: patches accumulate in a pending map and
  // flush after a short delay. This turns N rapid clicks into 1 IDB write.

  const pendingModelPatches = new Map<
    string,
    {
      patch: Partial<
        Pick<IdbModel, 'enabled' | 'parts' | 'partOverrides' | 'derivedCache'>
      >;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  const MODEL_WRITE_DEBOUNCE_MS = 150;

  async function flushModelWrite(id: string): Promise<void> {
    const entry = pendingModelPatches.get(id);
    if (!entry) return;
    pendingModelPatches.delete(id);
    clearTimeout(entry.timer);

    const db = await getDb();
    const existing = await db.get('models', id);
    if (!existing) throw new Error(`Model ${id} not found`);
    const rawPatch = JSON.parse(JSON.stringify(entry.patch));
    await safeWrite(() => db.put('models', { ...existing, ...rawPatch }));
  }

  async function updateModel(
    id: string,
    patch: Partial<
      Pick<IdbModel, 'enabled' | 'parts' | 'partOverrides' | 'derivedCache'>
    >,
  ): Promise<void> {
    // For bulk writes (parts, derivedCache) skip debouncing — these are
    // infrequent and callers expect immediate persistence.
    if (patch.parts != null || patch.derivedCache != null) {
      const db = await getDb();
      const existing = await db.get('models', id);
      if (!existing) throw new Error(`Model ${id} not found`);
      const rawPatch = JSON.parse(JSON.stringify(patch));
      await safeWrite(() => db.put('models', { ...existing, ...rawPatch }));
      return;
    }

    // Lightweight patches (partOverrides, enabled) are debounced.
    const existing = pendingModelPatches.get(id);
    const merged = existing ? { ...existing.patch, ...patch } : { ...patch };

    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(
      () => flushModelWrite(id),
      MODEL_WRITE_DEBOUNCE_MS,
    );
    pendingModelPatches.set(id, { patch: merged, timer });
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
    await safeWrite(() =>
      db.put('settings', { key: 'global-settings', settings: updated }),
    );
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
    const entry = await db.get('layoutCache', projectId);
    if (!entry) return undefined;
    // Reject entries from a different cache version — treat as miss.
    if (entry.cacheVersion !== LAYOUT_CACHE_VERSION) return undefined;
    return entry;
  }

  async function putLayoutCache(entry: IdbLayoutCache): Promise<void> {
    const db = await getDb();
    // JSON round-trip strips Vue reactive proxies and class instances.
    const raw = JSON.parse(JSON.stringify(entry)) as IdbLayoutCache;
    await safeWrite(() => db.put('layoutCache', raw)).catch(() => {
      // Layout cache writes are advisory — swallow errors silently.
      // The layout will simply be recomputed on next load.
    });
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
