import { describe, expect, it, beforeEach } from 'bun:test';
import {
  clear,
  get,
  remove,
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

describe('boardLayoutsCache', () => {
  it('returns undefined before any set', () => {
    expect(get('project-1')).toBeUndefined();
  });

  it('round-trips entries per project', () => {
    const a = makeEntry('fp-a');
    const b = makeEntry('fp-b');
    set('project-1', a);
    set('project-2', b);
    expect(get('project-1')).toBe(a);
    expect(get('project-2')).toBe(b);
  });

  it('overwrites entries on repeated set', () => {
    set('p', makeEntry('fp1'));
    const updated = makeEntry('fp2');
    set('p', updated);
    expect(get('p')).toBe(updated);
  });

  it('remove deletes a single entry and is a no-op for missing ids', () => {
    set('p', makeEntry('fp1'));
    remove('missing');
    expect(get('p')?.fingerprint).toBe('fp1');
    remove('p');
    expect(get('p')).toBeUndefined();
  });

  it('clear removes all entries', () => {
    set('p1', makeEntry('a'));
    set('p2', makeEntry('b'));
    clear();
    expect(get('p1')).toBeUndefined();
    expect(get('p2')).toBeUndefined();
  });
});
