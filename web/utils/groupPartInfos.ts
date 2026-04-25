/**
 * Shared grouping logic for parsed model parts (GLTF and COLLADA).
 *
 * Both parsers extract a flat list of PartInfo entries from their
 * respective scene graphs, then run the same grouping step to
 * deduplicate identical parts and produce the DeriveResult consumed
 * by the rest of the app.
 */

import type {
  Part,
  ColorInfo,
  NodePartMapping,
  DeriveResult,
} from './modelTypes';

export interface PartInfo {
  name: string;
  colorKey: string;
  colorHex: string;
  rgb: [number, number, number];
  size: { thickness: number; width: number; length: number };
  nodeIndex: number;
}

/** Coarser tolerance for grouping — parts within 0.1mm are the same cut. */
const GROUP_PRECISION = 1e-4;

/**
 * Group raw part infos by stock identity + canonical dimensions.
 * Produces deduplicated Part[], NodePartMapping[], and ColorInfo[].
 */
export function groupPartInfos(partInfos: PartInfo[]): DeriveResult {
  const roundGroup = (n: number) =>
    Math.round(n / GROUP_PRECISION) * GROUP_PRECISION;
  const groups = new Map<
    string,
    PartInfo & { quantity: number; nodeIndices: number[] }
  >();

  for (const info of partInfos) {
    const canonicalWidth = Math.min(info.size.width, info.size.length);
    const canonicalLength = Math.max(info.size.width, info.size.length);
    const key = [
      info.colorKey,
      roundGroup(info.size.thickness),
      roundGroup(canonicalWidth),
      roundGroup(canonicalLength),
    ].join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.nodeIndices.push(info.nodeIndex);
    } else {
      groups.set(key, {
        ...info,
        size: {
          thickness: info.size.thickness,
          width: canonicalWidth,
          length: canonicalLength,
        },
        quantity: 1,
        nodeIndices: [info.nodeIndex],
      });
    }
  }

  const parts: Part[] = [];
  const nodePartMap: NodePartMapping[] = [];
  let partNumber = 0;

  for (const group of groups.values()) {
    partNumber += 1;
    for (let i = 0; i < group.quantity; i += 1) {
      parts.push({
        partNumber,
        instanceNumber: i + 1,
        name: group.name,
        colorKey: group.colorKey,
        size: group.size,
      });
    }
    for (const nodeIndex of group.nodeIndices) {
      nodePartMap.push({ nodeIndex, partNumber, colorHex: group.colorHex });
    }
  }

  // Tally colors across all parts.
  const colorMap = new Map<
    string,
    { rgb: [number, number, number]; count: number }
  >();
  for (const group of groups.values()) {
    const existing = colorMap.get(group.colorKey);
    if (existing) {
      existing.count += group.quantity;
    } else {
      colorMap.set(group.colorKey, { rgb: group.rgb, count: group.quantity });
    }
  }
  const colors: ColorInfo[] = Array.from(colorMap.entries()).map(
    ([key, { rgb, count }]) => ({ key, rgb, count }),
  );

  return { parts, colors, nodePartMap };
}

export function rgbToHex(rgb: [number, number, number]): string {
  const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const r = clamp(rgb[0]);
  const g = clamp(rgb[1]);
  const b = clamp(rgb[2]);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
