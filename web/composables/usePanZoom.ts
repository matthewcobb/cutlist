import type { PanZoom, Transform } from 'panzoom';
import panzoom from 'panzoom';

const DOT_GAP = 24;

export default function (
  container: Ref<HTMLElement | undefined>,
  gridEl?: Ref<HTMLElement | undefined>,
) {
  let instance = ref<PanZoom>();
  const scale = ref<number>();
  let initialTransform: Transform | undefined;

  const syncGrid = () => {
    const grid = gridEl?.value;
    const pz = instance.value;
    if (!grid || !pz) return;
    const t = pz.getTransform();
    const gap = DOT_GAP * t.scale;
    grid.style.backgroundSize = `${gap}px ${gap}px`;
    grid.style.backgroundPosition = `${t.x}px ${t.y}px`;
  };

  whenever(
    container,
    (container) => {
      if (instance.value != null) return;
      const { isRulerActive } = useRulerStore();
      instance.value = panzoom(container, {
        autocenter: true,
        minZoom: 0.2,
        maxZoom: 10,
        beforeMouseDown: () => isRulerActive.value,
      });
      initialTransform = { ...instance.value.getTransform() };
      scale.value = initialTransform.scale;
      instance.value.on('zoom', () => {
        scale.value = instance.value?.getTransform().scale;
      });
      instance.value.on('transform', syncGrid);
      syncGrid();
    },
    {},
  );
  whenever(
    () => !container.value,
    () => {
      instance.value?.dispose();
    },
  );
  onUnmounted(() => {
    instance.value?.dispose();
  });

  const setZoom = (cb: (scale: number) => number, x?: number, y?: number) => {
    if (instance.value == null) return;
    const current = instance.value.getTransform();
    const currentScale = current.scale;
    const newScale = cb(current.scale);
    instance.value?.smoothZoom(
      x ?? current.x,
      y ?? current.y,
      newScale / currentScale,
    );
  };
  const zoomBy = (increment: number) => setZoom((scale) => scale + increment);

  return {
    scale,
    zoomIn: () => zoomBy(0.1),
    zoomOut: () => zoomBy(-0.1),
    resetZoom: () => {
      if (initialTransform == null) return;

      const { scale, x, y } = initialTransform;
      setZoom(() => scale, x, y);
      setTimeout(() => {
        instance.value?.smoothMoveTo(x, y);
      }, 200);
    },
  };
}
