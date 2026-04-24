import type { DeriveResult } from './modelTypes';
import { groupPartInfos, rgbToHex, type PartInfo } from './groupPartInfos';

interface GltfAccessor {
  min?: number[];
  max?: number[];
  componentType: number;
  count: number;
  type: string;
}

interface GltfPrimitive {
  attributes: { POSITION?: number; [k: string]: number | undefined };
  material?: number;
}

interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
}

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
}

interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: { baseColorFactor?: [number, number, number, number] };
}

interface Gltf {
  scene?: number;
  scenes?: { nodes: number[] }[];
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  materials?: GltfMaterial[];
  accessors?: GltfAccessor[];
}

interface ParseResult extends DeriveResult {
  gltfJson: object;
}

/** Derive parts, colors, and node mapping from a raw GLTF JSON object. */
export function deriveFromGltf(gltfJson: object): DeriveResult {
  const gltf = gltfJson as Gltf;

  if (!gltf.nodes || !gltf.meshes || !gltf.accessors) {
    throw new Error(
      'GLTF file is missing required nodes/meshes/accessors. Binary .glb files are not supported — export as .gltf.',
    );
  }

  const sceneIdx = gltf.scene ?? 0;
  const rootNodeIndices = gltf.scenes?.[sceneIdx]?.nodes ?? [];
  const partInfos: PartInfo[] = [];

  for (const idx of rootNodeIndices) {
    walkNode(idx, IDENTITY, gltf, partInfos);
  }

  if (partInfos.length === 0) {
    throw new Error('No parts with geometry found in the GLTF file.');
  }

  return groupPartInfos(partInfos);
}

export async function parseGltf(file: File): Promise<ParseResult> {
  const text = await file.text();
  let gltf: object;
  try {
    gltf = JSON.parse(text);
  } catch (err) {
    throw new Error(`Could not parse "${file.name}" as JSON GLTF: ${err}`);
  }
  const derived = deriveFromGltf(gltf);
  return { ...derived, gltfJson: gltf };
}

function walkNode(
  idx: number,
  parentMatrix: Mat4,
  gltf: Gltf,
  out: PartInfo[],
): void {
  const node = gltf.nodes![idx];
  if (!node) return;
  const localMatrix = nodeMatrix(node);
  const worldMatrix = multiply(parentMatrix, localMatrix);

  if (node.mesh != null) {
    const mesh = gltf.meshes![node.mesh];
    const info = meshToPartInfo(idx, node, mesh, worldMatrix, gltf);
    if (info) out.push(info);
  }

  for (const childIdx of node.children ?? []) {
    walkNode(childIdx, worldMatrix, gltf, out);
  }
}

function meshToPartInfo(
  nodeIndex: number,
  node: GltfNode,
  mesh: GltfMesh,
  worldMatrix: Mat4,
  gltf: Gltf,
): PartInfo | null {
  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let firstMaterialIdx: number | undefined;

  for (const prim of mesh.primitives) {
    const posIdx = prim.attributes.POSITION;
    if (posIdx == null) continue;
    const acc = gltf.accessors![posIdx];
    if (!acc?.min || !acc?.max) continue;

    // Transform the 8 corners of the primitive's local AABB by the world
    // matrix and recompute the AABB in world space.
    for (let i = 0; i < 8; i += 1) {
      const p: [number, number, number] = [
        i & 1 ? acc.max[0] : acc.min[0],
        i & 2 ? acc.max[1] : acc.min[1],
        i & 4 ? acc.max[2] : acc.min[2],
      ];
      const w = transformPoint(worldMatrix, p);
      for (let a = 0; a < 3; a += 1) {
        if (w[a] < min[a]) min[a] = w[a];
        if (w[a] > max[a]) max[a] = w[a];
      }
    }

    if (firstMaterialIdx == null && prim.material != null) {
      firstMaterialIdx = prim.material;
    }
  }

  if (!isFinite(min[0])) return null;

  // Smallest axis = thickness, remaining sorted = width < length.
  const dims = [max[0] - min[0], max[1] - min[1], max[2] - min[2]].sort(
    (a, b) => a - b,
  );

  const matName =
    firstMaterialIdx != null
      ? (gltf.materials?.[firstMaterialIdx]?.name ?? '')
      : '';
  const { key, rgb, hex } = resolveColor(
    matName,
    firstMaterialIdx,
    gltf.materials,
  );

  return {
    name: node.name ?? mesh.name ?? 'Unnamed',
    colorKey: key,
    colorHex: hex,
    rgb,
    size: { thickness: dims[0], width: dims[1], length: dims[2] },
    nodeIndex,
  };
}

function resolveColor(
  name: string,
  materialIdx: number | undefined,
  materials: GltfMaterial[] | undefined,
): { key: string; rgb: [number, number, number]; hex: string } {
  // Onshape encodes appearance as "R_G_B_X_Y" (normalized RGB floats in name).
  // Detect: 3+ underscore-separated finite numbers.
  const parts = name.split('_').map(Number);
  if (parts.length >= 3 && parts.slice(0, 3).every((n) => isFinite(n))) {
    const rgb: [number, number, number] = [parts[0], parts[1], parts[2]];
    const hex = rgbToHex(rgb);
    return { key: hex, rgb, hex };
  }

  // Standard GLTF: read PBR base color from the material at materialIdx.
  const mat = materialIdx != null ? materials?.[materialIdx] : undefined;
  const c = mat?.pbrMetallicRoughness?.baseColorFactor;
  if (c) {
    const rgb: [number, number, number] = [c[0], c[1], c[2]];
    // Use the material name as the grouping key (stable, human-readable).
    // Fall back to hex if name is empty.
    const key = name || rgbToHex(rgb);
    return { key, rgb, hex: rgbToHex(rgb) };
  }

  const fallbackRgb: [number, number, number] = [0.5, 0.5, 0.5];
  const key = name || 'Unknown';
  return { key, rgb: fallbackRgb, hex: rgbToHex(fallbackRgb) };
}

// --- Minimal 4x4 column-major matrix helpers (matching GLTF spec) ---

type Mat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]; // column-major

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function nodeMatrix(node: GltfNode): Mat4 {
  if (node.matrix && node.matrix.length === 16)
    return node.matrix.slice() as Mat4;
  if (!node.translation && !node.rotation && !node.scale) return IDENTITY;
  const t = node.translation ?? [0, 0, 0];
  const r = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  return composeTRS(t, r, s);
}

function composeTRS(
  t: [number, number, number],
  r: [number, number, number, number],
  s: [number, number, number],
): Mat4 {
  const [x, y, z, w] = r;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row]! * b[col * 4 + k]!;
      }
      out[col * 4 + row] = sum;
    }
  }
  return out as Mat4;
}

function transformPoint(
  m: Mat4,
  p: [number, number, number],
): [number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
