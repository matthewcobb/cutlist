import { describe, expect, it } from 'bun:test';
import { fingerprint } from '../fingerprint';

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
