/**
 * Fast non-cryptographic hash of JSON-serializable input. Used to invalidate
 * derive/layout caches when inputs change. Returns a short hex string.
 *
 * FNV-1a over the UTF-16 code units of JSON.stringify(value). Stable across
 * reloads for the same input shape. Not collision-safe for adversarial input;
 * inputs here are user-owned parts/config objects.
 */
export function fingerprint(value: unknown): string {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
