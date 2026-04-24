/**
 * Centralized error reporting — surfaces actionable errors to users via toasts
 * and forwards them to Sentry.
 *
 * This composable bridges internal error state (IDB errors, worker failures,
 * computation errors) to user-visible notifications using Nuxt UI's toast system.
 *
 * Design:
 * - Only surfaces errors the user needs to know about (would be confused or
 *   lose work without seeing them).
 * - Severity levels control toast behavior: 'error' persists until dismissed,
 *   'warning' auto-dismisses after a delay.
 * - Additive: wraps existing error patterns without restructuring control flow.
 */

import * as Sentry from '@sentry/nuxt';

interface AppError {
  title: string;
  description: string;
  severity: 'error' | 'warning';
}

/**
 * Push an error to the user-visible toast queue and report to Sentry.
 * Call this from composables/utilities when a meaningful error occurs.
 */
export function reportError(error: AppError): void {
  Sentry.captureMessage(`${error.title}: ${error.description}`, {
    level: error.severity === 'error' ? 'error' : 'warning',
  });

  const toast = useToast();
  toast.add({
    title: error.title,
    description: error.description,
    color: error.severity === 'error' ? 'error' : 'warning',
    // Persistent errors require manual dismissal; warnings auto-dismiss.
    duration: error.severity === 'error' ? 0 : 8000,
  });
}

/**
 * Initialize global error watchers. Call once from app.vue.
 *
 * Watches centralized error state (IDB errors, layout computation errors)
 * and pipes them into the toast system. This is the single place where
 * reactive error refs get connected to user-visible notifications.
 */
export function useAppErrors(): void {
  const { error: idbError, dismiss: dismissIdb } = useIdbErrors();
  const { error: layoutError } = useBoardLayoutsQuery();

  // ── IDB errors (quota exceeded, storage unavailable, future schema) ──────
  watch(idbError, (msg) => {
    if (!msg) return;
    reportError({
      title: 'Storage error',
      description: msg,
      severity: 'error',
    });
    // Clear the reactive state so the same error doesn't re-fire
    // if something else triggers the watcher again.
    dismissIdb();
  });

  // ── Layout computation errors (worker crash, part count exceeded) ─────────
  watch(layoutError, (msg) => {
    if (!msg) return;
    // AbortError means the user switched projects or inputs changed — not a
    // real failure. Page-unload rejections are also AbortError.
    if (msg === 'Cancelled' || msg === 'Page unloading') return;
    reportError({
      title: 'Layout computation failed',
      description: msg,
      severity: 'error',
    });
  });
}
