<script lang="ts" setup>
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import { Distance } from 'cutlist';
import type { GroupedLeftover } from './layout-types';

const props = defineProps<{
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
}>();

const getPx = useGetPx();
const gap = getPx(new Distance('4 in').m);
const formatDistance = useFormatDistance();
const { requestGrainLockChange } = useGrainLockConfirm();

function onLeftoverGrainClick(part: BoardLayoutLeftover) {
  requestGrainLockChange(part.partNumber, part.grainLock, part);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function groupLeftoverParts(parts: BoardLayoutLeftover[]): GroupedLeftover[] {
  const partMap = new Map<string, GroupedLeftover>();
  for (const part of parts) {
    const pk = `${part.partNumber}__${part.grainLock ?? 'none'}`;
    const existing = partMap.get(pk);
    if (existing) {
      existing.qty++;
    } else {
      partMap.set(pk, { part, qty: 1 });
    }
  }
  return [...partMap.values()];
}

interface LayoutGroup {
  key: string;
  material: string;
  thickness: string;
  count: number;
  layouts: BoardLayout[];
  /** Original indices for board numbering */
  indices: number[];
  /** Unplaced parts matching this material + thickness */
  leftovers: GroupedLeftover[];
}

const groups = computed<LayoutGroup[]>(() => {
  // Stable sort: material → thickness → fuller boards first
  const sorted = [...props.layouts].sort((a, b) => {
    const mat = a.stock.material.localeCompare(b.stock.material);
    if (mat !== 0) return mat;
    const thick = a.stock.thicknessM - b.stock.thicknessM;
    if (thick !== 0) return thick;
    const areaA = a.placements.reduce((s, p) => s + p.widthM * p.lengthM, 0);
    const areaB = b.placements.reduce((s, p) => s + p.widthM * p.lengthM, 0);
    return areaB - areaA;
  });

  const map = new Map<string, { layouts: BoardLayout[]; indices: number[] }>();
  for (let i = 0; i < sorted.length; i++) {
    const layout = sorted[i];
    const key = `${layout.stock.material}__${layout.stock.thicknessM}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { layouts: [], indices: [] };
      map.set(key, entry);
    }
    entry.layouts.push(layout);
    entry.indices.push(i);
  }

  // Index leftovers by material+thickness key
  const leftoverMap = new Map<string, BoardLayoutLeftover[]>();
  for (const part of props.leftovers) {
    const key = `${part.material}__${part.thicknessM}`;
    let entry = leftoverMap.get(key);
    if (!entry) {
      entry = [];
      leftoverMap.set(key, entry);
    }
    entry.push(part);
  }

  const result = [...map.entries()].map(([key, { layouts, indices }]) => {
    const matching = leftoverMap.get(key);
    if (matching) leftoverMap.delete(key);
    return {
      key,
      material: layouts[0].stock.material,
      thickness: formatDistance(layouts[0].stock.thicknessM) ?? '',
      count: layouts.length,
      layouts,
      indices,
      leftovers: matching ? groupLeftoverParts(matching) : [],
    };
  });

  return result;
});

/** Leftovers that don't match any placed board group */
const unmatchedLeftovers = computed<GroupedLeftover[]>(() => {
  if (props.leftovers.length === 0) return [];
  const placedKeys = new Set(groups.value.map((g) => g.key));
  const unmatched = props.leftovers.filter(
    (p) => !placedKeys.has(`${p.material}__${p.thicknessM}`),
  );
  return groupLeftoverParts(unmatched);
});
</script>

<template>
  <div class="flex flex-col m-16" :style="`gap:${gap}`">
    <div class="flex items-start" :style="`gap:${gap}`">
      <template v-for="(group, gi) in groups" :key="group.key">
        <!-- Divider between groups -->
        <div
          v-if="gi > 0"
          class="self-stretch flex flex-col items-center shrink-0 mx-6"
        >
          <div class="w-px flex-1 bg-mist-600/50" />
        </div>

        <!-- Group: header, boards in rows of 10, then inline unplaced -->
        <div class="shrink-0">
          <div
            class="zoom-stable flex items-baseline gap-3 mb-6 origin-bottom-left"
          >
            <h2 class="text-2xl font-bold text-teal-400">
              {{ group.material }}
            </h2>
            <span class="text-2xl font-bold text-muted">{{
              group.thickness
            }}</span>
          </div>
          <div
            v-for="(row, ri) in chunkArray(group.layouts, 10)"
            :key="ri"
            class="flex"
            :style="`gap:${gap}` + (ri > 0 ? `;margin-top:${gap}` : '')"
          >
            <LayoutListItem
              v-for="(layout, i) of row"
              :key="group.indices[ri * 10 + i]"
              :layout="layout"
              :board-index="group.indices[ri * 10 + i]"
            />
          </div>

          <!-- Inline unplaced parts for this group -->
          <LayoutLeftoverList
            v-if="group.leftovers.length > 0"
            :leftovers="group.leftovers"
            class="mt-6"
            @grain-click="onLeftoverGrainClick"
          />
        </div>
      </template>

      <!-- "No boards available" column for unmatched leftovers -->
      <template v-if="unmatchedLeftovers.length > 0">
        <div
          v-if="groups.length > 0"
          class="self-stretch flex flex-col items-center shrink-0 mx-6"
        >
          <div class="w-px flex-1 bg-mist-600/50" />
        </div>

        <div class="shrink-0">
          <div
            class="zoom-stable flex items-center gap-2 mb-6 origin-bottom-left"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="w-5 h-5 text-amber-500"
            />
            <h2 class="text-2xl font-bold text-amber-500">
              No boards available
            </h2>
          </div>
          <LayoutLeftoverList
            :leftovers="unmatchedLeftovers"
            @grain-click="onLeftoverGrainClick"
          />
        </div>
      </template>
    </div>
  </div>
</template>
