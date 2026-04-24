import type { DeriveResult } from './modelTypes';
import { groupPartInfos, rgbToHex, type PartInfo } from './groupPartInfos';

type Mesh = import('three').Mesh;
type Material = import('three').Material;
type MeshLambertMaterial = import('three').MeshLambertMaterial;

export interface ParseColladaResult extends DeriveResult {
  colladaXml: string;
}

/**
 * Parse a COLLADA (.dae) file exported from SketchUp and extract parts with
 * dimensions and material/color information.
 *
 * Uses the Three.js ColladaLoader which handles unit conversion, up-axis
 * correction, and transform application automatically. The loader is imported
 * dynamically to keep the initial bundle small.
 */
export async function parseCollada(file: File): Promise<ParseColladaResult> {
  const xmlText = await file.text();

  // Validate that this looks like a COLLADA file
  if (!xmlText.includes('<COLLADA')) {
    throw new Error(
      `"${file.name}" does not appear to be a COLLADA (.dae) file.`,
    );
  }

  const [THREE, { ColladaLoader }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/ColladaLoader.js'),
  ]);

  const loader = new ColladaLoader();
  const collada = loader.parse(xmlText, '');
  if (!collada?.scene) {
    throw new Error(`Failed to parse "${file.name}" as a COLLADA file.`);
  }
  const scene = collada.scene;

  // Ensure world matrices are computed so bounding boxes are accurate
  scene.updateMatrixWorld(true);

  const partInfos: PartInfo[] = [];
  let nodeIndex = 0;

  scene.traverse((obj) => {
    const currentIndex = nodeIndex++;

    // Only process Mesh objects — skip cameras, lights, line segments, etc.
    if (!(obj as Mesh).isMesh) return;
    const mesh = obj as Mesh;

    // Resolve material — pick the first non-edge, non-default material
    const material = resolveMaterial(mesh);
    if (!material) return; // edge-only mesh, skip

    // Skip edge materials
    if (isEdgeMaterial(material.name)) return;

    // Compute world-space bounding box
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3();
    box.getSize(size);

    // Sort dimensions: smallest = thickness, middle = width, largest = length
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);

    // Skip degenerate geometry (zero volume)
    if (dims[0] < 1e-8 || dims[1] < 1e-8 || dims[2] < 1e-8) return;

    const { key, rgb, hex } = resolveColor(material);
    const name = obj.name || 'Unnamed';

    partInfos.push({
      name,
      colorKey: key,
      colorHex: hex,
      rgb,
      size: { thickness: dims[0], width: dims[1], length: dims[2] },
      nodeIndex: currentIndex,
    });
  });

  if (partInfos.length === 0) {
    throw new Error('No parts with geometry found in the COLLADA file.');
  }

  // Group identical parts by stock identity + canonical dimensions
  const result = groupPartInfos(partInfos);

  return { ...result, colladaXml: xmlText };
}

// ── Material helpers ────────────────────────────────────────────────────────

function isEdgeMaterial(name: string): boolean {
  return /^edge_color/i.test(name);
}

function isDefaultMaterial(name: string): boolean {
  return /^material(_\d+)?$/i.test(name);
}

/**
 * Resolve the "best" material from a mesh. For multi-material meshes, pick
 * the first non-edge, non-default material. Falls back to the default
 * material if nothing better exists.
 */
function resolveMaterial(mesh: Mesh): Material | null {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  let fallback: Material | null = null;

  for (const mat of materials) {
    if (!mat) continue;
    if (isEdgeMaterial(mat.name)) continue;
    if (isDefaultMaterial(mat.name)) {
      if (!fallback) fallback = mat;
      continue;
    }
    return mat; // First non-edge, non-default material wins
  }

  return fallback; // Only default materials found — use as fallback
}

/**
 * Extract color information from a Three.js material. The ColladaLoader
 * typically produces MeshLambertMaterial or MeshPhongMaterial with a `color`
 * property.
 */
function resolveColor(material: Material): {
  key: string;
  rgb: [number, number, number];
  hex: string;
} {
  const name = material.name || '';

  // Try to read color from common material types
  const matWithColor = material as MeshLambertMaterial;
  if (matWithColor.color) {
    const c = matWithColor.color;
    const rgb: [number, number, number] = [c.r, c.g, c.b];
    const hex = rgbToHex(rgb);
    // Use material name as grouping key (stable, human-readable)
    const key = name && !isDefaultMaterial(name) ? name : hex;
    return { key, rgb, hex };
  }

  // Fallback for materials without a color property
  const fallbackRgb: [number, number, number] = [0.5, 0.5, 0.5];
  const key = name || 'Unknown';
  return { key, rgb: fallbackRgb, hex: rgbToHex(fallbackRgb) };
}
