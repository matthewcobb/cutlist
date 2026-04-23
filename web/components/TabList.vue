<script lang="ts" setup>
const scroller = ref<HTMLUListElement | null>(null);
const showLeft = ref(false);
const showRight = ref(false);

function updateOverflow() {
  const el = scroller.value;
  if (!el) return;
  showLeft.value = el.scrollLeft > 0;
  showRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollByAmount(delta: number) {
  scroller.value?.scrollBy({ left: delta, behavior: 'smooth' });
}

let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;

onMounted(() => {
  const el = scroller.value;
  if (!el) return;

  let scrolled = false;
  const scrollToActive = () => {
    if (scrolled) return;
    const active = el.querySelector<HTMLElement>('[data-tab-active="true"]');
    if (!active) return;
    active.scrollIntoView({ inline: 'center', block: 'nearest' });
    scrolled = true;
  };

  ro = new ResizeObserver(updateOverflow);
  ro.observe(el);
  mo = new MutationObserver(() => {
    updateOverflow();
    scrollToActive();
  });
  mo.observe(el, { childList: true, subtree: true });

  scrollToActive();
});

onBeforeUnmount(() => {
  ro?.disconnect();
  mo?.disconnect();
});
</script>

<template>
  <div class="relative flex items-stretch min-w-0">
    <ul
      ref="scroller"
      role="tablist"
      aria-label="Open projects"
      class="flex overflow-x-auto bg-base flex-1 min-w-0 scroll-px-8"
      @scroll="updateOverflow"
    >
      <slot />
    </ul>
    <button
      v-show="showLeft"
      type="button"
      class="absolute left-0 top-0 bottom-0 z-10 px-1.5 flex items-center text-muted hover:text-teal-400 bg-base/90 backdrop-blur-sm border-r border-subtle transition-colors"
      title="Scroll tabs left"
      aria-label="Scroll tabs left"
      @click="scrollByAmount(-240)"
    >
      <UIcon name="i-lucide-chevron-left" class="block shrink-0 w-4 h-4" />
    </button>
    <button
      v-show="showRight"
      type="button"
      class="absolute right-0 top-0 bottom-0 z-10 px-1.5 flex items-center text-muted hover:text-teal-400 bg-base/90 backdrop-blur-sm border-l border-subtle transition-colors"
      title="Scroll tabs right"
      aria-label="Scroll tabs right"
      @click="scrollByAmount(240)"
    >
      <UIcon name="i-lucide-chevron-right" class="block shrink-0 w-4 h-4" />
    </button>
  </div>
</template>

<style scoped>
ul {
  scrollbar-width: none;
}
</style>
