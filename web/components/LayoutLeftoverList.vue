<script lang="ts" setup>
import type { BoardLayoutLeftover } from 'cutlist';
import type { GroupedLeftover } from './layout-types';

defineProps<{
  leftovers: GroupedLeftover[];
}>();

const emit = defineEmits<{
  grainClick: [part: BoardLayoutLeftover];
}>();

const getPx = useGetPx();
const formatDistance = useFormatDistance();

const CLICK_THRESHOLD = 5;

function onPointerDown(e: PointerEvent, part: BoardLayoutLeftover) {
  const startX = e.clientX;
  const startY = e.clientY;
  document.addEventListener(
    'pointerup',
    (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (Math.hypot(dx, dy) < CLICK_THRESHOLD) emit('grainClick', part);
    },
    { once: true },
  );
}
</script>

<template>
  <div class="flex items-center gap-2 mb-3">
    <UIcon
      name="i-lucide-triangle-alert"
      class="w-4 h-4 text-amber-500 shrink-0"
    />
    <span class="text-sm font-semibold text-amber-500"
      >{{ leftovers.reduce((s, g) => s + g.qty, 0) }} unplaced</span
    >
  </div>
  <ul class="flex flex-col gap-2">
    <li
      v-for="{ part, qty } of leftovers"
      :key="`${part.partNumber}-${part.grainLock ?? 'none'}`"
      class="flex items-center gap-3 shrink-0 cursor-pointer group"
      @pointerdown="onPointerDown($event, part)"
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
          <svg viewBox="0 0 24 24" class="w-3 h-3" aria-hidden="true">
            <path
              v-if="part.grainLock === 'length'"
              fill="currentColor"
              d="m11.95 7.95l-1.414 1.414L8 6.828V20H6V6.828L3.466 9.364L2.05 7.95L7 3zm10 8.1L17 21l-4.95-4.95l1.414-1.414l2.537 2.536L16 4h2v13.172l2.536-2.536z"
            />
            <path
              v-else
              fill="currentColor"
              d="M16.05 12.05L21 17l-4.95 4.95l-1.414-1.415L17.172 18H4v-2h13.172l-2.536-2.535zm-8.1-10l1.414 1.414l-2.536 2.535H20v2H6.828l2.536 2.536L7.95 11.95L3 7z"
            />
          </svg>
        </div>
        <!-- Rotation affordance on hover -->
        <div
          class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        >
          <svg
            viewBox="0 0 24 24"
            class="rotate-icon-amber"
            :style="`width:${Math.max(14, Math.min(28, parseFloat(getPx(Math.min(part.widthM, part.lengthM) * 0.45))))}px;height:${Math.max(14, Math.min(28, parseFloat(getPx(Math.min(part.widthM, part.lengthM) * 0.45))))}px`"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12 4a7.99 7.99 0 0 0-6.616 3.5H8v2H2v-6h2V6a9.98 9.98 0 0 1 8-4c5.523 0 10 4.477 10 10h-2a8 8 0 0 0-8-8m-8 8a8 8 0 0 0 14.616 4.5H16v-2h6v6h-2V18a9.98 9.98 0 0 1-8 4C6.477 22 2 17.523 2 12z"
            />
          </svg>
        </div>
      </div>
      <span class="text-sm text-amber-500/60 text-nowrap">
        <span v-if="qty > 1" class="text-amber-500/80 font-semibold"
          >&times;{{ qty }}&ensp;</span
        >{{
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
</template>

<style scoped>
.rotate-icon-amber {
  color: rgba(245, 158, 11, 0.8);
}
.group:hover .rotate-icon-amber {
  color: rgba(245, 158, 11, 1);
  animation: gentle-rock 1.8s ease-in-out infinite;
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
