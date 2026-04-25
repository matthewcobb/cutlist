/**
 * Single source of truth for the workspace tabs of a project.
 *
 * Owns the tab id type, display metadata used by the workspace nav, and the
 * URL-segment <-> tab mapping used by route synchronization.
 */

export type ProjectTabId =
  | 'bom'
  | 'model'
  | 'boards'
  | 'layout'
  | 'instructions'
  | 'settings';

export interface ProjectTabDefinition {
  id: ProjectTabId;
  label: string;
  icon: string;
  /**
   * URL segment for this tab. The default tab uses an empty string so it is
   * served at `/:projectId` without a trailing tab segment.
   */
  urlSegment: string;
}

export const DEFAULT_PROJECT_TAB: ProjectTabId = 'bom';

export const PROJECT_TABS: readonly ProjectTabDefinition[] = [
  { id: 'bom', label: 'BOM', icon: 'i-lucide-table', urlSegment: '' },
  {
    id: 'layout',
    label: 'Layout',
    icon: 'i-lucide-layers',
    urlSegment: 'layout',
  },
  { id: 'model', label: 'Model', icon: 'i-lucide-box', urlSegment: 'model' },
  {
    id: 'instructions',
    label: 'Build',
    icon: 'i-lucide-book-open',
    urlSegment: 'instructions',
  },
  {
    id: 'boards',
    label: 'Stock',
    icon: 'i-lucide-warehouse',
    urlSegment: 'boards',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'i-lucide-settings',
    urlSegment: 'settings',
  },
] as const;

const BY_ID = new Map<ProjectTabId, ProjectTabDefinition>(
  PROJECT_TABS.map((t) => [t.id, t]),
);

const BY_SEGMENT = new Map<string, ProjectTabDefinition>(
  PROJECT_TABS.filter((t) => t.urlSegment !== '').map((t) => [t.urlSegment, t]),
);

export function isProjectTabId(value: unknown): value is ProjectTabId {
  return typeof value === 'string' && BY_ID.has(value as ProjectTabId);
}

export function tabFromUrlSegment(
  segment: string | null | undefined,
): ProjectTabId {
  if (!segment) return DEFAULT_PROJECT_TAB;
  return BY_SEGMENT.get(segment)?.id ?? DEFAULT_PROJECT_TAB;
}

export function urlSegmentForTab(tab: ProjectTabId): string {
  return BY_ID.get(tab)?.urlSegment ?? '';
}

/** Build the canonical URL path for a project + tab combination. */
export function projectPath(
  projectId: string | null,
  tab: ProjectTabId | null,
): string {
  if (!projectId) return '/';
  const segment = tab ? urlSegmentForTab(tab) : '';
  return segment ? `/${projectId}/${segment}` : `/${projectId}`;
}
