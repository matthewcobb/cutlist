import type { DeriveResult } from '~/utils/parseGltf';
import type {
  BoardLayout,
  BoardLayoutLeftover,
  ConfigInput,
  PartToCut,
} from 'cutlist';

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

// ─── Singleton worker instance ───────────────────────────────────────────────

let worker: Worker | null = null;
let nextId = 0;

// Pending callbacks keyed by request id
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

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/computation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'derive') {
        const pending = pendingDerive.get(msg.id);
        if (pending) {
          pendingDerive.delete(msg.id);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.result!);
        }
      } else if (msg.type === 'layout') {
        const pending = pendingLayout.get(msg.id);
        if (pending) {
          pendingLayout.delete(msg.id);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.result!);
        }
      }
    };
    worker.onerror = (e) => {
      console.error('Computation worker error:', e);
      // Reject all pending requests
      for (const [, p] of pendingDerive) p.reject(new Error('Worker error'));
      for (const [, p] of pendingLayout) p.reject(new Error('Worker error'));
      pendingDerive.clear();
      pendingLayout.clear();
      // Recreate on next use
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function deriveModel(gltfJson: object): Promise<DeriveResult> {
  const id = ++nextId;
  const w = getWorker();
  // Structured clone cannot handle Vue reactive proxies — strip them.
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
 */
export function computeLayouts(
  parts: PartToCut[],
  stockYaml: string,
  config: ConfigInput,
): Promise<{ layouts: BoardLayout[]; leftovers: BoardLayoutLeftover[] }> {
  const id = ++nextId;
  const w = getWorker();
  // Structured clone cannot handle Vue reactive proxies or class instances —
  // round-trip through JSON to get plain objects.
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
