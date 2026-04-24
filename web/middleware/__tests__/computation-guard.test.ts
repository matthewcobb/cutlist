/**
 * Tests for the computation-guard route middleware.
 *
 * Verifies that navigation is blocked (with a confirm prompt) when leaving
 * a project mid-computation, and allowed in all other cases.
 */
import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  mock,
} from 'bun:test';
import { ref } from 'vue';

// ── Mock browser + Nuxt globals BEFORE importing the module ─────────────────

const isComputing = ref(false);
const confirmMock = mock((_msg: string) => true);

const ABORT_SENTINEL = Symbol('abortNavigation');
// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.abortNavigation = () => ABORT_SENTINEL;
// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.defineNuxtRouteMiddleware = (fn: Function) => fn;
// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.useBoardLayoutsQuery = () => ({ isComputing });

// Preserve (and later restore) any pre-existing `window` so that adding a
// `confirm` stub here doesn't leak into sibling test files. Notably, replacing
// `globalThis.window` wholesale would break `fake-indexeddb/auto` (preloaded
// via bunfig.toml) for tests that run after this file in the same process.
const ORIGINAL_WINDOW_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  globalThis,
  'window',
);
const ORIGINAL_CONFIRM = (globalThis as any).window?.confirm;

// ── Import after mocks ─────────────────────────────────────────────────────

const { default: guard } = await import('../computation-guard.global');

// ── Helpers ─────────────────────────────────────────────────────────────────

function route(projectId?: string) {
  return { params: { projectId } } as any;
}

function run(to: any, from: any) {
  return (guard as Function)(to, from);
}

describe('computation-guard middleware', () => {
  beforeAll(() => {
    // Attach `confirm` onto the existing window (if any), otherwise create a
    // minimal stub. Use defineProperty so we can cleanly remove it afterwards.
    const existing = (globalThis as any).window;
    if (existing && typeof existing === 'object') {
      existing.confirm = confirmMock;
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: { confirm: confirmMock },
        configurable: true,
        writable: true,
      });
    }
  });

  afterAll(() => {
    // Restore whatever `window` looked like before this test file ran so we
    // don't pollute sibling tests that rely on `globalThis.window` being the
    // real global (e.g. fake-indexeddb attaches IDB APIs there).
    if (ORIGINAL_WINDOW_DESCRIPTOR) {
      Object.defineProperty(globalThis, 'window', ORIGINAL_WINDOW_DESCRIPTOR);
      if ((globalThis as any).window) {
        if (typeof ORIGINAL_CONFIRM === 'undefined') {
          delete (globalThis as any).window.confirm;
        } else {
          (globalThis as any).window.confirm = ORIGINAL_CONFIRM;
        }
      }
    } else {
      delete (globalThis as any).window;
    }
  });

  beforeEach(() => {
    isComputing.value = false;
    confirmMock.mockClear();
    confirmMock.mockReturnValue(true);
  });

  it('allows navigation when not computing', () => {
    const result = run(route('proj-b'), route('proj-a'));
    expect(result).toBeUndefined();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('allows same-project navigation (tab switch) even when computing', () => {
    isComputing.value = true;
    const result = run(route('proj-a'), route('proj-a'));
    expect(result).toBeUndefined();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('prompts and allows when user confirms', () => {
    isComputing.value = true;
    confirmMock.mockReturnValue(true);
    const result = run(route('proj-b'), route('proj-a'));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it('aborts navigation when user declines', () => {
    isComputing.value = true;
    confirmMock.mockReturnValue(false);
    const result = run(route('proj-b'), route('proj-a'));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(ABORT_SENTINEL);
  });

  it('prompts when navigating home while computing', () => {
    isComputing.value = true;
    confirmMock.mockReturnValue(false);
    const result = run(route(undefined), route('proj-a'));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(ABORT_SENTINEL);
  });

  it('does not prompt when navigating from landing page to a project', () => {
    isComputing.value = true;
    const result = run(route('proj-a'), route(undefined));
    expect(result).toBeUndefined();
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
