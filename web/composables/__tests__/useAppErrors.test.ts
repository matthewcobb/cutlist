/**
 * Tests for useAppErrors — centralized error reporting composable.
 *
 * Verifies that reportError correctly calls useToast().add with the right
 * parameters for different severity levels.
 */
import { describe, expect, it, mock, beforeEach } from 'bun:test';

// ── Mock useToast ───────────────────────────────────────────────────────────
// Nuxt auto-imports useToast — we provide a minimal mock.
const addMock = mock((_opts: Record<string, unknown>) => {});
const toastMock = { add: addMock };

// @ts-expect-error — globalThis mock for Nuxt auto-import
globalThis.useToast = () => toastMock;

// Import after mocks are set up
import { reportError } from '../useAppErrors';

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
