/**
 * Cache fingerprinting for Cutlist's persistence layer.
 *
 * Uses FNV-1a (32-bit) over the JSON serialization of input values. This is
 * fast and stable across reloads for the same input shape. Not collision-safe
 * for adversarial input, but inputs are user-owned parts/config objects.
 *
 * The `versionedFingerprint` function prepends a version tag to the hash input,
 * guaranteeing that cached values from a different algorithm version never
 * produce a false hit. This is the required entry point for all cache keys.
 *
 * Versioning contract:
 * - `LAYOUT_CACHE_VERSION` (in migrations.ts) must be bumped whenever the
 *   packing algorithm output shape, scoring, or ConfigInput fields change.
 * - `DERIVE_VERSION` (in parseGltf.ts) is checked separately by the derive
 *   cache via an explicit version field.
 */

import { LAYOUT_CACHE_VERSION } from '~/utils/migrations';

/** FNV-1a (32-bit) over a string. Returns an 8-char hex digest. */
function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Raw FNV-1a hash of JSON-serializable input. Returns an 8-char hex string.
 *
 * Prefer `versionedFingerprint` for cache keys — it includes version tagging.
 */
export function fingerprint(value: unknown): string {
  return fnv1aHex(JSON.stringify(value));
}

/**
 * Versioned fingerprint for layout cache keys. Prepends the layout cache
 * version to the serialized input before hashing, so bumping
 * LAYOUT_CACHE_VERSION automatically invalidates all cached layouts.
 *
 * Returns a string in the format "v{version}:{hash}" for debuggability.
 */
export function versionedFingerprint(value: unknown): string {
  const hash = fnv1aHex(`__v${LAYOUT_CACHE_VERSION}__` + JSON.stringify(value));
  return `v${LAYOUT_CACHE_VERSION}:${hash}`;
}
