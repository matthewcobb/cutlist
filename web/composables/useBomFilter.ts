/**
 * BOM filter/sort state with localStorage persistence.
 *
 * Persists search, sort key, and sort direction per project so users
 * return to their last view.
 */

import {
  STORAGE_KEYS,
  getLocalStorageJson,
  setLocalStorageJson,
} from '~/utils/localStorage';
import type { BomRow } from '~/composables/useBomRows';

export type SortKey =
  | 'number'
  | 'name'
  | 'qty'
  | 'thickness'
  | 'width'
  | 'length';

interface BomFilterState {
  search: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
}

const SORT_KEYS = new Set<SortKey>([
  'number',
  'name',
  'qty',
  'thickness',
  'width',
  'length',
]);

export interface MaterialGroup {
  material: string;
  rows: BomRow[];
  totalParts: number;
}

export default function useBomFilter(
  activeId: Ref<string | null>,
  allRows: Ref<BomRow[]>,
) {
  function loadBomFilter(): BomFilterState {
    if (!activeId.value)
      return { search: '', sortKey: 'number', sortDir: 'asc' };
    const stored = getLocalStorageJson<Partial<BomFilterState>>(
      STORAGE_KEYS.ui.projectBomFilter(activeId.value),
    );
    return {
      search: typeof stored?.search === 'string' ? stored.search : '',
      sortKey: SORT_KEYS.has(stored?.sortKey as SortKey)
        ? (stored!.sortKey as SortKey)
        : 'number',
      sortDir: stored?.sortDir === 'desc' ? 'desc' : 'asc',
    };
  }

  const restored = loadBomFilter();
  const search = ref(restored.search);
  const sortKey = ref<SortKey>(restored.sortKey);
  const sortDir = ref<'asc' | 'desc'>(restored.sortDir);

  watch([search, sortKey, sortDir], () => {
    if (!activeId.value) return;
    setLocalStorageJson(STORAGE_KEYS.ui.projectBomFilter(activeId.value), {
      search: search.value,
      sortKey: sortKey.value,
      sortDir: sortDir.value,
    });
  });

  function toggleSort(key: SortKey) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey.value = key;
      sortDir.value = 'asc';
    }
  }

  function sortCompare(a: BomRow, b: BomRow): number {
    let cmp = 0;
    switch (sortKey.value) {
      case 'number':
        cmp = a.number - b.number;
        break;
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'qty':
        cmp = a.qty - b.qty;
        break;
      case 'thickness':
        cmp = a.thicknessM - b.thicknessM;
        break;
      case 'width':
        cmp = a.widthM - b.widthM;
        break;
      case 'length':
        cmp = a.lengthM - b.lengthM;
        break;
    }
    return sortDir.value === 'desc' ? -cmp : cmp;
  }

  const filteredGroups = computed<MaterialGroup[]>(() => {
    let filtered = allRows.value;
    const q = search.value.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.modelName.toLowerCase().includes(q) ||
          r.material.toLowerCase().includes(q) ||
          String(r.number).includes(q),
      );
    }
    filtered = [...filtered].sort(sortCompare);

    const map = new Map<string, BomRow[]>();
    for (const row of filtered) {
      const list = map.get(row.material) ?? [];
      list.push(row);
      map.set(row.material, list);
    }
    return [...map.entries()].map(([material, rows]) => ({
      material,
      rows,
      totalParts: rows.reduce((s, r) => s + r.qty, 0),
    }));
  });

  return {
    search,
    sortKey,
    sortDir,
    toggleSort,
    filteredGroups,
  };
}
