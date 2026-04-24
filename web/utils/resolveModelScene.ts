import type { NodePartMapping } from './modelTypes';

type Object3D = import('three').Object3D;

export interface ResolvedNode {
  node: Object3D;
  partNumber: number;
  colorHex: string;
}

/**
 * Parse a raw model source (GLTF JSON or COLLADA XML) and resolve each
 * nodePartMap entry to a Three.js Object3D. The viewer consumes the result
 * without knowing the original format.
 */
export async function resolveModelScene(
  rawSource: object | string,
  source: 'gltf' | 'collada',
  nodePartMap: NodePartMapping[],
): Promise<ResolvedNode[]> {
  if (source === 'gltf') return resolveGltf(rawSource as object, nodePartMap);
  if (source === 'collada')
    return resolveCollada(rawSource as string, nodePartMap);
  return [];
}

// ─── GLTF ──────────────────────────────────────────────────────────────

async function resolveGltf(
  gltfJson: object,
  nodePartMap: NodePartMapping[],
): Promise<ResolvedNode[]> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  const loader = new GLTFLoader();
  const gltf = await new Promise<
    import('three/addons/loaders/GLTFLoader.js').GLTF
  >((resolve, reject) =>
    loader.parse(JSON.stringify(gltfJson), '', resolve, reject),
  );

  gltf.scene.updateMatrixWorld(true);

  const resolved: ResolvedNode[] = [];

  for (const { nodeIndex, partNumber, colorHex } of nodePartMap) {
    let node: Object3D;
    try {
      node = (await gltf.parser.getDependency('node', nodeIndex)) as Object3D;
    } catch (err) {
      if (import.meta.dev) {
        console.warn(
          `[resolveModelScene] Failed to load GLTF node ${nodeIndex}, skipping:`,
          err,
        );
      }
      continue;
    }
    if (!node) continue;

    resolved.push({ node, partNumber, colorHex });
  }

  // Dispose loaded GLTF materials (geometry is still referenced by resolved nodes)
  gltf.scene.traverse((child) => {
    const m = child as import('three').Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
  });

  return resolved;
}

// ─── COLLADA ───────────────────────────────────────────────────────────

async function resolveCollada(
  xmlText: string,
  nodePartMap: NodePartMapping[],
): Promise<ResolvedNode[]> {
  const { ColladaLoader } =
    await import('three/addons/loaders/ColladaLoader.js');

  const loader = new ColladaLoader();
  const collada = loader.parse(xmlText, '');
  if (!collada?.scene) return [];

  collada.scene.updateMatrixWorld(true);

  // Build index-to-node map using the same sequential counter as parseCollada.ts
  const indexToNode = new Map<number, Object3D>();
  let nodeIndex = 0;
  collada.scene.traverse((obj) => {
    indexToNode.set(nodeIndex++, obj);
  });

  const resolved: ResolvedNode[] = [];

  for (const { nodeIndex: idx, partNumber, colorHex } of nodePartMap) {
    const node = indexToNode.get(idx);
    if (!node) continue;
    resolved.push({ node, partNumber, colorHex });
  }

  return resolved;
}
