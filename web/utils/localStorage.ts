function encodeStorageSegment(value: string) {
  return encodeURIComponent(value);
}

export const STORAGE_KEYS = {
  ui: {
    // Split panel width on BOM tab (preview pane width in px), scoped per project.
    projectBomPreviewWidth(projectId: string) {
      return `@cutlist/ui/project/${encodeStorageSegment(projectId)}/bom-preview-width/v1`;
    },
    // BOM filter/sort state, scoped per project.
    projectBomFilter(projectId: string) {
      return `@cutlist/ui/project/${encodeStorageSegment(projectId)}/bom-filter/v1`;
    },
  },
} as const;

export function getLocalStorageNumber(key: string): number | null {
  if (!import.meta.client) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setLocalStorageNumber(key: string, value: number) {
  if (!import.meta.client) return;
  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Ignore storage failures (private mode/quota/security policies).
  }
}

export function getLocalStorageJson<T>(key: string): T | null {
  if (!import.meta.client) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setLocalStorageJson(key: string, value: unknown) {
  if (!import.meta.client) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (private mode/quota/security policies).
  }
}
