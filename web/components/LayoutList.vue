<script lang="ts" setup>
import type { BoardLayout, BoardLayoutLeftover } from 'cutlist';
import { Distance } from 'cutlist';
import { cycleGrainLock } from '~/utils/grain';

const props = defineProps<{
  layouts: BoardLayout[];
  leftovers: BoardLayoutLeftover[];
}>();

const getPx = useGetPx();
const gap = getPx(new Distance('4 in').m);
const formatDistance = useFormatDistance();
const { activeId, updatePartGrainLock } = useProjects();

function onLeftoverGrainClick(part: BoardLayoutLeftover) {
  if (!activeId.value) return;
  updatePartGrainLock(
    activeId.value,
    part.partNumber,
    cycleGrainLock(part.grainLock),
  );
}

const CLICK_THRESHOLD = 5;

function onLeftoverPointerDown(e: PointerEvent, part: BoardLayoutLeftover) {
  const startX = e.clientX;
  const startY = e.clientY;
  document.addEventListener(
    'pointerup',
    (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (Math.hypot(dx, dy) < CLICK_THRESHOLD) onLeftoverGrainClick(part);
    },
    { once: true },
  );
}

interface LayoutGroup {
  key: string;
  material: string;
  thickness: string;
  count: number;
  layouts: BoardLayout[];
  /** Original indices for board numbering */
  indices: number[];
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

  return [...map.entries()].map(([key, { layouts, indices }]) => ({
    key,
    material: layouts[0].stock.material,
    thickness: formatDistance(layouts[0].stock.thicknessM) ?? '',
    count: layouts.length,
    layouts,
    indices,
  }));
});

interface LeftoverStockGroup {
  key: string;
  material: string;
  thickness: string;
  parts: BoardLayoutLeftover[];
}

const leftoversByStock = computed<LeftoverStockGroup[]>(() => {
  if (props.leftovers.length === 0) return [];

  const map = new Map<string, BoardLayoutLeftover[]>();
  for (const part of props.leftovers) {
    const key = `${part.material}__${part.thicknessM}`;
    let entry = map.get(key);
    if (!entry) {
      entry = [];
      map.set(key, entry);
    }
    entry.push(part);
  }

  return [...map.entries()].map(([key, parts]) => ({
    key,
    material: parts[0].material,
    thickness: formatDistance(parts[0].thicknessM) ?? '',
    parts,
  }));
});
</script>

<template>
  <div class="flex flex-col m-16" :style="`gap:${gap}`">
    <!-- Placed boards -->
    <div class="flex items-start" :style="`gap:${gap}`">
      <template v-for="(group, gi) in groups" :key="group.key">
        <!-- Divider between groups -->
        <div
          v-if="gi > 0"
          class="self-stretch flex flex-col items-center shrink-0 mx-6"
        >
          <div class="w-px flex-1 bg-mist-600/50" />
        </div>

        <!-- Group: header above, boards below -->
        <div class="shrink-0">
          <div class="flex items-baseline gap-3 mb-6">
            <h2 class="text-2xl font-bold text-teal-400">
              {{ group.material }}
            </h2>
            <span class="text-2xl font-bold text-muted">{{
              group.thickness
            }}</span>
          </div>
          <ul class="flex" :style="`gap:${gap}`">
            <LayoutListItem
              v-for="(layout, i) of group.layouts"
              :key="group.indices[i]"
              :layout="layout"
              :board-index="group.indices[i]"
            />
          </ul>
        </div>
      </template>
    </div>

    <!-- Unplaced parts -->
    <template v-if="leftoversByStock.length > 0">
      <div class="w-full h-px bg-amber-500/30" />

      <div class="shrink-0">
        <div class="flex items-center gap-2 mb-6">
          <UIcon
            name="i-lucide-triangle-alert"
            class="w-5 h-5 text-amber-500"
          />
          <h2 class="text-2xl font-bold text-amber-500">Unplaced</h2>
          <span class="text-sm text-amber-500/60"
            >{{ props.leftovers.length }} part{{
              props.leftovers.length === 1 ? '' : 's'
            }}</span
          >
        </div>

        <div class="flex flex-col" :style="`gap:${gap}`">
          <div v-for="group in leftoversByStock" :key="group.key">
            <div class="flex items-baseline gap-2 mb-3">
              <span class="text-lg font-bold text-amber-500/60">{{
                group.material
              }}</span>
              <span class="text-lg font-bold text-amber-500/40">{{
                group.thickness
              }}</span>
            </div>
            <ul class="flex flex-col" :style="`gap:${gap}`">
              <li
                v-for="(part, i) of group.parts"
                :key="`${part.partNumber}-${part.instanceNumber}-${i}`"
                class="flex items-center gap-3 shrink-0 cursor-pointer group"
                @pointerdown="onLeftoverPointerDown($event, part)"
              >
                <div
                  class="rounded-xs border-2 border-dashed border-amber-500/40 group-hover:border-amber-500/70 relative transition-colors"
                  :style="`width:${getPx(part.grainLock === 'width' ? part.lengthM : part.widthM)};height:${getPx(part.grainLock === 'width' ? part.widthM : part.lengthM)}`"
                >
                  <span
                    class="absolute top-0 right-0 text-amber-500/80 text-xs font-semibold text-right p-px"
                  >
                    {{ part.partNumber }}
                  </span>
                  <div
                    v-if="part.grainLock"
                    class="absolute bottom-0.5 left-0.5 text-amber-500/60"
                  >
                    <UIcon
                      :name="
                        part.grainLock === 'length'
                          ? 'i-ri-arrow-up-down-line'
                          : 'i-ri-arrow-left-right-line'
                      "
                      class="w-3 h-3"
                    />
                  </div>
                  <!-- Rotation affordance on hover -->
                  <div
                    class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  >
                    <UIcon
                      name="i-ri-loop-left-line"
                      class="rotate-icon-amber drop-shadow-md"
                      :style="`width:${Math.max(14, Math.min(28, parseFloat(getPx(Math.min(part.widthM, part.lengthM) * 0.45))))}px;height:${Math.max(14, Math.min(28, parseFloat(getPx(Math.min(part.widthM, part.lengthM) * 0.45))))}px`"
                    />
                  </div>
                </div>
                <span class="text-sm text-amber-500/60 text-nowrap">
                  {{
                    formatDistance(
                      part.grainLock === 'width' ? part.lengthM : part.widthM,
                    )
                  }}
                  &times;
                  {{
                    formatDistance(
                      part.grainLock === 'width' ? part.widthM : part.lengthM,
                    )
                  }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rotate-icon-amber {
  color: rgba(245, 158, 11, 0.8);
  animation: gentle-rock 1.8s ease-in-out infinite;
}
.group:hover .rotate-icon-amber {
  color: rgba(245, 158, 11, 1);
}

@keyframes gentle-rock {
  0%,
  100% {
    transform: rotate(0deg);
  }
  40% {
    transform: rotate(35deg);
  }
  60% {
    transform: rotate(25deg);
  }
}
</style>
