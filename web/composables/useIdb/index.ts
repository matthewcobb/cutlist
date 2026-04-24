/**
 * IndexedDB persistence layer for Cutlist.
 *
 * All app data lives in IndexedDB. This directory owns the schema, provides
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
 * - `getDb()` (in `./db`) is the singleton entry point. It opens the database,
 *   runs the startup migration sweep, and returns the idb handle.
 * - All public functions go through `getDb()` and handle IDB errors.
 *
 * The implementation is split across per-concern modules; this file
 * re-exports the combined API as a single `useIdb()` composable plus the
 * public named exports (`useIdbErrors`, the `apply*Defaults` helpers, and
 * the type surface).
 */

import {
  getProjectList,
  getArchivedList,
  getProjectWithModels,
  createProject,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
} from './projects';
import {
  createModel,
  updateModel,
  deleteModel,
  getModelGltf,
  flushPendingModelWrites,
} from './models';
import {
  getBuildSteps,
  createBuildStep,
  updateBuildStep,
  deleteBuildStep,
} from './buildSteps';
import {
  getLayoutCache,
  putLayoutCache,
  deleteLayoutCache,
} from './layoutCache';
import { getDemoSeeded, setDemoSeeded } from './demoSeed';

export { useIdbErrors } from './db';
export { applyProjectDefaults, applyModelDefaults } from './defaults';
export type {
  IdbProject,
  PartOverride,
  DerivedCache,
  IdbModel,
  IdbModelMeta,
  IdbLayoutCache,
  IdbBuildStep,
} from './types';

export function useIdb() {
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
    getDemoSeeded,
    setDemoSeeded,
    getBuildSteps,
    createBuildStep,
    updateBuildStep,
    deleteBuildStep,
    getLayoutCache,
    putLayoutCache,
    deleteLayoutCache,
    flushPendingModelWrites,
  };
}
