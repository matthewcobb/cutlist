import type { DeriveResult } from '~/utils/parseGltf';
import type {
  BoardLayout,
  BoardLayoutLeftover,
  ConfigInput,
  PartToCut,
} from 'cutlist';
import { reportError } from './useAppErrors';

// ─── Types matching the worker messages ──────────────────────────────────────

interface DeriveRequest {
  type: 'derive';
  id: number;
  gltfJson: object;
}

interface LayoutRequest {
  type: 'layout';
  id: number;
  parts: PartToCut[];
  stockYaml: string;
  config: ConfigInput;
}

interface DeriveResponse {
  type: 'derive';
  id: number;
  result?: DeriveResult;
  error?: string;
}

interface LayoutResponse {
  type: 'layout';
  id: number;
  result?: { layouts: BoardLayout[]; leftovers: BoardLayoutLeftover[] };
  error?: string;
}

type WorkerResponse = DeriveResponse | LayoutResponse;

// ─── Two dedicated workers ───────────────────────────────────────────────────
// Layout work is long-running and cancellable via terminate+respawn; derive
// work is short and runs on its own worker so cancelling layouts doesn't kill
// in-flight hydration.

let deriveWorker: Worker | null = null;
let layoutWorker: Worker | null = null;
let nextId = 0;

const pendingDerive = new Map<
  number,
  { resolve: (r: DeriveResult) => void; reject: (e: Error) => void }
>();
const pendingLayout = new Map<
  number,
  {
    resolve: (r: {
      layouts: BoardLayout[];
      leftovers: BoardLayoutLeftover[];
    }) => void;
    reject: (e: Error) => void;
  }
>();

function spawnWorker(): Worker {
  return new Worker(
    new URL('../workers/computation.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

function getDeriveWorker(): Worker {
  if (deriveWorker) return deriveWorker;
  const w = spawnWorker();
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    if (msg.type !== 'derive') return;
    const pending = pendingDerive.get(msg.id);
    if (!pending) return;
    pendingDerive.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error));
    else pending.resolve(msg.result!);
  };
  w.onerror = (e) => {
    console.error('Derive worker error:', e);
    reportError({
      title: 'Model processing failed',
      description:
        'The background worker crashed while processing a model. Try reloading the page.',
      severity: 'error',
    });
    for (const [, p] of pendingDerive) p.reject(new Error('Worker error'));
    pendingDerive.clear();
    deriveWorker?.terminate();
    deriveWorker = null;
  };
  deriveWorker = w;
  return w;
}

function getLayoutWorker(): Worker {
  if (layoutWorker) return layoutWorker;
  const w = spawnWorker();
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    if (msg.type !== 'layout') return;
    const pending = pendingLayout.get(msg.id);
    if (!pending) return;
    pendingLayout.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error));
    else pending.resolve(msg.result!);
  };
  w.onerror = (e) => {
    console.error('Layout worker error:', e);
    reportError({
      title: 'Layout computation failed',
      description:
        'The background worker crashed while computing layouts. Try reloading the page.',
      severity: 'error',
    });
    for (const [, p] of pendingLayout) p.reject(new Error('Worker error'));
    pendingLayout.clear();
    layoutWorker?.terminate();
    layoutWorker = null;
  };
  layoutWorker = w;
  return w;
}

// ─── Lifecycle cleanup ──────────────────────────────────────────────────────
// Terminate workers on page unload to prevent leaked threads and pending
// promises that can never resolve. Also cleans up on visibilitychange to
// 'hidden' (covers bfcache, mobile tab switches).

function terminateAllWorkers() {
  if (layoutWorker) {
    layoutWorker.terminate();
    layoutWorker = null;
  }
  if (deriveWorker) {
    deriveWorker.terminate();
    deriveWorker = null;
  }
  // Reject all pending promises so callers aren't left hanging
  const err = new Error('Page unloading');
  err.name = 'AbortError';
  for (const [, p] of pendingLayout) p.reject(err);
  pendingLayout.clear();
  for (const [, p] of pendingDerive) p.reject(err);
  pendingDerive.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', terminateAllWorkers);
  // visibilitychange to 'hidden' fires reliably on mobile/tab close
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      terminateAllWorkers();
    }
  });
}

// ─── Part count guardrails ───────────────────────────────────────────────────
// Profiling: 500 parts ≈ 24ms, 1000 ≈ 59ms per pass. At 10k+ parts the worker
// may take a few seconds but remains usable. Only warn, don't block.

/** Part count at which the UI should show a non-blocking performance warning. */
export const PART_COUNT_SOFT_LIMIT = 2000;

/** Part count above which we refuse to run the packer (would hang the worker). */
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

// ─── Public API ──────────────────────────────────────────────────────────────

export function deriveModel(gltfJson: object): Promise<DeriveResult> {
  const id = ++nextId;
  const w = getDeriveWorker();
  const plain = JSON.parse(JSON.stringify(gltfJson));
  return new Promise<DeriveResult>((resolve, reject) => {
    pendingDerive.set(id, { resolve, reject });
    w.postMessage({
      type: 'derive',
      id,
      gltfJson: plain,
    } satisfies DeriveRequest);
  });
}

/**
 * Post a layout computation request. Returns a promise that resolves with the
 * result. Callers should track their own request versioning to discard stale
 * results (e.g. when inputs change before the previous result arrives).
 *
 * Throws `PartCountExceededError` synchronously if the part count exceeds
 * the hard limit — the worker is never started.
 */
export function computeLayouts(
  parts: PartToCut[],
  stockYaml: string,
  config: ConfigInput,
): Promise<{ layouts: BoardLayout[]; leftovers: BoardLayoutLeftover[] }> {
  if (parts.length > PART_COUNT_HARD_LIMIT) {
    return Promise.reject(new PartCountExceededError(parts.length));
  }

  const id = ++nextId;
  const w = getLayoutWorker();
  const plainParts = JSON.parse(JSON.stringify(parts));
  const plainConfig = JSON.parse(JSON.stringify(config));
  return new Promise((resolve, reject) => {
    pendingLayout.set(id, { resolve, reject });
    w.postMessage({
      type: 'layout',
      id,
      parts: plainParts,
      stockYaml,
      config: plainConfig,
    } satisfies LayoutRequest);
  });
}

/**
 * Terminate the layout worker, cancelling any in-flight or queued layout job.
 * Pending promises reject with an AbortError; callers that guard on their own
 * requestVersion will silently drop the rejection. A fresh worker is spawned
 * lazily on the next `computeLayouts` call.
 */
export function cancelLayouts(): void {
  if (!layoutWorker) return;
  layoutWorker.terminate();
  layoutWorker = null;
  const err = new Error('Cancelled');
  err.name = 'AbortError';
  for (const [, p] of pendingLayout) p.reject(err);
  pendingLayout.clear();
}
