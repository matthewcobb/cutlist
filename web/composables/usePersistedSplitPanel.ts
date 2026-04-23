import {
  getLocalStorageNumber,
  setLocalStorageNumber,
} from '~/utils/localStorage';

interface PersistedSplitPanelOptions {
  storageKey: string | Ref<string> | (() => string);
  minPanelWidthPx?: number;
  minMainWidthPx?: number;
  defaultPanelRatio?: number;
}

export default function usePersistedSplitPanel(
  container: Ref<HTMLElement | null | undefined>,
  enabled: Ref<boolean>,
  options: PersistedSplitPanelOptions,
) {
  const panelWidth = ref(0);
  const isResizing = ref(false);

  const minPanelWidthPx = options.minPanelWidthPx ?? 280;
  const minMainWidthPx = options.minMainWidthPx ?? 420;
  const defaultPanelRatio = options.defaultPanelRatio ?? 1 / 3;

  function resolveStorageKey() {
    if (typeof options.storageKey === 'function') return options.storageKey();
    if (typeof options.storageKey === 'string') return options.storageKey;
    return options.storageKey.value;
  }

  const activeStorageKey = computed(() => resolveStorageKey());

  function getContainerWidth() {
    return container.value?.clientWidth ?? 0;
  }

  function getMaxPanelWidth() {
    const maxBySpace = getContainerWidth() - minMainWidthPx;
    return Math.max(minPanelWidthPx, maxBySpace);
  }

  function clampPanelWidth(next: number) {
    const maxPanelWidth = getMaxPanelWidth();
    return Math.min(Math.max(next, minPanelWidthPx), maxPanelWidth);
  }

  function readStoredPanelWidth(): number | null {
    const stored = getLocalStorageNumber(activeStorageKey.value);
    return stored != null && stored > 0 ? stored : null;
  }

  function writeStoredPanelWidth(width: number) {
    setLocalStorageNumber(activeStorageKey.value, width);
  }

  function defaultPanelWidth() {
    return clampPanelWidth(getContainerWidth() * defaultPanelRatio);
  }

  function initializePanelWidth() {
    const stored = readStoredPanelWidth();
    panelWidth.value = clampPanelWidth(stored ?? defaultPanelWidth());
  }

  // AbortController for clean listener teardown — no stale closures.
  let resizeAbort: AbortController | null = null;

  function stopResize(persist: boolean) {
    if (!resizeAbort) return;
    resizeAbort.abort();
    resizeAbort = null;
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (persist) writeStoredPanelWidth(panelWidth.value);
  }

  function startResize(event: MouseEvent) {
    if (event.button !== 0 || resizeAbort) return;
    event.preventDefault();
    panelWidth.value = clampPanelWidth(panelWidth.value);
    isResizing.value = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    resizeAbort = new AbortController();
    const { signal } = resizeAbort;
    window.addEventListener(
      'mousemove',
      (e) => {
        const bounds = container.value?.getBoundingClientRect();
        if (!bounds) return;
        panelWidth.value = clampPanelWidth(bounds.right - e.clientX);
      },
      { signal },
    );
    window.addEventListener('mouseup', () => stopResize(true), { signal });
  }

  function onWindowResize() {
    if (!enabled.value || panelWidth.value <= 0) return;
    panelWidth.value = clampPanelWidth(panelWidth.value);
  }

  watch(activeStorageKey, () => {
    stopResize(false);
    initializePanelWidth();
  });

  watch(
    [container, enabled],
    async ([el, isEnabled]) => {
      if (!el || !isEnabled) {
        stopResize(false);
        return;
      }
      await nextTick();
      if (panelWidth.value <= 0) initializePanelWidth();
      else panelWidth.value = clampPanelWidth(panelWidth.value);
    },
    { immediate: true },
  );

  onMounted(() => {
    window.addEventListener('resize', onWindowResize, { passive: true });
  });

  onUnmounted(() => {
    stopResize(false);
    window.removeEventListener('resize', onWindowResize);
  });

  return {
    panelWidth,
    isResizing,
    startResize,
  };
}
