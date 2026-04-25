/**
 * Tests for useAppErrors — centralized error reporting composable.
 *
 * Verifies that reportError correctly calls useToast().add with the right
 * parameters for different severity levels, and that useAppErrors() sets up
 * watchers that pipe IDB and layout errors into the toast system.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, effectScope, type Ref, type EffectScope } from 'vue';

// vi.hoisted runs before any imports, so factories below can reference these.
// We can't construct real Vue refs here (vue isn't loaded yet); we use mutable
// holders and swap in real refs after the import phase completes.
const hoisted = vi.hoisted(() => {
  return {
    addMock: vi.fn((_opts: Record<string, unknown>) => {}),
    dismissIdb: vi.fn(),
    idbError: { value: null } as { value: string | null },
    layoutError: { value: null } as { value: string | null },
  };
});

vi.mock('@sentry/nuxt', () => ({
  captureMessage: vi.fn(),
}));
// Nuxt auto-imports rewrite `useToast()` to its registered import source —
// the runtime sub-path exposed by @nuxt/ui's package exports map.
vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: hoisted.addMock }),
}));
vi.mock('../useIdb/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useIdbErrors: () => ({
      error: hoisted.idbError,
      dismiss: hoisted.dismissIdb,
    }),
  };
});
vi.mock('../useBoardLayoutsQuery', () => ({
  default: () => ({ error: hoisted.layoutError }),
}));

// Replace the plain holders with real reactive refs now that vue is loaded.
// The mock factories above only read `hoisted.idbError`/`hoisted.layoutError`
// at call time (inside `useAppErrors()`), so swapping the references here
// before any test runs gives `watch()` something it can track.
const idbErrorRef = ref<string | null>(null);
const layoutErrorRef = ref<string | null>(null);
hoisted.idbError = idbErrorRef as unknown as Ref<string | null> & {
  value: string | null;
};
hoisted.layoutError = layoutErrorRef as unknown as Ref<string | null> & {
  value: string | null;
};

import { reportError, useAppErrors } from '../useAppErrors';

const { addMock, dismissIdb } = hoisted;

describe('reportError', () => {
  beforeEach(() => {
    addMock.mockClear();
  });

  it('shows an error toast with duration 0 for severity "error"', () => {
    reportError({
      title: 'Storage error',
      description: 'Storage is full.',
      severity: 'error',
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    const call = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.title).toBe('Storage error');
    expect(call.description).toBe('Storage is full.');
    expect(call.color).toBe('error');
    expect(call.duration).toBe(0);
  });

  it('shows a warning toast with auto-dismiss for severity "warning"', () => {
    reportError({
      title: 'Settings not saved',
      description: 'Could not save.',
      severity: 'warning',
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    const call = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.title).toBe('Settings not saved');
    expect(call.description).toBe('Could not save.');
    expect(call.color).toBe('warning');
    expect(call.duration).toBe(8000);
  });
});

describe('useAppErrors', () => {
  let scope: EffectScope;

  beforeEach(() => {
    addMock.mockClear();
    dismissIdb.mockClear();
    idbErrorRef.value = null;
    layoutErrorRef.value = null;
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('reports IDB errors as "Storage error" toasts', async () => {
    scope.run(() => useAppErrors());

    idbErrorRef.value = 'QuotaExceededError: storage is full';
    await nextTick();

    expect(addMock).toHaveBeenCalledTimes(1);
    const call = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.title).toBe('Storage error');
    expect(call.description).toBe('QuotaExceededError: storage is full');
    expect(call.color).toBe('error');
    expect(call.duration).toBe(0);
  });

  it('calls dismissIdb() after reporting an IDB error', async () => {
    scope.run(() => useAppErrors());

    idbErrorRef.value = 'Something went wrong';
    await nextTick();

    expect(dismissIdb).toHaveBeenCalledTimes(1);
  });

  it('reports layout errors as "Layout computation failed" toasts', async () => {
    scope.run(() => useAppErrors());

    layoutErrorRef.value = 'Worker terminated unexpectedly';
    await nextTick();

    expect(addMock).toHaveBeenCalledTimes(1);
    const call = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.title).toBe('Layout computation failed');
    expect(call.description).toBe('Worker terminated unexpectedly');
    expect(call.color).toBe('error');
    expect(call.duration).toBe(0);
  });

  it('does not fire toast when idbError is set to null', async () => {
    scope.run(() => useAppErrors());

    idbErrorRef.value = null;
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });

  it('does not fire toast when layoutError is set to null', async () => {
    scope.run(() => useAppErrors());

    layoutErrorRef.value = null;
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });
});
