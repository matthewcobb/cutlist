/**
 * Tests for the applyOverrides logic used in useProjects.
 *
 * Since useProjects.ts relies on Nuxt auto-imports (ref, computed, watch)
 * at module scope, we can't import it directly in Bun tests. Instead, we
 * copy the pure function's logic here and test the contract.
 *
 * This ensures the override application pattern works correctly regardless
 * of how the composable initializes.
 */
import { describe, expect, it } from 'vitest';
import type { PartToCut } from 'cutlist';

type Part = Omit<PartToCut, 'material'> & { colorKey: string };

interface PartOverride {
  grainLock?: 'length' | 'width';
  name?: string;
}

/**
 * Mirror of the applyOverrides function from useProjects.ts.
 * Kept in sync via the integration tests that exercise the full IDB flow.
 */
function applyOverrides(
  parts: Part[],
  overrides: Record<number, PartOverride>,
): Part[] {
  if (Object.keys(overrides).length === 0) return parts;
  return parts.map((p) => {
    const o = overrides[p.partNumber];
    return o ? { ...p, ...o } : p;
  });
}

function makePart(partNumber: number, overrides?: Partial<Part>): Part {
  return {
    partNumber,
    instanceNumber: 1,
    name: `Part ${partNumber}`,
    colorKey: '#aaa',
    size: { width: 0.3, length: 0.5, thickness: 0.018 },
    ...overrides,
  };
}

describe('applyOverrides', () => {
  it('returns the same array when no overrides exist', () => {
    const parts = [makePart(1), makePart(2)];
    const result = applyOverrides(parts, {});
    expect(result).toBe(parts); // identity — not a copy
  });

  it('applies grainLock override to matching part', () => {
    const parts = [makePart(1), makePart(2)];
    const result = applyOverrides(parts, {
      1: { grainLock: 'length' },
    });
    expect(result[0].grainLock).toBe('length');
    expect(result[1].grainLock).toBeUndefined();
  });

  it('applies name override to matching part', () => {
    const parts = [makePart(1, { name: 'Original' })];
    const result = applyOverrides(parts, {
      1: { name: 'Custom Name' },
    });
    expect(result[0].name).toBe('Custom Name');
  });

  it('applies multiple overrides to different parts', () => {
    const parts = [makePart(1), makePart(2), makePart(3)];
    const result = applyOverrides(parts, {
      1: { grainLock: 'width' },
      3: { name: 'Renamed' },
    });
    expect(result[0].grainLock).toBe('width');
    expect(result[1]).toEqual(parts[1]); // untouched
    expect(result[2].name).toBe('Renamed');
  });

  it('does not mutate original parts', () => {
    const parts = [makePart(1)];
    const original = { ...parts[0] };
    applyOverrides(parts, { 1: { grainLock: 'length' } });
    expect(parts[0]).toEqual(original);
  });

  it('ignores overrides for non-existent partNumbers', () => {
    const parts = [makePart(1)];
    const result = applyOverrides(parts, {
      99: { grainLock: 'width' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].grainLock).toBeUndefined();
  });

  it('applies overrides to all instances of the same partNumber', () => {
    const parts = [
      makePart(1, { instanceNumber: 1 }),
      makePart(1, { instanceNumber: 2 }),
      makePart(1, { instanceNumber: 3 }),
    ];
    const result = applyOverrides(parts, {
      1: { grainLock: 'length' },
    });
    for (const p of result) {
      expect(p.grainLock).toBe('length');
    }
  });

  it('handles empty parts array', () => {
    const result = applyOverrides([], { 1: { grainLock: 'width' } });
    expect(result).toHaveLength(0);
  });

  it('merges both name and grainLock overrides onto same part', () => {
    const parts = [makePart(1, { name: 'Original' })];
    const result = applyOverrides(parts, {
      1: { grainLock: 'width', name: 'Override' },
    });
    expect(result[0].grainLock).toBe('width');
    expect(result[0].name).toBe('Override');
    // Other fields preserved
    expect(result[0].colorKey).toBe('#aaa');
    expect(result[0].size.thickness).toBe(0.018);
  });
});
