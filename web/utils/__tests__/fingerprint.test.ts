import { describe, expect, it } from 'bun:test';
import { fingerprint, versionedFingerprint } from '../fingerprint';

describe('fingerprint', () => {
  it('produces the same hash for structurally equal inputs', () => {
    const a = fingerprint({ parts: [1, 2, 3], flag: true });
    const b = fingerprint({ parts: [1, 2, 3], flag: true });
    expect(a).toBe(b);
  });

  it('changes when values change', () => {
    const a = fingerprint({ parts: [1, 2, 3] });
    const b = fingerprint({ parts: [1, 2, 4] });
    expect(a).not.toBe(b);
  });

  it('changes when keys change', () => {
    const a = fingerprint({ a: 1 });
    const b = fingerprint({ b: 1 });
    expect(a).not.toBe(b);
  });

  it('returns 8 lowercase hex characters', () => {
    const hash = fingerprint({ any: 'thing' });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is sensitive to nested structure', () => {
    const a = fingerprint({ x: { y: 1 } });
    const b = fingerprint({ x: { y: 2 } });
    expect(a).not.toBe(b);
  });
});

describe('versionedFingerprint', () => {
  it('returns format v{N}:{hash}', () => {
    const fp = versionedFingerprint({ test: 1 });
    expect(fp).toMatch(/^v\d+:[0-9a-f]{8}$/);
  });

  it('produces same result for same input', () => {
    const input = { parts: [1, 2], stock: 'wood', config: { bladeWidth: 3 } };
    const a = versionedFingerprint(input);
    const b = versionedFingerprint(input);
    expect(a).toBe(b);
  });

  it('differs from raw fingerprint (includes version tag)', () => {
    const input = { test: 1 };
    const raw = fingerprint(input);
    const versioned = versionedFingerprint(input);
    // The raw hash is 8 hex chars, versioned includes version prefix
    expect(versioned).not.toBe(raw);
    // Extract the hash portion
    const hashPart = versioned.split(':')[1];
    // The hash should differ because the version prefix changes the input
    expect(hashPart).not.toBe(raw);
  });

  it('changes when input changes', () => {
    const a = versionedFingerprint({ x: 1 });
    const b = versionedFingerprint({ x: 2 });
    expect(a).not.toBe(b);
  });
});

describe('fingerprint collision smoke test', () => {
  it('generates distinct hashes for 10000 sequential integers', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      hashes.add(fingerprint(i));
    }
    // With 32-bit FNV-1a and 10k inputs, zero collisions is expected.
    // Allow up to 1 collision for theoretical possibility.
    expect(hashes.size).toBeGreaterThanOrEqual(9999);
  });

  it('generates distinct hashes for similar small objects', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      hashes.add(
        fingerprint({
          parts: [{ partNumber: i, width: 0.1, length: 0.2, thickness: 0.018 }],
          config: { bladeWidth: 0.003, optimize: 'auto' },
        }),
      );
    }
    expect(hashes.size).toBe(1000);
  });
});
