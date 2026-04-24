/**
 * Tests the worker module's project-scoped request tracking.
 *
 * Bun's test runner has no Web Worker, so a FakeWorker captures posted
 * messages and drives responses manually.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigInput, PartToCut } from 'cutlist';

interface PostedMessage {
  type: 'layout';
  id: number;
  parts: PartToCut[];
  stockYaml: string;
  config: ConfigInput;
}

let workerInstance: FakeWorker | null = null;

class FakeWorker {
  posts: PostedMessage[] = [];
  onmessage:
    | ((e: {
        data: { type: 'layout'; id: number; result?: unknown; error?: string };
      }) => void)
    | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor() {
    workerInstance = this;
  }
  postMessage(msg: PostedMessage) {
    this.posts.push(msg);
  }
  terminate() {
    if (workerInstance === this) workerInstance = null;
  }
  respond(id: number, result: unknown) {
    this.onmessage?.({ data: { type: 'layout', id, result } });
  }
  respondError(id: number, error: string) {
    this.onmessage?.({ data: { type: 'layout', id, error } });
  }
}

(globalThis as any).Worker = FakeWorker;
vi.mock('../useAppErrors', () => ({
  reportError: () => {},
}));

const {
  computeLayouts,
  computingProjects,
  PART_COUNT_HARD_LIMIT,
  PartCountExceededError,
  __resetForTests,
} = await import('../useComputationWorker');

function isComputing(projectId: string): boolean {
  return computingProjects.value.has(projectId);
}

function makeParts(n: number): PartToCut[] {
  return Array.from({ length: n }, (_, i) => ({
    partNumber: i + 1,
    instanceNumber: 1,
    name: `p${i + 1}`,
    size: { width: 0.3, length: 0.5, thickness: 0.018 },
    material: 'plywood',
  }));
}

const CONFIG: ConfigInput = {
  bladeWidth: 0.003,
  margin: 0,
  optimize: 'auto',
  precision: 1e-5,
};

const emptyResult = () => ({ layouts: [], leftovers: [] });

beforeEach(() => {
  __resetForTests();
  workerInstance = null;
});

describe('computeLayouts', () => {
  it('rejects synchronously when part count exceeds the hard limit', async () => {
    const tooMany = makeParts(PART_COUNT_HARD_LIMIT + 1);
    await expect(
      computeLayouts('proj-a', tooMany, '', CONFIG),
    ).rejects.toBeInstanceOf(PartCountExceededError);
    expect(workerInstance).toBeNull();
  });

  it('marks a project as computing and clears on resolve', async () => {
    const promise = computeLayouts('proj-a', makeParts(3), '', CONFIG);
    expect(isComputing('proj-a')).toBe(true);

    const [post] = workerInstance!.posts;
    workerInstance!.respond(post.id, emptyResult());

    await expect(promise).resolves.toEqual(emptyResult());
    expect(isComputing('proj-a')).toBe(false);
  });

  it('clears the flag on reject too', async () => {
    const promise = computeLayouts('proj-a', makeParts(1), '', CONFIG);
    expect(isComputing('proj-a')).toBe(true);

    const [post] = workerInstance!.posts;
    workerInstance!.respondError(post.id, 'boom');

    await expect(promise).rejects.toThrow('boom');
    expect(isComputing('proj-a')).toBe(false);
  });
});

describe('project isolation', () => {
  it('tracks multiple projects independently', async () => {
    const pA = computeLayouts('proj-a', makeParts(1), '', CONFIG);
    const pB = computeLayouts('proj-b', makeParts(1), '', CONFIG);
    expect(isComputing('proj-a')).toBe(true);
    expect(isComputing('proj-b')).toBe(true);

    const [postA, postB] = workerInstance!.posts;
    workerInstance!.respond(postA.id, emptyResult());
    await pA;
    expect(isComputing('proj-a')).toBe(false);
    expect(isComputing('proj-b')).toBe(true);

    workerInstance!.respond(postB.id, emptyResult());
    await pB;
    expect(isComputing('proj-b')).toBe(false);
  });
});

describe('superseding within the same project', () => {
  it('stays computing until the latest request resolves, even if older ones land first', async () => {
    const first = computeLayouts('proj-a', makeParts(1), '', CONFIG);
    const second = computeLayouts('proj-a', makeParts(2), '', CONFIG);
    expect(isComputing('proj-a')).toBe(true);

    const [postFirst, postSecond] = workerInstance!.posts;
    workerInstance!.respond(postFirst.id, emptyResult());
    await first;
    expect(isComputing('proj-a')).toBe(true);

    workerInstance!.respond(postSecond.id, emptyResult());
    await second;
    expect(isComputing('proj-a')).toBe(false);
  });

  it('does not flip back on when a stale request resolves after the latest one', async () => {
    const first = computeLayouts('proj-a', makeParts(1), '', CONFIG);
    const second = computeLayouts('proj-a', makeParts(2), '', CONFIG);

    const [postFirst, postSecond] = workerInstance!.posts;
    workerInstance!.respond(postSecond.id, emptyResult());
    await second;
    expect(isComputing('proj-a')).toBe(false);

    workerInstance!.respond(postFirst.id, emptyResult());
    await first;
    expect(isComputing('proj-a')).toBe(false);
  });
});
