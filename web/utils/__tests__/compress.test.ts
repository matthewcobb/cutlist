import { describe, expect, test } from 'vitest';
import { gzipCompress, gzipDecompress } from '../compress';

describe('gzip round-trip', () => {
  test('compresses and decompresses a JSON string', async () => {
    const original = JSON.stringify({ hello: 'world', nested: { a: 1 } });
    const blob = await gzipCompress(original);

    // Verify gzip magic bytes
    const header = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect(header[0]).toBe(0x1f);
    expect(header[1]).toBe(0x8b);

    const file = new File([blob], 'test.gz');
    const result = await gzipDecompress(file);
    expect(result).toBe(original);
  });

  test('handles empty object', async () => {
    const original = '{}';
    const blob = await gzipCompress(original);
    const file = new File([blob], 'test.gz');
    expect(await gzipDecompress(file)).toBe(original);
  });

  test('Should handle a deterministic large repetitive payload', async () => {
    const data = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `drawer-runner-${i % 10}`,
        material: 'Baltic Birch',
        size: { width: 300, length: 600, thickness: 18 },
      })),
    };
    const original = JSON.stringify(data);
    const blob = await gzipCompress(original);

    // Repetitive JSON should compress significantly
    expect(blob.size).toBeLessThan(original.length * 0.5);

    const file = new File([blob], 'test.gz');
    expect(await gzipDecompress(file)).toBe(original);
  });
});
