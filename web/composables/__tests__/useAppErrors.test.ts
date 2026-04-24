/**
 * Tests for useAppErrors — centralized error reporting composable.
 *
 * Verifies that reportError correctly calls useToast().add with the right
 * parameters for different severity levels, and that useAppErrors() sets up
 * watchers that pipe IDB and layout errors into the toast system.
 */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import {
  ref,
  watch,
  readonly,
  nextTick,
  effectScope,
  type EffectScope,
} from 'vue';

// ── Expose Vue auto-imports on globalThis ──────────────────────────────────
// Nuxt auto-imports these at build time; in Bun tests we provide them manually.
// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.watch = watch;
// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.readonly = readonly;

// ── Mock useToast ───────────────────────────────────────────────────────────
// Nuxt auto-imports useToast — we provide a minimal mock.
const addMock = mock((_opts: Record<string, unknown>) => {});
const toastMock = { add: addMock };

// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.useToast = () => toastMock;

// ── Mock useIdbErrors / useBoardLayoutsQuery ────────────────────────────────
// These are Nuxt auto-imports called inside useAppErrors(). We provide reactive
// refs so watchers trigger when we set .value in tests.
const idbError = ref<string | null>(null);
const dismissIdb = mock(() => {
  idbError.value = null;
});

// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.useIdbErrors = () => ({
  error: readonly(idbError),
  dismiss: dismissIdb,
});

const layoutError = ref<string | null>(null);

// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.useBoardLayoutsQuery = () => ({
  error: layoutError,
});

// Import after mocks are set up
import { reportError, useAppErrors } from '../useAppErrors';

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
    expect(call.duration).toBe(0); // persistent
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
    expect(call.duration).toBe(8000); // auto-dismiss
  });
});

describe('useAppErrors', () => {
  let scope: EffectScope;

  beforeEach(() => {
    addMock.mockClear();
    dismissIdb.mockClear();
    idbError.value = null;
    layoutError.value = null;
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('reports IDB errors as "Storage error" toasts', async () => {
    scope.run(() => useAppErrors());

    idbError.value = 'QuotaExceededError: storage is full';
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

    idbError.value = 'Something went wrong';
    await nextTick();

    expect(dismissIdb).toHaveBeenCalledTimes(1);
  });

  it('reports layout errors as "Layout computation failed" toasts', async () => {
    scope.run(() => useAppErrors());

    layoutError.value = 'Worker terminated unexpectedly';
    await nextTick();

    expect(addMock).toHaveBeenCalledTimes(1);
    const call = addMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.title).toBe('Layout computation failed');
    expect(call.description).toBe('Worker terminated unexpectedly');
    expect(call.color).toBe('error');
    expect(call.duration).toBe(0);
  });

  it('ignores layout errors with message "Cancelled"', async () => {
    scope.run(() => useAppErrors());

    layoutError.value = 'Cancelled';
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });

  it('ignores layout errors with message "Page unloading"', async () => {
    scope.run(() => useAppErrors());

    layoutError.value = 'Page unloading';
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });

  it('does not fire toast when idbError is set to null', async () => {
    scope.run(() => useAppErrors());

    idbError.value = null;
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });

  it('does not fire toast when layoutError is set to null', async () => {
    scope.run(() => useAppErrors());

    layoutError.value = null;
    await nextTick();

    expect(addMock).not.toHaveBeenCalled();
  });
});
