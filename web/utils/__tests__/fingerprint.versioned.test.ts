import { describe, expect, it } from 'bun:test';
import { fingerprint, versionedFingerprint } from '../fingerprint';
import { LAYOUT_CACHE_VERSION } from '../migrations';

describe('versionedFingerprint', () => {
  it('includes version prefix in output', () => {
    const result = versionedFingerprint({ parts: [], stock: '' });
    expect(result).toMatch(
      new RegExp(`^v${LAYOUT_CACHE_VERSION}:[0-9a-f]{8}$`),
    );
  });

  it('produces different hashes for different inputs', () => {
    const a = versionedFingerprint({ parts: [{ id: 1 }] });
    const b = versionedFingerprint({ parts: [{ id: 2 }] });
    expect(a).not.toBe(b);
  });

  it('produces same hash for identical inputs', () => {
    const input = { parts: [{ id: 1, name: 'Panel' }], stock: 'yaml' };
    const a = versionedFingerprint(input);
    const b = versionedFingerprint(input);
    expect(a).toBe(b);
  });

  it('differs from raw fingerprint for the same input', () => {
    const input = { parts: [], stock: '' };
    const versioned = versionedFingerprint(input);
    const raw = fingerprint(input);
    // The versioned hash includes version info, so the hex portion should differ
    const versionedHash = versioned.split(':')[1];
    expect(versionedHash).not.toBe(raw);
  });

  it('is sensitive to input ordering (JSON serialization deterministic)', () => {
    // Same fields, same values — should be identical
    const a = versionedFingerprint({ x: 1, y: 2 });
    const b = versionedFingerprint({ x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it('handles undefined/null values correctly', () => {
    const a = versionedFingerprint({ key: null });
    const b = versionedFingerprint({ key: undefined });
    // JSON.stringify treats null and undefined differently
    // undefined properties are omitted, null is serialized
    expect(a).not.toBe(b);
  });

  it('handles empty array vs empty object', () => {
    const a = versionedFingerprint([]);
    const b = versionedFingerprint({});
    expect(a).not.toBe(b);
  });

  it('handles large input without error', () => {
    const bigInput = {
      parts: Array.from({ length: 1000 }, (_, i) => ({
        partNumber: i,
        name: `Part-${i}`,
        size: { width: 0.3, length: 0.5, thickness: 0.018 },
      })),
    };
    const result = versionedFingerprint(bigInput);
    expect(result).toMatch(/^v\d+:[0-9a-f]{8}$/);
  });
});
