import { describe, expect, it, beforeEach } from 'bun:test';
import {
  classify,
  clear,
  get,
  set,
  type LayoutCacheEntry,
} from '../boardLayoutsCache';

function makeEntry(fingerprint: string): LayoutCacheEntry {
  return {
    layouts: [],
    leftovers: [],
    fingerprint,
  };
}

beforeEach(() => {
  clear();
});

// ─── classify ─────────────────────────────────────────────────────────────

describe('classify', () => {
  it('returns "miss" when no cached entry exists', () => {
    expect(classify(undefined, 'abc')).toBe('miss');
  });

  it('returns "hit" when fingerprints match', () => {
    const cached = makeEntry('abc');
    expect(classify(cached, 'abc')).toBe('hit');
  });

  it('returns "stale" when fingerprints differ', () => {
    const cached = makeEntry('abc');
    expect(classify(cached, 'xyz')).toBe('stale');
  });

  it('is case-sensitive (fingerprints are hex)', () => {
    const cached = makeEntry('abcdef12');
    expect(classify(cached, 'ABCDEF12')).toBe('stale');
  });

  it('empty-string fingerprint only matches empty-string input', () => {
    const cached = makeEntry('');
    expect(classify(cached, '')).toBe('hit');
    expect(classify(cached, 'abc')).toBe('stale');
  });
});

// ─── get / set / clear ────────────────────────────────────────────────────

describe('cache storage', () => {
  it('get returns undefined before any set', () => {
    expect(get('project-1')).toBeUndefined();
  });

  it('set then get returns the stored entry', () => {
    const entry = makeEntry('fp1');
    set('project-1', entry);
    expect(get('project-1')).toBe(entry);
  });

  it('set overwrites an existing entry for the same project', () => {
    set('project-1', makeEntry('first'));
    set('project-1', makeEntry('second'));
    expect(get('project-1')?.fingerprint).toBe('second');
  });

  it('entries for different projects are isolated', () => {
    set('project-a', makeEntry('a'));
    set('project-b', makeEntry('b'));
    expect(get('project-a')?.fingerprint).toBe('a');
    expect(get('project-b')?.fingerprint).toBe('b');
  });

  it('clear removes all entries', () => {
    set('project-a', makeEntry('a'));
    set('project-b', makeEntry('b'));
    clear();
    expect(get('project-a')).toBeUndefined();
    expect(get('project-b')).toBeUndefined();
  });
});

// ─── classify + storage integration ───────────────────────────────────────

describe('classify + storage', () => {
  it('miss before any write, hit after matching write, stale after input change', () => {
    expect(classify(get('p'), 'fp1')).toBe('miss');

    set('p', makeEntry('fp1'));
    expect(classify(get('p'), 'fp1')).toBe('hit');

    // User changes stock → new fingerprint. Cache still holds old result.
    expect(classify(get('p'), 'fp2')).toBe('stale');

    // Recompute completes → cache updated.
    set('p', makeEntry('fp2'));
    expect(classify(get('p'), 'fp2')).toBe('hit');
  });
});
