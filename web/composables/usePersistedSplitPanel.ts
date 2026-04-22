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
  const previousStorageKey = ref<string | null>(null);

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

  function onResizeMove(event: MouseEvent) {
    if (!isResizing.value) return;
    const bounds = container.value?.getBoundingClientRect();
    if (!bounds) return;
    panelWidth.value = clampPanelWidth(bounds.right - event.clientX);
  }

  function onMouseMove(event: MouseEvent) {
    onResizeMove(event);
  }

  function onMouseUp() {
    stopResize(true);
  }

  function stopResize(persist = true) {
    if (!isResizing.value) return;
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (persist) writeStoredPanelWidth(panelWidth.value);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function startResize(event: MouseEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    panelWidth.value = clampPanelWidth(panelWidth.value);
    isResizing.value = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onWindowResize() {
    if (!enabled.value || panelWidth.value <= 0) return;
    panelWidth.value = clampPanelWidth(panelWidth.value);
  }

  watch(
    [container, enabled, activeStorageKey],
    async ([el, isEnabled, key]) => {
      if (!el || !isEnabled) {
        stopResize(false);
        return;
      }
      await nextTick();
      const keyChanged = previousStorageKey.value !== key;
      previousStorageKey.value = key;
      if (keyChanged) stopResize(false);
      if (panelWidth.value <= 0 || keyChanged) initializePanelWidth();
      else panelWidth.value = clampPanelWidth(panelWidth.value);
    },
    { immediate: true },
  );

  onMounted(() => {
    window.addEventListener('resize', onWindowResize, { passive: true });
  });

  onUnmounted(() => {
    stopResize();
    window.removeEventListener('resize', onWindowResize);
  });

  return {
    panelWidth,
    isResizing,
    startResize,
  };
}
