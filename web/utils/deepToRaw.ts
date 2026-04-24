/**
 * Recursively unwrap Vue reactive proxies from a value.
 *
 * `toRaw()` only strips the top-level proxy. When a reactive `ref` or
 * `reactive` object contains nested reactive children (common with deep
 * watchers), those children remain proxied. `structuredClone` throws
 * `DataCloneError` on Proxy objects, so we need full-depth unwrapping
 * before cloning for IDB writes or worker postMessage.
 */
import { toRaw } from 'vue';

export function deepToRaw<T>(value: T): T {
  const raw = toRaw(value);

  if (Array.isArray(raw)) {
    return raw.map(deepToRaw) as T;
  }

  if (raw !== null && typeof raw === 'object' && raw.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      result[key] = deepToRaw((raw as Record<string, unknown>)[key]);
    }
    return result as T;
  }

  return raw;
}
