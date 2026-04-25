/**
 * Fingerprinting for cache keys and similar use cases.
 *
 * Uses FNV-1a (32-bit) over the JSON serialization of input values. This is
 * fast and stable for the same input shape. Not collision-safe for adversarial
 * input, but inputs are user-owned parts/config objects.
 *
 * Used for cache keys in the layout cache to detect when inputs have changed.
 */

/** FNV-1a (32-bit) over a string. Returns an 8-char hex digest. */
function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** FNV-1a hash of JSON-serializable input. Returns an 8-char hex string. */
export function fingerprint(value: unknown): string {
  return fnv1aHex(JSON.stringify(value));
}
