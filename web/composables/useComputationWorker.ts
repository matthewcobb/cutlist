import type {
  BoardLayout,
  BoardLayoutLeftover,
  ConfigInput,
  PartToCut,
} from 'cutlist';
import { reportError } from './useAppErrors';

interface LayoutRequest {
  type: 'layout';
  id: number;
  parts: PartToCut[];
  stockYaml: string;
  config: ConfigInput;
}

interface LayoutResponse {
  type: 'layout';
  id: number;
  result?: { layouts: BoardLayout[]; leftovers: BoardLayoutLeftover[] };
  error?: string;
}

interface PendingRequest {
  projectId: string;
  resolve: (r: {
    layouts: BoardLayout[];
    leftovers: BoardLayoutLeftover[];
  }) => void;
  reject: (e: Error) => void;
}

// Requests are tagged with projectId and processed FIFO by a single worker.
// Switching projects never cancels in-flight work. Within a single project,
// older promises still resolve, but `computingProjects` only clears once the
// latest request for that project lands.

let layoutWorker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, PendingRequest>();
const latestByProject = new Map<string, number>();

/** Reactive set of projectIds with a layout computation in flight. */
export const computingProjects = shallowRef(new Set<string>());

function setComputing(projectId: string, on: boolean): void {
  const has = computingProjects.value.has(projectId);
  if (on === has) return;
  const next = new Set(computingProjects.value);
  if (on) next.add(projectId);
  else next.delete(projectId);
  computingProjects.value = next;
}

function resetAll(rejectPending: Error | null): void {
  if (rejectPending) {
    for (const [, req] of pending) req.reject(rejectPending);
  }
  pending.clear();
  latestByProject.clear();
  if (computingProjects.value.size > 0) {
    computingProjects.value = new Set();
  }
}

function spawnWorker(): Worker {
  const w = new Worker(
    new URL('../workers/computation.worker.ts', import.meta.url),
    { type: 'module' },
  );
  w.onmessage = (e: MessageEvent<LayoutResponse>) => {
    const msg = e.data;
    if (msg.type !== 'layout') return;
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    if (latestByProject.get(req.projectId) === msg.id) {
      latestByProject.delete(req.projectId);
      setComputing(req.projectId, false);
    }
    if (msg.error) req.reject(new Error(msg.error));
    else req.resolve(msg.result!);
  };
  w.onerror = (e) => {
    console.error('Layout worker error:', e);
    reportError({
      title: 'Layout computation failed',
      description:
        'The background worker crashed while computing layouts. Try reloading the page.',
      severity: 'error',
    });
    w.terminate();
    if (layoutWorker === w) layoutWorker = null;
    resetAll(new Error('Worker error'));
  };
  return w;
}

function getLayoutWorker(): Worker {
  if (!layoutWorker) layoutWorker = spawnWorker();
  return layoutWorker;
}

function terminateWorker(): void {
  if (layoutWorker) {
    layoutWorker.terminate();
    layoutWorker = null;
  }
  const err = new Error('Page unloading');
  err.name = 'AbortError';
  resetAll(err);
}

if (typeof window !== 'undefined' && !(window as any).__cutlistWorkersInit) {
  (window as any).__cutlistWorkersInit = true;
  window.addEventListener('beforeunload', terminateWorker);
  // pagehide with `persisted` covers bfcache; visibilitychange was too eager.
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) terminateWorker();
  });
}

// Profiling: 500 parts ≈ 24ms, 1000 ≈ 59ms per pass. 10k+ is slow but usable.
export const PART_COUNT_SOFT_LIMIT = 2000;
/** Above this the packer hangs the worker, so we refuse outright. */
export const PART_COUNT_HARD_LIMIT = 50_000;

export class PartCountExceededError extends Error {
  constructor(count: number) {
    super(
      `Too many parts (${count}). The maximum is ${PART_COUNT_HARD_LIMIT}. ` +
        `Split your project into smaller groups or reduce part count.`,
    );
    this.name = 'PartCountExceededError';
  }
}

/**
 * Queue a layout computation for `projectId`. Throws `PartCountExceededError`
 * synchronously if `parts` exceeds the hard limit.
 */
export function computeLayouts(
  projectId: string,
  parts: PartToCut[],
  stockYaml: string,
  config: ConfigInput,
): Promise<{ layouts: BoardLayout[]; leftovers: BoardLayoutLeftover[] }> {
  if (parts.length > PART_COUNT_HARD_LIMIT) {
    return Promise.reject(new PartCountExceededError(parts.length));
  }

  const id = ++nextId;
  const w = getLayoutWorker();
  // Worker postMessage uses structured clone; strip Vue reactivity first.
  const plainParts = JSON.parse(JSON.stringify(parts));
  const plainConfig = JSON.parse(JSON.stringify(config));
  latestByProject.set(projectId, id);
  setComputing(projectId, true);
  return new Promise((resolve, reject) => {
    pending.set(id, { projectId, resolve, reject });
    w.postMessage({
      type: 'layout',
      id,
      parts: plainParts,
      stockYaml,
      config: plainConfig,
    } satisfies LayoutRequest);
  });
}

/** Test-only: reset module state between tests. */
export function __resetForTests(): void {
  if (layoutWorker) {
    layoutWorker.terminate();
    layoutWorker = null;
  }
  resetAll(null);
  nextId = 0;
}
