import { deriveFromGltf, type DeriveResult } from '../utils/parseGltf';
import { generateBoardLayouts, type ConfigInput, type PartToCut } from '../lib';
import { parseStock } from '../utils/parseStock';

// ─── Message types ───────────────────────────────────────────────────────────

interface DeriveRequest {
  type: 'derive';
  id: number;
  gltfJson: object;
}

interface DeriveResponse {
  type: 'derive';
  id: number;
  result?: DeriveResult;
  error?: string;
}

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
  result?: ReturnType<typeof generateBoardLayouts>;
  error?: string;
}

type WorkerRequest = DeriveRequest | LayoutRequest;
type WorkerResponse = DeriveResponse | LayoutResponse;

// ─── Handler ─────────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'derive') {
    try {
      const result = deriveFromGltf(msg.gltfJson);
      post({ type: 'derive', id: msg.id, result });
    } catch (err) {
      post({ type: 'derive', id: msg.id, error: String(err) });
    }
    return;
  }

  if (msg.type === 'layout') {
    try {
      const stock = parseStock(msg.stockYaml);
      const result = generateBoardLayouts(msg.parts, stock, msg.config);
      post({ type: 'layout', id: msg.id, result });
    } catch (err) {
      post({ type: 'layout', id: msg.id, error: String(err) });
    }
    return;
  }
};

function post(msg: WorkerResponse) {
  (self as unknown as Worker).postMessage(msg);
}
